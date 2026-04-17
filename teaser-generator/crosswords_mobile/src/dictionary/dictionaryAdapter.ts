/**
 * src/dictionary/dictionaryAdapter.ts
 * ---------------------------------------------
 * Offline dictionary catalog used by all local game modes.
 * - Supports canonical tier names (core/standard/advanced/canon/junior).
 * - Keeps temporary aliases for legacy saved values (common/modified).
 * - Exposes metadata so game modes can enforce length-pattern support.
 * - Guess validation policy is centralized so gameplay remains consistent.
 */

import commonWords from './wordlist_common_4_6.json';
import modifiedWords from './wordlist_modified_4_6.json';
import twlWords from './wordlist_twl_4_6.json';

export type CanonicalDictionaryId = 'core' | 'standard' | 'advanced' | 'canon' | 'junior';
export type LegacyDictionaryId = 'common' | 'modified' | 'twl';
export type DictionaryId = CanonicalDictionaryId | LegacyDictionaryId;
export type VisibleDictionaryId = Exclude<CanonicalDictionaryId, 'junior'>;

export type DictionaryMeta = {
  id: CanonicalDictionaryId;
  label: string;
  description: string;
  supportedLengths: number[];
  supportsCurrentPattern: boolean;
};

export const CURRENT_TARGET_PATTERN = [4, 4, 5, 5, 6] as const;

const aliases: Record<LegacyDictionaryId, CanonicalDictionaryId> = {
  common: 'core',
  modified: 'standard',
  twl: 'canon',
};

const coreSet = new Set(commonWords as string[]);
const standardSet = new Set(modifiedWords as string[]);

// Advanced is intentionally stricter than Standard for now by intersecting Standard with TWL.
// This gives a stable, deterministic 4-6 pool immediately while tiered build artifacts are wired in.
const twlArray = twlWords as string[];
const twlIndex = new Set(twlArray);
const advancedSet = new Set((modifiedWords as string[]).filter((word) => twlIndex.has(word)));

// Junior is prepared for future 3-5 game mode and kept hidden in current UI.
const juniorSet = new Set((commonWords as string[]).filter((word) => word.length >= 3 && word.length <= 5));
const twlSet = new Set(twlArray);

const pools: Record<CanonicalDictionaryId, Set<string>> = {
  core: coreSet,
  standard: standardSet,
  advanced: advancedSet,
  canon: twlSet,
  junior: juniorSet,
};

/** Current policy: guesses are validated against Canon in every mode. */
const guessValidationTier: CanonicalDictionaryId = 'canon';

const dictionaryCatalog: Record<CanonicalDictionaryId, DictionaryMeta> = {
  core: {
    id: 'core',
    label: 'Casual',
    description: '~4,500 common English words. Best for casual play.',
    supportedLengths: [4, 5, 6],
    supportsCurrentPattern: true,
  },
  standard: {
    id: 'standard',
    label: 'Medium',
    description: 'Balanced dictionary for regular play.',
    supportedLengths: [4, 5, 6],
    supportsCurrentPattern: true,
  },
  advanced: {
    id: 'advanced',
    label: 'Sharp',
    description: 'Higher-difficulty set for experienced players (current mode uses 4-6 only).',
    supportedLengths: [4, 5, 6],
    supportsCurrentPattern: true,
  },
  canon: {
    id: 'canon',
    label: 'Canon',
    description: 'Top dictionary tier used for guess validation.',
    supportedLengths: [4, 5, 6],
    supportsCurrentPattern: true,
  },
  junior: {
    id: 'junior',
    label: 'Junior',
    description: 'Future mode dictionary for 3-5 letter pattern.',
    supportedLengths: [3, 4, 5],
    supportsCurrentPattern: false,
  },
};

const visibleDictionaryIds: VisibleDictionaryId[] = ['core', 'standard', 'advanced', 'canon'];

/** Normalize a word to A-Z uppercase with no punctuation. */
export function normalizeWord(raw: string): string {
  return (raw || '').replace(/[^A-Za-z]/g, '').toUpperCase();
}

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

/** Return UI-safe dictionary options for current shipping game mode. */
export function getVisibleDictionaryOptions(): VisibleDictionaryId[] {
  return [...visibleDictionaryIds];
}

/** Return metadata for a dictionary id (legacy ids are accepted). */
export function getDictionaryMeta(input: DictionaryId | string): DictionaryMeta {
  return dictionaryCatalog[canonicalizeDictionaryId(input)];
}

/** Guard helper for current fixed game pattern [4,4,5,5,6]. */
export function supportsCurrentTargetPattern(input: DictionaryId | string): boolean {
  return getDictionaryMeta(input).supportsCurrentPattern;
}

/** Return the canonical dictionary tier used for guess-word validation. */
export function getGuessValidationDictionaryId(_targetTier: DictionaryId | string): CanonicalDictionaryId {
  return guessValidationTier;
}

/**
 * Validate a guess according to current gameplay policy.
 * Today this always validates against Canon, regardless of target tier.
 */
export function isValidGuessWord(word: string, targetTier: DictionaryId | string): boolean {
  return isValidWord(word, getGuessValidationDictionaryId(targetTier));
}

/** Return the full word list array for a given dictionary id. */
export function getWordsForDictionary(input: DictionaryId | string): string[] {
  const pool = pools[canonicalizeDictionaryId(input)];
  return [...pool];
}

/**
 * Validate a word against the chosen dictionary.
 * Uses cached Sets so lookups are fast and offline-safe.
 */
export function isValidWord(word: string, dict: DictionaryId | string): boolean {
  const normalized = normalizeWord(word);
  if (!normalized) return false;
  const pool = pools[canonicalizeDictionaryId(dict)];
  if (pool.size === 0) return false;
  return pool.has(normalized);
}
