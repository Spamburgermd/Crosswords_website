import { buildTutorialPipeline } from './useTutorialGameState';
import { buildBoardSplitHistory } from '@src/lib/boardHistoryPipeline';
import { buildIntersectionMap, buildFullIntersectionMap, buildTileRevealMapFromBoardTiles } from '@src/lib/boardRevealMap';
import { buildCardDisplayState } from '@src/lib/cardDisplayState';
import { getTutorialWordSlots, TUTORIAL_WORDS } from './tutorialPuzzle';

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

function buildLiveBoardResult(rawHistoryByTarget: Map<number, { guess: string; codes: string[] }[]>) {
  const wordSlots = getTutorialWordSlots().map((slot) => ({
    targetIndex: slot.targetIndex,
    coords: slot.coords as number[][],
    length: slot.length,
  }));

  return buildBoardSplitHistory({
    rawHistoryByTarget,
    wordSlots,
    targetWords: TUTORIAL_WORDS,
    solvedFlags: [false, false, false],
    intersectionMap: buildIntersectionMap(
      wordSlots.map((slot) => ({ targetIndex: slot.targetIndex, coords: slot.coords as [number, number][] })),
    ),
    fullIntersectionMap: buildFullIntersectionMap(
      wordSlots.map((slot) => ({ targetIndex: slot.targetIndex, coords: slot.coords as [number, number][] })),
    ),
    blockedSourceTarget: null,
  });
}

function serializeShadowRows(result: { wordSnapshotsByTarget: Map<number, { shadowHistoryRows: Array<{ guess: string; codes: string[]; rowId: string }> }> }) {
  return Array.from(result.wordSnapshotsByTarget.entries()).map(([targetIndex, snapshot]) => [
    targetIndex,
    snapshot.shadowHistoryRows.map((entry) => ({ guess: entry.guess, codes: entry.codes, rowId: entry.rowId })),
  ]);
}

describe('buildTutorialPipeline', () => {
  it('preserves scripted tutorial history while sharing the live-board combined-history contract', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'LOCUS', codes: ['B', 'G', 'R', 'Y', 'Y'] }]],
      [1, [{ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] }]],
      [2, [{ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] }]],
    ]);

    const result = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });
    const boardResult = buildLiveBoardResult(rawHistoryByTarget);

    expect(
      result.groupedHistoryList.map((entry) => ({
        targetIndex: entry.slot.targetIndex,
        guesses: entry.guesses.map((guess) => guess.guess),
      })),
    ).toEqual(
      getTutorialWordSlots().map((slot) => ({
        targetIndex: slot.targetIndex,
        guesses: (boardResult.combinedHistoryByTarget.get(slot.targetIndex) ?? []).map((entry) => entry.guess),
      })),
    );
    expect(result.solvedFlags).toEqual({ 0: false, 1: false, 2: false });
  });

  it('marks an all-green exact match as solved for the correct target only', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'HOUSE', codes: ['G', 'G', 'G', 'G', 'G'] }]],
      [1, [{ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] }]],
    ]);

    const result = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });
    const boardResult = buildLiveBoardResult(rawHistoryByTarget);

    expect(result.solvedFlags).toEqual({ 0: true, 1: false, 2: false });
    expect(result.groupedHistoryList[0]?.slot.targetIndex).toBe(1);
    expect(result.groupedHistoryList[0]?.guesses.map((guess) => guess.guess)).toEqual(
      (boardResult.combinedHistoryByTarget.get(1) ?? []).map((entry) => entry.guess),
    );
    expect(result.groupedHistoryList[1]?.slot.targetIndex).toBe(0);
    expect(result.groupedHistoryList[1]?.guesses.map((guess) => guess.guess)).toEqual(
      (boardResult.combinedHistoryByTarget.get(0) ?? []).map((entry) => entry.guess),
    );
  });

  it('preserves canonical word snapshots for the PATTER tutorial step', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'LOCUS', codes: ['B', 'G', 'R', 'Y', 'Y'] }]],
      [1, [{ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] }]],
      [2, [{ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] }]],
    ]);

    const result = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });

    expect(result.wordSnapshotsByTarget.get(0)?.latestNativeRow).toMatchObject({
      guess: 'LOCUS',
      codes: ['B', 'G', 'R', 'Y', 'Y'],
      locked: false,
    });
    expect(result.wordSnapshotsByTarget.get(1)?.latestNativeRow).toMatchObject({
      guess: 'PATTER',
      codes: ['G', 'B', 'R', 'R', 'Y', 'R'],
      locked: false,
    });
    expect(result.wordSnapshotsByTarget.get(2)?.latestNativeRow).toMatchObject({
      guess: 'DIAL',
      codes: ['B', 'R', 'Y', 'Y'],
      locked: false,
    });
    expect(result.solvedFlags).toEqual({ 0: false, 1: false, 2: false });
  });

  it('tutorial exposes the same canonical split-history contract as the live board core', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'LOCUS', codes: ['B', 'G', 'R', 'Y', 'Y'] }]],
      [1, [{ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] }]],
      [2, [{ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] }]],
    ]);

    const result = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });
    const boardResult = buildLiveBoardResult(rawHistoryByTarget);

    expect(serializeShadowRows(result)).toEqual(serializeShadowRows(boardResult));
    for (const targetIndex of [0, 1, 2]) {
      expect(result.wordSnapshotsByTarget.get(targetIndex)?.latestNativeRow?.guess).toBe(
        boardResult.wordSnapshotsByTarget.get(targetIndex)?.latestNativeRow?.guess,
      );
      expect(
        (result.combinedHistoryByTarget.get(targetIndex) ?? []).map((entry) => entry.guess),
      ).toEqual(
        (boardResult.combinedHistoryByTarget.get(targetIndex) ?? []).map((entry) => entry.guess),
      );
    }
  });
});

