import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

// Crypto keys must exist before the parser (which encrypts/hashes) is imported.
process.env.DIGITAL_CODE_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.DIGITAL_CODE_HASH_KEY = randomBytes(48).toString("hex");

import { buildImportCandidates } from "./digital-inventory.parse";

test("parses one candidate per unique non-empty line", () => {
  const result = buildImportCandidates("CODE-1\nCODE-2\nCODE-3");
  assert.equal(result.received, 3);
  assert.equal(result.invalid, 0);
  assert.equal(result.duplicatesInFile, 0);
  assert.equal(result.candidates.length, 3);
});

test("skips blank lines (not counted) and trims surrounding whitespace", () => {
  const result = buildImportCandidates("CODE-1\n\n   \n  CODE-2  \n");
  assert.equal(result.received, 2);
  assert.equal(result.candidates.length, 2);
});

test("detects duplicates within the same file (by fingerprint)", () => {
  // "CODE-1" appears 3x (incl. a whitespace variant that normalizes equal).
  const result = buildImportCandidates("CODE-1\nCODE-1\n  CODE-1  \nCODE-2");
  assert.equal(result.received, 4);
  assert.equal(result.duplicatesInFile, 2);
  assert.equal(result.candidates.length, 2);
});

test("counts over-long entries as invalid", () => {
  const longCode = "x".repeat(2000);
  const result = buildImportCandidates(`OK-CODE\n${longCode}`, 1024);
  assert.equal(result.received, 2);
  assert.equal(result.invalid, 1);
  assert.equal(result.candidates.length, 1);
});

test("received always equals invalid + duplicatesInFile + candidates", () => {
  const result = buildImportCandidates("A\nA\nB\n \nC\nC\nC");
  assert.equal(
    result.received,
    result.invalid + result.duplicatesInFile + result.candidates.length,
  );
});

test("candidates carry only ciphertext + preview + hash — never the raw code", () => {
  const raw = "SUPER-SECRET-CODE-XYZ";
  const result = buildImportCandidates(raw);
  const serialized = JSON.stringify(result.candidates);
  assert.ok(!serialized.includes(raw), "raw code must not appear in candidates");
  const [candidate] = result.candidates;
  assert.ok(candidate);
  assert.match(candidate.hash, /^[0-9a-f]{64}$/);
  assert.ok(candidate.cipher.length > 0);
  assert.ok(candidate.preview.includes("••••"));
  assert.notEqual(candidate.preview, raw);
});

test("same code across calls yields the same fingerprint (DB dedupe basis)", () => {
  const a = buildImportCandidates("REPEAT-ME");
  const b = buildImportCandidates("  REPEAT-ME  ");
  assert.equal(a.candidates[0]?.hash, b.candidates[0]?.hash);
});
