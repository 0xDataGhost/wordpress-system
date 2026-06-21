import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Connector API keys link a WooCommerce store to the SaaS. They are high-entropy
 * bearer tokens, so the secret is hashed with a single SHA-256 (not a slow KDF
 * like bcrypt, which is for low-entropy passwords). The plaintext is shown to
 * the user exactly once; only the hash and a public lookup id are persisted.
 *
 * Key format: `wpc_<keyId>_<secret>`
 *   - scheme  : "wpc" (WordPress connector) — lets us recognise our own keys.
 *   - keyId   : 16 lowercase hex chars — a PUBLIC, non-secret lookup id stored
 *               in plaintext so the connector row can be found without a
 *               table scan (bcrypt/sha hashes are not searchable).
 *   - secret  : base64url(32 random bytes) — the actual secret; only its hash
 *               is stored.
 */

const KEY_SCHEME = "wpc";
const KEY_ID_BYTES = 8; // 16 hex chars
const SECRET_BYTES = 32; // 256-bit secret
const KEY_PATTERN = /^wpc_([0-9a-f]{16})_([A-Za-z0-9_-]+)$/;

export interface GeneratedApiKey {
  /** Full plaintext key. Returned to the user ONCE and never stored. */
  plaintext: string;
  /** Public, non-secret lookup id persisted to find the connection row. */
  keyId: string;
  /** SHA-256 hex hash of the secret portion. This is what we persist. */
  secretHash: string;
  /** Non-secret display prefix safe to store and show in the dashboard. */
  displayPrefix: string;
}

export interface ParsedApiKey {
  keyId: string;
  secret: string;
}

/** SHA-256 hex digest of the secret portion of a key. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Generates a fresh connector API key and the values to persist for it. */
export function generateApiKey(): GeneratedApiKey {
  const keyId = randomBytes(KEY_ID_BYTES).toString("hex");
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  const plaintext = `${KEY_SCHEME}_${keyId}_${secret}`;

  return {
    plaintext,
    keyId,
    secretHash: hashSecret(secret),
    displayPrefix: `${KEY_SCHEME}_${keyId}`,
  };
}

/** Parses a presented key into its lookup id and secret, or null if malformed. */
export function parseApiKey(raw: string): ParsedApiKey | null {
  const match = KEY_PATTERN.exec(raw.trim());
  if (!match) return null;
  return { keyId: match[1] as string, secret: match[2] as string };
}

/**
 * Constant-time comparison of a presented secret against the stored hash.
 * Hashing first makes both operands fixed-length, and timingSafeEqual avoids
 * leaking how many leading characters matched.
 */
export function verifySecret(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), "hex");
  let expected: Buffer;
  try {
    expected = Buffer.from(expectedHash, "hex");
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
