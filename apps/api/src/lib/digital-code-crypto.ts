import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
  type CipherGCMTypes,
} from "node:crypto";

/**
 * Cryptographic primitives for digital codes (Phase 16 — Code Inventory).
 *
 * Digital codes are money. They are treated as sensitive financial inventory:
 *   - The raw code is NEVER stored. It is encrypted at rest with AES-256-GCM
 *     (authenticated, so tampering is detected on decrypt). The key lives only
 *     in the environment (DIGITAL_CODE_ENCRYPTION_KEY), never in the database.
 *   - Duplicate detection uses a KEYED HMAC-SHA256 fingerprint
 *     (DIGITAL_CODE_HASH_KEY) over the normalized code — deterministic, so the
 *     same code always maps to the same hash, but not reversible. Duplicates are
 *     found by comparing hashes; nothing is decrypted to dedupe.
 *   - The raw code is NEVER logged, and never appears in any error message.
 *
 * Unlike the connector key (which degrades to "disabled" when unset), the digital
 * module is security-critical: missing/invalid keys THROW a safe internal error
 * rather than silently no-op.
 */

const ALGORITHM: CipherGCMTypes = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // 96-bit nonce, recommended for GCM

const ENCRYPTION_KEY_ENV = "DIGITAL_CODE_ENCRYPTION_KEY";
const HASH_KEY_ENV = "DIGITAL_CODE_HASH_KEY";

/** Preview masking thresholds (plan2 §5.4). */
const PREVIEW_MASK = "••••";
const SHORT_CODE_MAX = 8; // <= this shows 2+2; longer shows 4+4
const MIN_REVEALABLE_LEN = 5; // <= 4 chars are masked entirely (never reveal)

export interface EncryptedDigitalCode {
  cipher: string; // base64 ciphertext
  iv: string; // base64 nonce
  tag: string; // base64 GCM auth tag
}

/**
 * Raised for any digital-code crypto failure. Carries only a safe message — it
 * NEVER includes the raw code or key material — so it is safe to log/surface.
 */
export class DigitalCodeCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DigitalCodeCryptoError";
  }
}

/**
 * Resolves the 32-byte AES key from the environment. Accepts 64 hex chars or
 * base64. Throws a safe error when missing or the wrong length. Read directly
 * from process.env (not the parsed `env`) so this primitive stays decoupled and
 * independently unit-testable; the variable is also declared in config/env.
 */
function getEncryptionKey(): Buffer {
  const raw = process.env[ENCRYPTION_KEY_ENV];
  if (!raw) {
    throw new DigitalCodeCryptoError(`${ENCRYPTION_KEY_ENV} is not configured`);
  }

  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (key.length !== KEY_BYTES) {
    throw new DigitalCodeCryptoError(
      `${ENCRYPTION_KEY_ENV} must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        "Provide 64 hex chars or 32 bytes base64.",
    );
  }
  return key;
}

/** Resolves the HMAC fingerprint key. Throws a safe error when missing. */
function getHashKey(): string {
  const raw = process.env[HASH_KEY_ENV];
  if (!raw) {
    throw new DigitalCodeCryptoError(`${HASH_KEY_ENV} is not configured`);
  }
  return raw;
}

/**
 * True when BOTH keys are present and valid (AES key decodes to 32 bytes). Never
 * throws — for a boot-time guard or to gate the digital module before use.
 */
export function isDigitalCodeCryptoConfigured(): boolean {
  try {
    getEncryptionKey();
    getHashKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Canonical form of a code for hashing/encryption/preview. Normalizes line
 * endings (CRLF/CR → LF) and trims surrounding whitespace. Case and hyphens are
 * preserved by default (plan2 §5.3). Idempotent.
 */
export function normalizeDigitalCode(rawCode: string): string {
  return rawCode.replace(/\r\n?/g, "\n").trim();
}

/**
 * Encrypts a code with AES-256-GCM. The input is normalized first so the stored
 * ciphertext, hash, and preview all describe the same canonical value. Returns
 * base64 cipher/iv/tag. Throws (never returns the raw code) if the key is unset.
 */
export function encryptDigitalCode(rawCode: string): EncryptedDigitalCode {
  const key = getEncryptionKey();
  const normalized = normalizeDigitalCode(rawCode);

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    cipher: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypts a previously encrypted code. Throws a safe error when the key is
 * unset or the ciphertext/tag fails GCM authentication (tampering or wrong key).
 * The error message never contains code or key material.
 */
export function decryptDigitalCode(payload: EncryptedDigitalCode): string {
  const key = getEncryptionKey();
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.cipher, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    // Swallow the underlying error so no ciphertext/key detail leaks.
    throw new DigitalCodeCryptoError(
      "Failed to decrypt digital code (invalid key or tampered ciphertext)",
    );
  }
}

/**
 * Deterministic keyed fingerprint of a code for duplicate detection
 * (HMAC-SHA256 over the normalized code, hex). The same code always yields the
 * same hash; different codes yield different hashes. Not reversible.
 */
export function hashDigitalCode(rawCode: string): string {
  const hashKey = getHashKey();
  return createHmac("sha256", hashKey)
    .update(normalizeDigitalCode(rawCode), "utf8")
    .digest("hex");
}

/**
 * Builds a safe, masked preview that NEVER equals or reveals the raw code
 * (plan2 §5.4). Codes of 4 chars or fewer are masked entirely; longer codes show
 * a few leading + trailing chars around a fixed mask. The mask sequence means a
 * preview can never coincide with a real code value.
 *   - len <= 4  → "••••"
 *   - 5..8      → first 2 + "••••" + last 2
 *   - > 8       → first 4 + "••••" + last 4
 */
export function makeCodePreview(rawCode: string): string {
  const code = normalizeDigitalCode(rawCode);
  const len = code.length;
  if (len === 0) return "";
  if (len < MIN_REVEALABLE_LEN) return PREVIEW_MASK;

  const visible = len > SHORT_CODE_MAX ? 4 : 2;
  return `${code.slice(0, visible)}${PREVIEW_MASK}${code.slice(len - visible)}`;
}

/**
 * Constant-time comparison of two fingerprints (same length hex digests). Useful
 * for comparing a freshly computed hash against a stored one without timing leaks.
 */
export function digitalCodeHashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
