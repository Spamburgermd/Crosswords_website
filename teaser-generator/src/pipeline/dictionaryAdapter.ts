/**
 * Teaser generator validation uses the same core dictionary as target selection.
 */

import coreWords from '../dictionary/tier_core_4_6.json' assert { type: 'json' };

const corePool = new Set(coreWords as string[]);

/** Normalize a word to A-Z uppercase with no punctuation. */
export function normalizeWord(raw: string): string {
  return (raw || '').replace(/[^A-Za-z]/g, '').toUpperCase();
}

export function isValidWord(word: string): boolean {
  const normalized = normalizeWord(word);
  if (!normalized) return false;
  return corePool.has(normalized);
}
