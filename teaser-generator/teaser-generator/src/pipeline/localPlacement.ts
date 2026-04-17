/**
 * Copied from crosswords_mobile/src/lib/localPlacement.ts
 * Changes:
 *   - All imports use local relative paths (no @src or @schemas aliases).
 *   - MaskedSegment and TargetMeta are imported from local copies.
 */

import { localValidateWordset } from './localValidateWordset.js';
import { localAutoPlaceAllWords } from './localAutoPlaceAllWords.js';
import { localCanonicalTargetsFromLayout, type TargetMeta } from './localCanonicalTargetsFromLayout.js';
import { localMaskedLayoutFor, type MaskedSegment } from './localMaskedLayoutFor.js';

export type { TargetMeta, MaskedSegment };

export type LocalPlacementResult =
  | {
      ok: true;
      opponent_masked: MaskedSegment[];
      targets_meta: TargetMeta[];
      target_lengths: number[];
      revealed_coords: number[][];
      words: string[];
    }
  | { ok: false; error: string };

export function buildLocalPlacement(rawWords: string[]): LocalPlacementResult {
  const validated = localValidateWordset(rawWords);
  if (!validated.ok) return validated;

  const placed = localAutoPlaceAllWords(validated.words);
  if (!placed) {
    return { ok: false, error: 'Unable to place words on a 10x10 grid with valid intersections.' };
  }

  const targets_meta = localCanonicalTargetsFromLayout(placed);
  const opponent_masked = localMaskedLayoutFor(placed);
  const target_lengths = validated.words.map((w) => w.length);

  return {
    ok: true,
    opponent_masked,
    targets_meta,
    target_lengths,
    revealed_coords: [],
    words: validated.words,
  };
}
