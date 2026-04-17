import {
  buildTutorialBoardRevealContract,
  buildTutorialGreenLettersByTarget,
  buildTutorialGreenLettersForActive,
} from './tutorialRevealMaps';
import { getTutorialWordSlots } from './tutorialPuzzle';
import { buildTutorialPipeline } from './useTutorialGameState';

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

describe('tutorial green reveal helpers', () => {
  it('builds the tutorial board reveal contract for the LOCUS -> DIAL -> PATTER flow', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'LOCUS', codes: ['B', 'G', 'R', 'Y', 'Y'] }]],
      [1, [{ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] }]],
      [2, [{ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] }]],
    ]);
    const pipeline = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });

    const wordSlots = getTutorialWordSlots();
    const revealContract = buildTutorialBoardRevealContract(
      1,
      wordSlots,
      pipeline.confirmedBoardLettersByCoord,
    );

    expect(pipeline.wordSnapshotsByTarget.get(0)?.latestNativeRow).toMatchObject({
      guess: 'LOCUS',
      codes: ['B', 'G', 'R', 'Y', 'Y'],
      locked: false,
    });
    expect(pipeline.wordSnapshotsByTarget.get(1)?.latestNativeRow).toMatchObject({
      guess: 'PATTER',
      codes: ['G', 'B', 'R', 'R', 'Y', 'R'],
      locked: false,
    });
    expect(pipeline.wordSnapshotsByTarget.get(2)?.latestNativeRow).toMatchObject({
      guess: 'DIAL',
      codes: ['B', 'R', 'Y', 'Y'],
      locked: false,
    });
    expect(revealContract.greenLettersByTarget).toEqual({
      0: { 1: 'O' },
      1: { 0: 'P' },
    });
    expect(revealContract.greenLettersForActive).toEqual({ 0: 'P' });
  });

  it('captures green-confirmed letters per target from coordinate truth', () => {
    const wordSlots = getTutorialWordSlots();
    const greenLettersByTarget = buildTutorialGreenLettersByTarget(wordSlots, new Map<string, string>([
      ['1:0', 'H'],
      ['1:1', 'O'],
      ['1:2', 'U'],
      ['1:3', 'S'],
      ['1:4', 'E'],
      ['4:1', 'A'],
      ['4:2', 'L'],
      ['4:3', 'S'],
      ['4:4', 'O'],
    ]));

    expect(greenLettersByTarget).toEqual({
      0: { 0: 'H', 1: 'O', 2: 'U', 3: 'S', 4: 'E' },
      1: { 1: 'U', 4: 'L' },
      2: { 0: 'A', 1: 'L', 2: 'S', 3: 'O' },
    });
  });

  it('projects intersecting green letters into the active tutorial word input from coordinate truth', () => {
    const wordSlots = getTutorialWordSlots();
    const greenLettersForActive = buildTutorialGreenLettersForActive(
      1,
      wordSlots,
      new Map<string, string>([
        ['1:2', 'U'],
        ['4:2', 'L'],
      ]),
    );

    expect(greenLettersForActive).toEqual({ 1: 'U', 4: 'L' });
  });

  it('keeps earlier coordinate-truth greens when later greens are added', () => {
    const wordSlots = getTutorialWordSlots();
    const greenLettersByTarget = buildTutorialGreenLettersByTarget(wordSlots, new Map<string, string>([
      ['0:2', 'P'],
      ['4:2', 'L'],
    ]));

    expect(greenLettersByTarget).toEqual({
      1: { 0: 'P', 4: 'L' },
      2: { 1: 'L' },
    });
  });
});
