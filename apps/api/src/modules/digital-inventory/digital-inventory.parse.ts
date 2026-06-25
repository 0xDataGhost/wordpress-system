import {
  encryptDigitalCode,
  hashDigitalCode,
  makeCodePreview,
  normalizeDigitalCode,
} from "../../lib/digital-code-crypto";

/**
 * Pure parse / normalize / dedupe / encrypt step for a code import (no DB).
 * Isolated from the import service so it can be unit-tested without importing the
 * database layer. Returns only ciphertext + masked preview + fingerprint —
 * NEVER the raw plaintext.
 */

/** Upper bound on a single code's length; longer entries are counted invalid. */
export const MAX_CODE_LENGTH = 1024;

/** An encrypted, ready-to-insert code. NEVER carries the raw plaintext. */
export interface ImportCandidate {
  hash: string;
  cipher: string;
  iv: string;
  tag: string;
  preview: string;
}

export interface PreparedImport {
  /** Non-empty lines received (= invalid + duplicatesInFile + candidates). */
  received: number;
  invalid: number;
  duplicatesInFile: number;
  /** Unique, valid, encrypted codes ready to dedupe against the DB + insert. */
  candidates: ImportCandidate[];
}

/**
 * Splits the raw text by line, drops empty lines, marks over-long entries
 * invalid, removes in-file duplicates by fingerprint, and encrypts the
 * survivors. `received` counts non-empty lines and equals
 * `invalid + duplicatesInFile + candidates.length`.
 */
export function buildImportCandidates(
  codesText: string,
  maxCodeLength: number = MAX_CODE_LENGTH,
): PreparedImport {
  const lines = codesText.split(/\r\n|\r|\n/);
  const seen = new Set<string>();
  const candidates: ImportCandidate[] = [];
  let received = 0;
  let invalid = 0;
  let duplicatesInFile = 0;

  for (const line of lines) {
    if (line.trim() === "") continue; // blank lines are skipped, not counted
    received += 1;

    const normalized = normalizeDigitalCode(line);
    if (normalized === "" || normalized.length > maxCodeLength) {
      invalid += 1;
      continue;
    }

    const hash = hashDigitalCode(normalized);
    if (seen.has(hash)) {
      duplicatesInFile += 1;
      continue;
    }
    seen.add(hash);

    const enc = encryptDigitalCode(normalized);
    candidates.push({
      hash,
      cipher: enc.cipher,
      iv: enc.iv,
      tag: enc.tag,
      preview: makeCodePreview(normalized),
    });
  }

  return { received, invalid, duplicatesInFile, candidates };
}