describe('Tutorial / board convergence', () => {
  it('tutorial free-play and live board produce the same canonical word snapshots for equivalent raw history', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'LOCUS', codes: ['B', 'G', 'R', 'Y', 'Y'] }]],
      [1, [{ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] }]],
      [2, [{ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] }]],
    ]);

    const tutorialResult = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });
    const boardResult = buildLiveBoardResult(rawHistoryByTarget);

    for (const targetIndex of [0, 1, 2]) {
      const tutorialGuess = tutorialResult.wordSnapshotsByTarget.get(targetIndex)?.latestNativeRow;
      const boardGuess = boardResult.wordSnapshotsByTarget.get(targetIndex)?.latestNativeRow;
      expect(tutorialGuess?.guess).toBe(boardGuess?.guess);
      expect(tutorialGuess?.codes).toEqual(boardGuess?.codes);
    }
  });

  it('tutorial free-play and live board expose the same confirmedBoardLettersByCoord contract', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'HOUSE', codes: ['G', 'G', 'G', 'G', 'G'] }]],
      [1, [{ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] }]],
      [2, [{ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] }]],
    ]);

    const tutorialResult = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });
    const boardResult = buildLiveBoardResult(rawHistoryByTarget);

    expect(Array.from(tutorialResult.confirmedBoardLettersByCoord.entries())).toEqual(
      Array.from(boardResult.confirmedBoardLettersByCoord.entries()),
    );
  });

  it('tutorial free-play and live board expose the same canonical board tile map', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'HOUSE', codes: ['G', 'G', 'G', 'G', 'G'] }]],
      [1, [{ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] }]],
      [2, [{ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] }]],
    ]);

    const tutorialResult = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });
    const boardResult = buildLiveBoardResult(rawHistoryByTarget);

    expect(Array.from(tutorialResult.boardTilesByCoord.entries())).toEqual(
      Array.from(boardResult.boardTilesByCoord.entries()),
    );
  });

  it('tutorial free-play and live board resolve the same non-green shared-cell owner at coord 4:2', () => {
    const rawHistoryByTarget = new Map([
      [1, [{ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] }]],
      [2, [{ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] }]],
    ]);

    const tutorialResult = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });
    const boardResult = buildLiveBoardResult(rawHistoryByTarget);

    const tutorialAlsoSelected = buildTileRevealMapFromBoardTiles(tutorialResult.boardTilesByCoord, null, 2)?.get('4:2');
    const tutorialPuddleSelected = buildTileRevealMapFromBoardTiles(tutorialResult.boardTilesByCoord, null, 1)?.get('4:2');
    const boardAlsoSelected = buildTileRevealMapFromBoardTiles(boardResult.boardTilesByCoord, null, 2)?.get('4:2');
    const boardPuddleSelected = buildTileRevealMapFromBoardTiles(boardResult.boardTilesByCoord, null, 1)?.get('4:2');

    expect(tutorialAlsoSelected).toMatchObject({ primaryTargetIndex: 2, letter: 'I' });
    expect(tutorialPuddleSelected).toMatchObject({ primaryTargetIndex: 1, letter: 'E' });
    expect(tutorialAlsoSelected).toEqual(boardAlsoSelected);
    expect(tutorialPuddleSelected).toEqual(boardPuddleSelected);
  });

  it('tutorial free-play and live board keep shared green state aligned at coord 1:2', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'HOUSE', codes: ['G', 'G', 'G', 'G', 'G'] }]],
      [1, [{ guess: 'PUDDLE', codes: ['R', 'G', 'R', 'R', 'R', 'R'] }]],
    ]);

    const tutorialResult = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });
    const boardResult = buildLiveBoardResult(rawHistoryByTarget);

    const tutorialReveal = buildTileRevealMapFromBoardTiles(tutorialResult.boardTilesByCoord, 1, 1)?.get('1:2');
    const boardReveal = buildTileRevealMapFromBoardTiles(boardResult.boardTilesByCoord, 1, 1)?.get('1:2');
    const tutorialSettled = buildTileRevealMapFromBoardTiles(tutorialResult.boardTilesByCoord, null, 1)?.get('1:2');
    const boardSettled = buildTileRevealMapFromBoardTiles(boardResult.boardTilesByCoord, null, 1)?.get('1:2');

    expect(tutorialReveal).toEqual(boardReveal);
    expect(tutorialSettled).toEqual(boardSettled);
    expect(tutorialSettled).toMatchObject({ letter: 'U', primaryCode: 'G' });
  });

  it('tutorial free-play and live board expose the same literal-last-guess contract', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'HOPE', codes: ['R', 'R', 'R', 'R'] }]],
      [1, [{ guess: 'HOUSE', codes: ['R', 'R', 'R', 'R', 'R'] }]],
      [2, [{ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] }]],
    ]);

    const tutorialResult = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {},
    });
    const boardResult = buildLiveBoardResult(rawHistoryByTarget);

    for (const targetIndex of [0, 1, 2]) {
      expect(tutorialResult.wordSnapshotsByTarget.get(targetIndex)?.latestLiteralGuess).toBe(
        boardResult.wordSnapshotsByTarget.get(targetIndex)?.latestLiteralGuess,
      );
      expect(tutorialResult.wordSnapshotsByTarget.get(targetIndex)?.latestMergedCodes).toEqual(
        boardResult.wordSnapshotsByTarget.get(targetIndex)?.latestMergedCodes,
      );
    }
  });

  it('tutorial free-play and live board expose the same card display state contract', () => {
    const rawHistoryByTarget = new Map([
      [0, [{ guess: 'HOUSE', codes: ['G', 'G', 'G', 'G', 'G'] }]],
      [1, [{ guess: 'PATTER', codes: ['G', 'B', 'R', 'R', 'Y', 'R'] }]],
      [2, [{ guess: 'DIAL', codes: ['B', 'R', 'Y', 'Y'] }]],
    ]);
    const guessViewStateByTarget = {
      0: {
        previewIndex: null,
        lockedIndex: null,
        previewRowId: 'shadow:0:0',
        lockedRowId: null,
      },
    };

    const tutorialResult = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget,
    });
    const boardResult = buildLiveBoardResult(rawHistoryByTarget);
    const boardCardState = buildCardDisplayState({
      wordSnapshotsByTarget: boardResult.wordSnapshotsByTarget,
      guessViewStateByTarget,
      selectedTargetIndex: 0,
      confirmedBoardLettersByCoord: boardResult.confirmedBoardLettersByCoord,
      wordSlots: getTutorialWordSlots(),
      strictInvalidViewState: false,
    });

    expect(
      Object.fromEntries(
        Object.entries(tutorialResult.cardDisplayState.selectedNativeGuessByTarget).map(([targetIndex, entry]) => [
          targetIndex,
          entry ? { guess: entry.guess, locked: entry.locked } : null,
        ]),
      ),
    ).toEqual(
      Object.fromEntries(
        Object.entries(boardCardState.selectedNativeGuessByTarget).map(([targetIndex, entry]) => [
          targetIndex,
          entry ? { guess: entry.guess, locked: entry.locked } : null,
        ]),
      ),
    );
    expect(
      tutorialResult.cardDisplayState.detailRowsForSelectedTarget.map((row) => ({
        rowId: row.rowId,
        kind: row.kind,
        interactive: row.interactive,
        isLocked: row.isLocked,
      })),
    ).toEqual(
      boardCardState.detailRowsForSelectedTarget.map((row) => ({
        rowId: row.rowId,
        kind: row.kind,
        interactive: row.interactive,
        isLocked: row.isLocked,
      })),
    );
    expect(tutorialResult.cardDisplayState.greenPlaceholdersByTarget).toEqual(
      boardCardState.greenPlaceholdersByTarget,
    );
  });
});

describe('Tutorial row locking', () => {
  it('tutorial normal rows remain lockable by rowId without changing board paint', () => {
    const rawHistoryByTarget = new Map([
      [0, [
        { guess: 'LOCUS', codes: ['B', 'G', 'R', 'Y', 'Y'] },
        { guess: 'HOUSE', codes: ['G', 'G', 'G', 'G', 'G'] },
      ]],
    ]);

    const result = buildTutorialPipeline({
      rawHistoryByTarget,
      guessViewStateByTarget: {
        0: {
          previewIndex: null,
          lockedIndex: null,
          previewRowId: 'native:0:0',
          lockedRowId: 'native:0:0',
        },
      },
    });

    expect(result.wordSnapshotsByTarget.get(0)?.latestNativeRow).toMatchObject({
      guess: 'HOUSE',
      locked: false,
    });
  });
});
