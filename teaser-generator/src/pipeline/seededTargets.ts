/**
 * Copied from crosswords_mobile/src/localChallenge/seededTargets.ts
 * Changes:
 *   - All imports use local relative paths (no @src aliases).
 *   - JSON imports updated to ../dictionary/.
 *   - Added .js extensions for Node16 module resolution.
 */

import { ALLOWED_WORD_LENGTHS } from './wordRules.js';
import coreWords from '../dictionary/tier_core_4_6.json' assert { type: 'json' };
import { buildLocalPlacement } from './localPlacement.js';

const TARGET_LENGTHS = [4, 4, 5, 5, 6] as const;
const MAX_ATTEMPTS = 50;

/** Mulberry32 PRNG — seeded, deterministic. */
function mulberry32(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash so retries don't reuse overlapping seed ranges. */
function hashString32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

type LengthMap = Record<number, string[]>;

function buildLengthMap(words: string[]): LengthMap {
  const map: LengthMap = {};
  for (const len of ALLOWED_WORD_LENGTHS) {
    map[len] = [];
  }
  words.forEach((w) => {
    const upper = (w || '').toUpperCase();
    const len = upper.length;
    if (map[len]) {
      map[len]!.push(upper);
    }
  });
  return map;
}

function buildWordSet(lengthMap: LengthMap): Set<string> {
  const allWords: string[] = [];
  for (const len of ALLOWED_WORD_LENGTHS) {
    allWords.push(...(lengthMap[len] ?? []));
  }
  return new Set(allWords);
}

export function isBasicPluralCandidate(word: string, dictionaryWords: Set<string>): boolean {
  const upper = (word || '').toUpperCase();
  if (upper.length < 4 || !upper.endsWith('S')) return false;
  if (upper.endsWith('SS') || upper.endsWith('US') || upper.endsWith('IS')) return false;

  const singularCandidates = new Set<string>();
  singularCandidates.add(upper.slice(0, -1));
  if (upper.endsWith('IES') && upper.length > 4) {
    singularCandidates.add(`${upper.slice(0, -3)}Y`);
  }
  if (upper.endsWith('ES') && upper.length > 3) {
    singularCandidates.add(upper.slice(0, -2));
  }
  for (const singular of singularCandidates) {
    if (singular.length >= 3 && dictionaryWords.has(singular)) return true;
  }
  return false;
}

export function deriveRetrySeed(seed: number, attempt: number): number {
  return hashString32(`${seed}:core:${attempt}`);
}

const CORE_WORDS_BY_LENGTH = buildLengthMap(coreWords as string[]);
const CORE_WORD_SET = buildWordSet(CORE_WORDS_BY_LENGTH);

export function generateTargetsFromSeed(
  seed: number,
  count = 5,
): string[] {
  const requiredLengths = TARGET_LENGTHS.slice(0, count);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(deriveRetrySeed(seed, attempt));
    const picked: string[] = [];
    const used = new Set<string>();
    let failed = false;

    for (const len of requiredLengths) {
      const pool = (CORE_WORDS_BY_LENGTH[len] ?? []).filter(
        (candidate) => !isBasicPluralCandidate(candidate, CORE_WORD_SET),
      );
      if (pool.length === 0) {
        throw new Error(`No eligible core words of length ${len}.`);
      }
      let chosen: string | undefined;
      for (let tries = 0; tries < pool.length; tries++) {
        const idx = Math.floor(rng() * pool.length);
        const candidate = pool[idx];
        if (candidate && !used.has(candidate)) {
          chosen = candidate;
          break;
        }
      }
      if (!chosen) {
        failed = true;
        break;
      }
      picked.push(chosen);
      used.add(chosen);
    }

    if (failed || picked.length !== requiredLengths.length) continue;

    const placement = buildLocalPlacement(picked);
    if (placement.ok) return picked;
  }

  throw new Error(`Failed to generate placeable core targets after ${MAX_ATTEMPTS} attempts.`);
}
