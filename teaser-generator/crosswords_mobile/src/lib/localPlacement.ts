/**
 * src/lib/localPlacement.ts
 * -----------------------------------------------------------
 * High-level helper that validates, places, and canonicalizes
 * a 5-word set for local solo/bot play, mirroring server behavior.
 */

import { localValidateWordset } from './localValidateWordset';
import { localAutoPlaceAllWords } from './localAutoPlaceAllWords';
import { localCanonicalTargetsFromLayout } from './localCanonicalTargetsFromLayout';
import { localMaskedLayoutFor } from './localMaskedLayoutFor';
import type { MaskedSegment, TargetMeta } from '@schemas/api';

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
