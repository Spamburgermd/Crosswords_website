import {
  buildConfirmedLettersByTargetFromCoordMap,
  buildConfirmedLettersForTargetFromCoordMap,
} from './confirmedBoardLetters';

describe('confirmedBoardLetters helpers', () => {
  const wordSlots = [
    { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2]] as number[][] },
    { targetIndex: 1, coords: [[0, 2], [1, 2], [2, 2]] as number[][] },
  ];

  it('projects coordinate truth into each targets local positions', () => {
    const confirmedBoardLettersByCoord = new Map<string, string>([
      ['0:1', 'A'],
      ['0:2', 'B'],
      ['1:2', 'C'],
    ]);

    expect(buildConfirmedLettersByTargetFromCoordMap(confirmedBoardLettersByCoord, wordSlots)).toEqual({
      0: { 1: 'A', 2: 'B' },
      1: { 0: 'B', 1: 'C' },
    });
  });

  it('builds active-target input hints directly from coordinate truth', () => {
    const confirmedBoardLettersByCoord = new Map<string, string>([
      ['0:2', 'B'],
      ['1:2', 'C'],
    ]);

    expect(buildConfirmedLettersForTargetFromCoordMap(1, wordSlots, confirmedBoardLettersByCoord)).toEqual({
      0: 'B',
      1: 'C',
    });
  });
});
