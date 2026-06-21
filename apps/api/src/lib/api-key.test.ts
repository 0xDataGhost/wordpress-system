import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateApiKey,
  hashSecret,
  parseApiKey,
  verifySecret,
} from "./api-key";

test("generateApiKey produces a parseable wpc_ key with matching parts", () => {
  const key = generateApiKey();

  assert.match(key.plaintext, /^wpc_[0-9a-f]{16}_[A-Za-z0-9_-]+$/);
  assert.equal(key.displayPrefix, `wpc_${key.keyId}`);
  assert.equal(key.secretHash.length, 64); // sha256 hex

  const parsed = parseApiKey(key.plaintext);
  assert.ok(parsed);
  assert.equal(parsed.keyId, key.keyId);
  assert.equal(hashSecret(parsed.secret), key.secretHash);
});

test("generateApiKey is unique across calls", () => {
  const a = generateApiKey();
  const b = generateApiKey();
  assert.notEqual(a.keyId, b.keyId);
  assert.notEqual(a.plaintext, b.plaintext);
  assert.notEqual(a.secretHash, b.secretHash);
});

test("parseApiKey rejects malformed keys", () => {
  assert.equal(parseApiKey(""), null);
  assert.equal(parseApiKey("nope"), null);
  assert.equal(parseApiKey("wpc_short_secret"), null); // keyId not 16 hex
  assert.equal(parseApiKey("xyz_3f9a1c7b2d4e5f60_secret"), null); // wrong scheme
  assert.equal(parseApiKey("wpc_3f9a1c7b2d4e5f60_"), null); // empty secret
});

test("verifySecret accepts the correct secret and rejects wrong ones", () => {
  const key = generateApiKey();
  const parsed = parseApiKey(key.plaintext);
  assert.ok(parsed);

  assert.equal(verifySecret(parsed.secret, key.secretHash), true);
  assert.equal(verifySecret(`${parsed.secret}x`, key.secretHash), false);
  assert.equal(verifySecret("totally-wrong", key.secretHash), false);
});

test("verifySecret rejects a malformed stored hash without throwing", () => {
  assert.equal(verifySecret("anything", "not-hex"), false);
  assert.equal(verifySecret("anything", ""), false);
});

test("hashSecret is deterministic", () => {
  assert.equal(hashSecret("abc"), hashSecret("abc"));
  assert.notEqual(hashSecret("abc"), hashSecret("abd"));
});
