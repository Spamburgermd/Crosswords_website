import { deriveRetrySeed, generateTargetsFromSeed, isBasicPluralCandidate } from './seededTargets';
import { canonicalizeDictionaryId, type DictionaryId } from '../dictionary/dictionaryAdapter';
import commonWords from '../dictionary/wordlist_common_4_6.json';
import modifiedWords from '../dictionary/wordlist_modified_4_6.json';
import twlWords from '../dictionary/wordlist_twl_4_6.json';
import { buildLocalPlacement } from '@src/lib/localPlacement';

function dictionaryWordSet(dict: DictionaryId): Set<string> {
  const canonical = canonicalizeDictionaryId(dict);
  if (canonical === 'core') {
    return new Set((commonWords as string[]).map((w) => w.toUpperCase()));
  }
  if (canonical === 'standard' || canonical === 'advanced') {
    return new Set((modifiedWords as string[]).map((w) => w.toUpperCase()));
  }
  if (canonical === 'canon') {
    return new Set((twlWords as string[]).map((w) => w.toUpperCase()));
  }
  return new Set((modifiedWords as string[]).map((w) => w.toUpperCase()));
}

describe('generateTargetsFromSeed', () => {
  it('derives deterministic retry seeds for the same inputs', () => {
    expect(deriveRetrySeed(12345, 'standard', 0)).toBe(
      deriveRetrySeed(12345, 'standard', 0),
    );
  });

  it('uses distinct retry seeds across attempts for one base seed', () => {
    const retrySeeds = Array.from({ length: 10 }, (_, attempt) =>
      deriveRetrySeed(12345, 'standard', attempt),
    );
    expect(new Set(retrySeeds).size).toBe(retrySeeds.length);
  });

  it('does not overlap nearby retry-seed sequences', () => {
    const first = new Set(
      Array.from({ length: 10 }, (_, attempt) => deriveRetrySeed(1000, 'standard', attempt)),
    );
    const second = new Set(
      Array.from({ length: 10 }, (_, attempt) => deriveRetrySeed(1001, 'standard', attempt)),
    );
    const overlap = [...first].filter((seed) => second.has(seed));
    expect(overlap).toEqual([]);
  });

  it('flags only basic plurals when singular base exists', () => {
    const words = new Set(['BOAT', 'GOAT', 'PICK', 'HOUSE', 'BASIS', 'TOUR']);
    expect(isBasicPluralCandidate('BOATS', words)).toBe(true);
    expect(isBasicPluralCandidate('GOATS', words)).toBe(true);
    expect(isBasicPluralCandidate('PICKS', words)).toBe(true);
    expect(isBasicPluralCandidate('HOUSES', words)).toBe(true);

    // Non-plural endings and non-S words should stay eligible.
    expect(isBasicPluralCandidate('BASIS', words)).toBe(false);
    expect(isBasicPluralCandidate('TOUR', words)).toBe(false);
    expect(isBasicPluralCandidate('HOUR', words)).toBe(false);
    expect(isBasicPluralCandidate('FOUR', words)).toBe(false);
  });

  it('is deterministic for the same seed', () => {
    const first = generateTargetsFromSeed(12345, 'canon', 5);
    const second = generateTargetsFromSeed(12345, 'canon', 5);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it('returns a valid 5-word placeable set', () => {
    const targets = generateTargetsFromSeed(12345, 'standard', 5);
    expect(targets).toHaveLength(5);
    expect(targets.map((word) => word.length)).toEqual([4, 4, 5, 5, 6]);
    expect(new Set(targets).size).toBe(5);
    expect(buildLocalPlacement(targets).ok).toBe(true);
  });

  it('respects dictionary id', () => {
    const twl = generateTargetsFromSeed(1, 'canon', 5);
    const modified = generateTargetsFromSeed(1, 'modified', 5);
    expect(twl).not.toEqual(modified);
  });

  it('never picks basic plural targets during seeded generation', () => {
    const dict: DictionaryId = 'standard';
    const words = dictionaryWordSet(dict);
    for (let seed = 1; seed <= 200; seed += 1) {
      const targets = generateTargetsFromSeed(seed, dict, 5);
      for (const target of targets) {
        expect(isBasicPluralCandidate(target, words)).toBe(false);
      }
    }
  });

  it('does not collapse nearby seeds onto the same final board', () => {
    const first = generateTargetsFromSeed(1, 'standard', 5);
    const second = generateTargetsFromSeed(2, 'standard', 5);
    expect(first).not.toEqual(second);
    expect(first.slice().sort()).not.toEqual(second.slice().sort());
  });
});
