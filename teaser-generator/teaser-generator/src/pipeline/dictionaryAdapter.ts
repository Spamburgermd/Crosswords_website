/**
 * Copied from crosswords_mobile/src/dictionary/dictionaryAdapter.ts
 * Changes: JSON import paths updated to ../dictionary/.
 * React Native / Expo deps: none in original, no changes needed.
 */

import commonWords from '../dictionary/wordlist_common_4_6.json' assert { type: 'json' };
import modifiedWords from '../dictionary/wordlist_modified_4_6.json' assert { type: 'json' };
import twlWords from '../dictionary/wordlist_twl_4_6.json' assert { type: 'json' };

export type CanonicalDictionaryId = 'core' | 'standard' | 'advanced' | 'canon' | 'junior';
export type LegacyDictionaryId = 'common' | 'modified' | 'twl';
export type DictionaryId = CanonicalDictionaryId | LegacyDictionaryId;

const aliases: Record<LegacyDictionaryId, CanonicalDictionaryId> = {
  common: 'core',
  modified: 'standard',
  twl: 'canon',
};

const twlArray = twlWords as string[];
const twlIndex = new Set(twlArray);
const advancedSet = new Set((modifiedWords as string[]).filter((word) => twlIndex.has(word)));
const juniorSet = new Set((commonWords as string[]).filter((word) => word.length >= 3 && word.length <= 5));
const twlSet = new Set(twlArray);

const pools: Record<CanonicalDictionaryId, Set<string>> = {
  core: new Set(commonWords as string[]),
  standard: new Set(modifiedWords as string[]),
  advanced: advancedSet,
  canon: twlSet,
  junior: juniorSet,
};

/** Map legacy ids to canonical ids so old persisted settings keep working. */
export function canonicalizeDictionaryId(input: string | null | undefined): CanonicalDictionaryId {
  const value = (input || '').toLowerCase();
  if (value === 'common') return aliases.common;
  if (value === 'modified') return aliases.modified;
  if (value === 'twl') return aliases.twl;
  if (value === 'core' || value === 'standard' || value === 'advanced' || value === 'canon' || value === 'junior') {
    return value;
  }
  return 'core';
}

/** Normalize a word to A-Z uppercase with no punctuation. */
export function normalizeWord(raw: string): string {
  return (raw || '').replace(/[^A-Za-z]/g, '').toUpperCase();
}

export function isValidWord(word: string, dict: DictionaryId | string): boolean {
  const normalized = normalizeWord(word);
  if (!normalized) return false;
  const pool = pools[canonicalizeDictionaryId(dict)];
  if (!pool || pool.size === 0) return false;
  return pool.has(normalized);
}
