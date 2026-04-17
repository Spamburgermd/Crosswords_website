// crosswords_mobile/src/screens/tutorial/tutorialPuzzle.ts
import type { MaskedSegment, TargetMeta } from '@src/types/api';
import { buildCanonicalWordSlots } from '@src/utils/wordSlots';
import type { CanonicalWordSlot } from '@src/utils/wordSlots';

/**
 * Tutorial puzzle: HOUSE (Across) × PUDDLE (Down) × ALSO (Across)
 *
 * Grid (6 rows × 5 cols):
 *   . . P . .   row 0
 *   H O U S E   row 1  targetIndex 0  HOUSE across
 *   . . D . .   row 2
 *   . . D . .   row 3
 *   . A L S O   row 4  targetIndex 2  ALSO across
 *   . . E . .   row 5
 *     ↑col2
 *   PUDDLE       col 2  targetIndex 1
 *
 * Intersections:
 *   [1,2]  HOUSE[2]=U  ×  PUDDLE[1]=U
 *   [4,2]  ALSO[1]=L   ×  PUDDLE[4]=L
 */

export const TUTORIAL_WORDS: string[] = [
  'HOUSE',   // targetIndex 0
  'PUDDLE',  // targetIndex 1
  'ALSO',    // targetIndex 2
];

export const TUTORIAL_MASKED_SEGMENTS: MaskedSegment[] = [
  { coords: [[1,0],[1,1],[1,2],[1,3],[1,4]], orient: 'A' },  // HOUSE
  { coords: [[0,2],[1,2],[2,2],[3,2],[4,2],[5,2]], orient: 'D' },  // PUDDLE
  { coords: [[4,1],[4,2],[4,3],[4,4]], orient: 'A' },  // ALSO
];

export const TUTORIAL_TARGETS_META: TargetMeta[] = [
  { target_index: 0, length: 5, start: [1,0], dir: 'A', coords: [[1,0],[1,1],[1,2],[1,3],[1,4]] },
  { target_index: 1, length: 6, start: [0,2], dir: 'D', coords: [[0,2],[1,2],[2,2],[3,2],[4,2],[5,2]] },
  { target_index: 2, length: 4, start: [4,1], dir: 'A', coords: [[4,1],[4,2],[4,3],[4,4]] },
];

/** No pre-revealed coordinates — player starts with a blank board. */
export const TUTORIAL_REVEALED_COORDS: number[][] = [];

/** Memoized word slots derived from the tutorial puzzle layout. */
let _cachedSlots: CanonicalWordSlot[] | null = null;
export function getTutorialWordSlots(): CanonicalWordSlot[] {
  if (!_cachedSlots) {
    _cachedSlots = buildCanonicalWordSlots(
      TUTORIAL_MASKED_SEGMENTS,
      TUTORIAL_TARGETS_META,
    );
  }
  return _cachedSlots;
}

/**
 * Scripted pre-fills for each action step.
 * Codes are pre-computed and injected directly — no server call needed.
 */
export const TUTORIAL_PREFILLS: Record<number, { guess: string; codes: string[] }> = {
  0: { guess: 'LOCUS',  codes: ['B','G','R','Y','Y'] },    // on HOUSE  (targetIndex 0)
  1: { guess: 'PATTER', codes: ['G','B','R','R','Y','R'] }, // on PUDDLE (targetIndex 1)
  2: { guess: 'DIAL',   codes: ['B','R','Y','Y'] },         // on ALSO   (targetIndex 2)
};
