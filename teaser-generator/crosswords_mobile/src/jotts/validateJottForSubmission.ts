/**
 * Validate a Jott right before generating a challenge.
 * Enforces 5 words, allowed lengths, dictionary check, and no duplicates.
 */
import { ALLOWED_WORD_LENGTHS } from '../config/wordRules';
import { DictionaryId, isValidWord, normalizeWord } from '../dictionary/dictionaryAdapter';
import type { Jott } from './jottsStore';

export type JottValidationResult =
  | { ok: true; words: string[] }
  | { ok: false; errors: string[] };

export function validateJottForSubmission(jott: Jott): JottValidationResult {
  const errors: string[] = [];
  const normalized = (jott.words || []).map((w) => normalizeWord(w));

  if (normalized.length !== 5) {
    errors.push(`Needs exactly 5 words (parsed ${normalized.length}).`);
  }

  normalized.forEach((w, idx) => {
    if (!ALLOWED_WORD_LENGTHS.includes(w.length as (typeof ALLOWED_WORD_LENGTHS)[number])) {
      errors.push(`Word ${idx + 1} length must be ${ALLOWED_WORD_LENGTHS.join(', ')} letters.`);
    }
    if (!/^[A-Z]+$/.test(w)) {
      errors.push(`Word ${idx + 1} must use letters A–Z only.`);
    }
  });

  const dupes = normalized.filter((w, i, arr) => arr.indexOf(w) !== i);
  if (dupes.length > 0) {
    errors.push(`Duplicates found: ${Array.from(new Set(dupes)).join(', ')}`);
  }

  normalized.forEach((w, idx) => {
    if (!isValidWord(w, jott.dictionaryId as DictionaryId)) {
      errors.push(`Word ${idx + 1} not in ${jott.dictionaryId.toUpperCase()} dictionary: ${w}`);
    }
  });

  return errors.length ? { ok: false, errors } : { ok: true, words: normalized };
}
