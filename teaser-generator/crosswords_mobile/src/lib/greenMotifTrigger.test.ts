import { collectNewGreenIntersectionMotifs } from './greenMotifTrigger';

describe('collectNewGreenIntersectionMotifs', () => {
  const slotByTargetIndex = new Map([
    [0, { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2]], length: 3 }],
    [1, { targetIndex: 1, coords: [[0, 1], [1, 1], [2, 1]], length: 3 }],
  ]);
  const coordToTargetIndices = new Map([
    ['0:0', [0]],
    ['0:1', [0, 1]],
    ['0:2', [0]],
    ['1:1', [1]],
    ['2:1', [1]],
  ]);

  it('emits a new intersection motif when coordinate truth gains a new partial green', () => {
    const result = collectNewGreenIntersectionMotifs({
      previousConfirmedCoords: new Set<string>(),
      confirmedBoardLettersByCoord: new Map<string, string>([['0:1', 'B']]),
      coordToTargetIndices,
      slotByTargetIndex,
      greenLettersByTarget: {
        0: { 1: 'B' },
      },
      motifFiredCoords: new Set<string>(),
      revealTargetIndex: 0,
    });

    expect(result).toEqual([
      {
        coordKey: '0:1',
        row: 0,
        col: 1,
        targetIndex: 0,
        positionInWord: 1,
      },
    ]);
  });

  it('prefers the reveal target when both owners are partial and the coordinate is newly green', () => {
    const result = collectNewGreenIntersectionMotifs({
      previousConfirmedCoords: new Set<string>(),
      confirmedBoardLettersByCoord: new Map<string, string>([['0:1', 'B']]),
      coordToTargetIndices,
      slotByTargetIndex,
      greenLettersByTarget: {
        0: { 1: 'B' },
        1: { 0: 'B' },
      },
      motifFiredCoords: new Set<string>(),
      revealTargetIndex: 1,
    });

    expect(result).toEqual([
      {
        coordKey: '0:1',
        row: 0,
        col: 1,
        targetIndex: 1,
        positionInWord: 0,
      },
    ]);
  });

  it('does not emit when the coordinate was already confirmed before this update', () => {
    const result = collectNewGreenIntersectionMotifs({
      previousConfirmedCoords: new Set<string>(['0:1']),
      confirmedBoardLettersByCoord: new Map<string, string>([['0:1', 'B']]),
      coordToTargetIndices,
      slotByTargetIndex,
      greenLettersByTarget: {
        0: { 1: 'B' },
      },
      motifFiredCoords: new Set<string>(),
      revealTargetIndex: 0,
    });

    expect(result).toEqual([]);
  });

  it('defers to the solved-word path when every owning word is already fully green', () => {
    const result = collectNewGreenIntersectionMotifs({
      previousConfirmedCoords: new Set<string>(),
      confirmedBoardLettersByCoord: new Map<string, string>([['0:1', 'B']]),
      coordToTargetIndices,
      slotByTargetIndex,
      greenLettersByTarget: {
        0: { 0: 'A', 1: 'B', 2: 'C' },
        1: { 0: 'B', 1: 'D', 2: 'E' },
      },
      motifFiredCoords: new Set<string>(),
      revealTargetIndex: 0,
    });

    expect(result).toEqual([]);
  });
});
