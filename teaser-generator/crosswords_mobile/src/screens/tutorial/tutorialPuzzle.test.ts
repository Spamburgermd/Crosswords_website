import { localAutoPlaceAllWords } from '@src/lib/localAutoPlaceAllWords';

import {
  getTutorialWordSlots,
  TUTORIAL_MASKED_SEGMENTS,
  TUTORIAL_PREFILLS,
  TUTORIAL_REVEALED_COORDS,
  TUTORIAL_TARGETS_META,
  TUTORIAL_WORDS,
} from './tutorialPuzzle';

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

describe('tutorialPuzzle', () => {
  it('keeps the fixed tutorial words and layout constants stable', () => {
    expect(TUTORIAL_WORDS).toEqual(['HOUSE', 'PUDDLE', 'ALSO']);
    expect(TUTORIAL_MASKED_SEGMENTS).toEqual([
      { coords: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]], orient: 'A' },
      { coords: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2]], orient: 'D' },
      { coords: [[4, 1], [4, 2], [4, 3], [4, 4]], orient: 'A' },
    ]);
    expect(TUTORIAL_TARGETS_META).toEqual([
      { target_index: 0, length: 5, start: [1, 0], dir: 'A', coords: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]] },
      { target_index: 1, length: 6, start: [0, 2], dir: 'D', coords: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2]] },
      { target_index: 2, length: 4, start: [4, 1], dir: 'A', coords: [[4, 1], [4, 2], [4, 3], [4, 4]] },
    ]);
    expect(TUTORIAL_REVEALED_COORDS).toEqual([]);
    expect(TUTORIAL_PREFILLS[0]).toEqual({ guess: 'LOCUS', codes: ['B', 'G', 'R', 'Y', 'Y'] });
    expect(TUTORIAL_PREFILLS[1]).toEqual({ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] });
    expect(TUTORIAL_PREFILLS[2]).toEqual({ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] });
  });

  it('still produces a placeable fixed tutorial board', () => {
    expect(localAutoPlaceAllWords(TUTORIAL_WORDS)).not.toBeNull();
  });

  it('keeps the derived tutorial word slots stable', () => {
    expect(getTutorialWordSlots().map((slot) => ({
      targetIndex: slot.targetIndex,
      displayIndex: slot.displayIndex,
      length: slot.length,
    }))).toEqual([
      { targetIndex: 1, displayIndex: 1, length: 6 },
      { targetIndex: 0, displayIndex: 2, length: 5 },
      { targetIndex: 2, displayIndex: 3, length: 4 },
    ]);
  });
});
