import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

// The module reads process.env lazily on each call, so setting the keys here
// (before import) is enough for the configured-path tests.
process.env.DIGITAL_CODE_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.DIGITAL_CODE_HASH_KEY = randomBytes(48).toString("hex");

import {
  DigitalCodeCryptoError,
  decryptDigitalCode,
  digitalCodeHashEquals,
  encryptDigitalCode,
  hashDigitalCode,
  isDigitalCodeCryptoConfigured,
  makeCodePreview,
  normalizeDigitalCode,
} from "./digital-code-crypto";

const SAMPLE = "ABCD-1234-EFGH-5678";

test("isDigitalCodeCryptoConfigured is true when both keys are set", () => {
  assert.equal(isDigitalCodeCryptoConfigured(), true);
});

test("encrypt then decrypt round-trips the code", () => {
  const encrypted = encryptDigitalCode(SAMPLE);
  // Ciphertext parts are base64 and the cipher is not the plaintext.
  assert.notEqual(encrypted.cipher, SAMPLE);
  assert.match(encrypted.iv, /^[A-Za-z0-9+/=]+$/);
  assert.match(encrypted.tag, /^[A-Za-z0-9+/=]+$/);
  assert.equal(decryptDigitalCode(encrypted), SAMPLE);
});

test("two encryptions of the same code use distinct nonces", () => {
  const a = encryptDigitalCode(SAMPLE);
  const b = encryptDigitalCode(SAMPLE);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.cipher, b.cipher);
});

test("decrypt rejects a tampered ciphertext (GCM auth tag)", () => {
  const encrypted = encryptDigitalCode(SAMPLE);
  const tampered = {
    ...encrypted,
    cipher: Buffer.from("totally-different-bytes").toString("base64"),
  };
  assert.throws(
    () => decryptDigitalCode(tampered),
    (err: unknown) => err instanceof DigitalCodeCryptoError,
  );
});

test("same raw code yields the same hash (deterministic)", () => {
  assert.equal(hashDigitalCode(SAMPLE), hashDigitalCode(SAMPLE));
});

test("different raw codes yield different hashes", () => {
  assert.notEqual(hashDigitalCode(SAMPLE), hashDigitalCode("ZZZZ-0000-YYYY-1111"));
});

test("hash is taken over the normalized code (whitespace-insensitive)", () => {
  assert.equal(hashDigitalCode(`  ${SAMPLE}  `), hashDigitalCode(SAMPLE));
  assert.equal(hashDigitalCode(`${SAMPLE}\r\n`), hashDigitalCode(SAMPLE));
});

test("hash is a 64-char hex SHA-256 digest", () => {
  assert.match(hashDigitalCode(SAMPLE), /^[0-9a-f]{64}$/);
});

test("digitalCodeHashEquals compares fingerprints safely", () => {
  const h = hashDigitalCode(SAMPLE);
  assert.equal(digitalCodeHashEquals(h, hashDigitalCode(SAMPLE)), true);
  assert.equal(digitalCodeHashEquals(h, hashDigitalCode("other")), false);
});

test("preview masks the code and never equals the raw code", () => {
  const preview = makeCodePreview(SAMPLE);
  assert.notEqual(preview, SAMPLE);
  assert.ok(preview.includes("••••"), "preview must contain the mask");
  // The hidden middle must not appear verbatim.
  assert.ok(!preview.includes("1234-EFGH"), "preview must hide the middle");
});

test("preview shows 4+4 for long codes and 2+2 for short codes", () => {
  // length > 8 → first 4 + mask + last 4
  assert.equal(makeCodePreview("ABCDEFGH123456"), "ABCD••••3456");
  // 5..8 → first 2 + mask + last 2
  assert.equal(makeCodePreview("ABCDEF"), "AB••••EF");
});

test("preview fully masks very short codes (<= 4 chars)", () => {
  for (const short of ["A", "AB", "ABC", "ABCD"]) {
    const preview = makeCodePreview(short);
    assert.equal(preview, "••••");
    assert.notEqual(preview, short);
  }
});

test("preview of an empty/whitespace code is empty", () => {
  assert.equal(makeCodePreview(""), "");
  assert.equal(makeCodePreview("   "), "");
});

test("normalize trims and normalizes line endings, preserving case + hyphens", () => {
  assert.equal(normalizeDigitalCode("  abc-DEF  "), "abc-DEF");
  assert.equal(normalizeDigitalCode("code\r\n"), "code");
  assert.equal(normalizeDigitalCode("a\r\nb"), "a\nb");
  // Idempotent.
  const once = normalizeDigitalCode("  Key-123  ");
  assert.equal(normalizeDigitalCode(once), once);
});

test("missing encryption key fails safely without leaking the raw code", () => {
  const saved = process.env.DIGITAL_CODE_ENCRYPTION_KEY;
  delete process.env.DIGITAL_CODE_ENCRYPTION_KEY;
  try {
    assert.equal(isDigitalCodeCryptoConfigured(), false);
    let thrown: unknown;
    try {
      encryptDigitalCode(SAMPLE);
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown instanceof DigitalCodeCryptoError, "expected safe error");
    assert.ok(
      !(thrown as Error).message.includes(SAMPLE),
      "error must not leak the raw code",
    );
  } finally {
    process.env.DIGITAL_CODE_ENCRYPTION_KEY = saved;
  }
});

test("missing hash key fails safely", () => {
  const saved = process.env.DIGITAL_CODE_HASH_KEY;
  delete process.env.DIGITAL_CODE_HASH_KEY;
  try {
    assert.throws(
      () => hashDigitalCode(SAMPLE),
      (err: unknown) =>
        err instanceof DigitalCodeCryptoError &&
        !err.message.includes(SAMPLE),
    );
  } finally {
    process.env.DIGITAL_CODE_HASH_KEY = saved;
  }
});

test("an encryption key of the wrong length fails safely", () => {
  const saved = process.env.DIGITAL_CODE_ENCRYPTION_KEY;
  process.env.DIGITAL_CODE_ENCRYPTION_KEY = "tooshort";
  try {
    assert.throws(
      () => encryptDigitalCode(SAMPLE),
      (err: unknown) => err instanceof DigitalCodeCryptoError,
    );
  } finally {
    process.env.DIGITAL_CODE_ENCRYPTION_KEY = saved;
  }
});
