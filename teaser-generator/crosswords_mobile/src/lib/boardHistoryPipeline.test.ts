import { buildFullIntersectionMap, buildIntersectionMap } from './boardRevealMap';
import { buildBoardMergedHistory, buildBoardSplitHistory } from './boardHistoryPipeline';
import { buildCardDisplayState } from './cardDisplayState';

describe('buildBoardMergedHistory', () => {
  it('keeps crossing shadow evidence yellow when the source intersection upgraded before compaction', () => {
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] as [number, number][], length: 6 },
      { targetIndex: 1, coords: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] as [number, number][], length: 5 },
    ];
    const rawHistoryByTarget = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistoryByTarget.set(0, [{ guess: 'STRAIN', codes: ['R', 'R', 'B', 'R', 'R', 'R'] }]);
    rawHistoryByTarget.set(1, []);

    const mergedHistoryByTarget = buildBoardMergedHistory({
      rawHistoryByTarget,
      wordSlots,
      targetWords: ['PLANET', 'RHYME'],
      solvedFlags: [false, false],
      intersectionMap: buildIntersectionMap(wordSlots),
      fullIntersectionMap: buildFullIntersectionMap(wordSlots),
      blockedSourceTarget: null,
    });

    const crossingEntries = mergedHistoryByTarget.get(1) ?? [];
    expect(crossingEntries).toHaveLength(1);
    expect(crossingEntries[0]).toEqual({
      guess: 'R    ',
      codes: ['Y', '_', '_', '_', '_'],
      rawCodes: ['Y', '_', '_', '_', '_'],
    });
    expect(crossingEntries.some((entry) => entry.codes[0] === 'B')).toBe(false);
  });

  it('still blocks compacted cross-history from the active reveal source target', () => {
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2], [0, 3]] as [number, number][], length: 4 },
      { targetIndex: 1, coords: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] as [number, number][], length: 5 },
    ];
    const rawHistoryByTarget = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistoryByTarget.set(0, [{ guess: 'TREE', codes: ['G', 'B', 'G', 'R'] }]);
    rawHistoryByTarget.set(1, []);

    const mergedHistoryByTarget = buildBoardMergedHistory({
      rawHistoryByTarget,
      wordSlots,
      targetWords: ['TREE', 'RIVER'],
      solvedFlags: [false, false],
      intersectionMap: buildIntersectionMap(wordSlots),
      fullIntersectionMap: buildFullIntersectionMap(wordSlots),
      blockedSourceTarget: 0,
    });

    expect(mergedHistoryByTarget.get(1) ?? []).toEqual([]);
  });
});

describe('buildBoardSplitHistory', () => {
  const wordSlots = [
    { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] as [number, number][], length: 6 },
    { targetIndex: 1, coords: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] as [number, number][], length: 5 },
  ];

  function buildSplitArgs(
    rawHistoryByTarget: Map<number, { guess: string; codes: string[] }[]>,
    opts?: { blockedSourceTarget?: number | null },
  ) {
    return {
      rawHistoryByTarget,
      wordSlots,
      targetWords: ['PLANET', 'ALTER'],
      solvedFlags: [false, false],
      intersectionMap: buildIntersectionMap(wordSlots),
      fullIntersectionMap: buildFullIntersectionMap(wordSlots),
      blockedSourceTarget: opts?.blockedSourceTarget ?? null,
    };
  }

  it('builds canonical word snapshots with literal letters and merged codes for native rows', () => {
    const raw = new Map<number, { guess: string; codes: string[] }[]>();
    raw.set(0, [{ guess: 'hope', codes: ['R', 'R', 'R', 'R'] }]);
    raw.set(1, [{ guess: 'house', codes: ['R', 'R', 'R', 'R', 'R'] }]);

    const crossWordSlots = [
      { targetIndex: 0, coords: [[2, 0], [2, 1], [2, 2], [2, 3]] as [number, number][], length: 4 },
      { targetIndex: 1, coords: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] as [number, number][], length: 5 },
    ];
    const result = buildBoardSplitHistory({
      rawHistoryByTarget: raw,
      wordSlots: crossWordSlots,
      targetWords: ['HOPE', 'HOUSE'],
      solvedFlags: [false, false],
      intersectionMap: buildIntersectionMap(crossWordSlots),
      fullIntersectionMap: buildFullIntersectionMap(crossWordSlots),
      blockedSourceTarget: null,
    });

    const hopeSnapshot = result.wordSnapshotsByTarget.get(0);
    const houseSnapshot = result.wordSnapshotsByTarget.get(1);

    expect(hopeSnapshot).toMatchObject({
      latestLiteralGuess: 'HOPE',
      latestMergedCodes: ['R', 'Y', 'R', 'R'],
    });
    expect(hopeSnapshot?.nativeHistoryRows).toEqual([
      expect.objectContaining({
        guess: 'HOPE',
        codes: ['R', 'Y', 'R', 'R'],
        rawCodes: ['R', 'Y', 'R', 'R'],
        nativeSourceIndex: 0,
        provenance: 'native',
        rowId: 'native:0:0',
      }),
    ]);
    expect(houseSnapshot).toMatchObject({
      latestLiteralGuess: 'HOUSE',
      latestMergedCodes: ['R', 'R', 'R', 'R', 'R'],
    });
  });

  it('returns shadow-only history separately while preserving native history inside snapshots', () => {
    const raw = new Map<number, { guess: string; codes: string[] }[]>();
    raw.set(0, [{ guess: 'STRAIN', codes: ['R', 'R', 'Y', 'R', 'R', 'R'] }]);
    raw.set(1, []);

    const result = buildBoardSplitHistory(buildSplitArgs(raw));

    expect(result.wordSnapshotsByTarget.get(0)?.nativeHistoryRows).toHaveLength(1);
    expect(result.wordSnapshotsByTarget.get(1)?.nativeHistoryRows ?? []).toHaveLength(0);
    expect(result.shadowHistoryByTarget.get(1)?.length ?? 0).toBeGreaterThan(0);
    expect(result.shadowHistoryByTarget.get(0) ?? []).toHaveLength(0);
    for (const entry of result.shadowHistoryByTarget.get(1) ?? []) {
      expect(entry.provenance).toBe('shadow');
    }
    for (const entry of result.wordSnapshotsByTarget.get(0)?.nativeHistoryRows ?? []) {
      expect(entry.provenance).toBe('native');
    }
  });

  it('keeps combinedHistoryByTarget aligned with the legacy merged history output', () => {
    const raw = new Map<number, { guess: string; codes: string[] }[]>();
    raw.set(0, [{ guess: 'STRAIN', codes: ['R', 'R', 'Y', 'R', 'R', 'R'] }]);
    raw.set(1, []);

    const args = buildSplitArgs(raw);
    const splitResult = buildBoardSplitHistory(args);
    const legacyResult = buildBoardMergedHistory(args);

    for (const [targetIndex, legacyEntries] of legacyResult.entries()) {
      const combinedEntries = splitResult.combinedHistoryByTarget.get(targetIndex) ?? [];
      expect(combinedEntries.map((entry) => ({ guess: entry.guess, codes: entry.codes }))).toEqual(
        legacyEntries.map((entry) => ({ guess: entry.guess, codes: entry.codes })),
      );
    }
  });

  it('exposes confirmedBoardLettersByCoord as coordinate truth for board locks', () => {
    const raw = new Map<number, { guess: string; codes: string[] }[]>();
    raw.set(0, [{ guess: 'XXAXXX', codes: ['R', 'R', 'G', 'R', 'R', 'R'] }]);
    raw.set(1, []);

    const result = buildBoardSplitHistory(buildSplitArgs(raw));

    expect(result.confirmedBoardLettersByCoord).toBeInstanceOf(Map);
    expect(result.confirmedBoardLettersByCoord.get('0:2')).toBe('A');
    expect(Array.from(result.confirmedBoardLettersByCoord.entries())).toEqual([['0:2', 'A']]);
  });

  it('includes solved-word coordinates in confirmedBoardLettersByCoord even without new native guesses', () => {
    const raw = new Map<number, { guess: string; codes: string[] }[]>();
    raw.set(0, []);
    raw.set(1, []);

    const result = buildBoardSplitHistory({
      rawHistoryByTarget: raw,
      wordSlots,
      targetWords: ['PLANET', 'ALTER'],
      solvedFlags: [false, true],
      intersectionMap: buildIntersectionMap(wordSlots),
      fullIntersectionMap: buildFullIntersectionMap(wordSlots),
      blockedSourceTarget: null,
    });

    expect(result.confirmedBoardLettersByCoord.get('0:2')).toBe('A');
    expect(result.confirmedBoardLettersByCoord.get('1:2')).toBe('L');
    expect(result.confirmedBoardLettersByCoord.get('2:2')).toBe('T');
    expect(result.confirmedBoardLettersByCoord.get('3:2')).toBe('E');
    expect(result.confirmedBoardLettersByCoord.get('4:2')).toBe('R');
  });

  it('builds canonical board tiles only on declared coordinates for the CHEAP / ATTIRE / SCOPE regression shape', () => {
    const regressionWordSlots = [
      { targetIndex: 0, coords: [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]] as [number, number][], length: 5 },
      { targetIndex: 1, coords: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]] as [number, number][], length: 6 },
      { targetIndex: 2, coords: [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5]] as [number, number][], length: 5 },
      { targetIndex: 3, coords: [[1, 3], [2, 3], [3, 3], [4, 3], [5, 3]] as [number, number][], length: 5 },
      { targetIndex: 4, coords: [[6, 3], [6, 4], [6, 5], [6, 6]] as [number, number][], length: 4 },
    ];
    const raw = new Map<number, { guess: string; codes: string[] }[]>();
    raw.set(0, [{ guess: 'CHEAP', codes: ['R', 'R', 'R', 'G', 'R'] }]);
    raw.set(1, [{ guess: 'ATTIRE', codes: ['G', 'G', 'G', 'R', 'R', 'G'] }]);
    raw.set(2, [{ guess: 'SCOPE', codes: ['R', 'R', 'R', 'R', 'G'] }]);
    raw.set(3, []);
    raw.set(4, []);

    const result = buildBoardSplitHistory({
      rawHistoryByTarget: raw,
      wordSlots: regressionWordSlots,
      targetWords: ['CHEAP', 'ATTIRE', 'SCOPE', 'GRAPE', 'DARE'],
      solvedFlags: [false, true, false, false, false],
      intersectionMap: buildIntersectionMap(regressionWordSlots),
      fullIntersectionMap: buildFullIntersectionMap(regressionWordSlots),
      blockedSourceTarget: null,
    });

    const declaredCoords = new Set(
      regressionWordSlots.flatMap((slot) => slot.coords.map(([row, col]) => `${row}:${col}`)),
    );
    const boardCoords = Array.from(result.boardTilesByCoord.keys());

    expect(boardCoords.every((coord) => declaredCoords.has(coord))).toBe(true);
    expect(result.boardTilesByCoord.get('4:0')?.steadyState).toMatchObject({ letter: 'A', code: 'G' });
    expect(result.boardTilesByCoord.get('4:5')?.steadyState).toMatchObject({ letter: 'E', code: 'G' });
    expect(result.boardTilesByCoord.has('5:1')).toBe(false);
    expect(result.boardTilesByCoord.has('5:2')).toBe(false);
    expect(result.boardTilesByCoord.has('5:4')).toBe(false);
  });

  it('keeps board tiles unchanged while exposing native-vs-shadow card rows for the N/H conflict shape', () => {
    const raw = new Map<number, { guess: string; codes: string[] }[]>();
    raw.set(0, [{ guess: 'XXHXXX', codes: ['R', 'R', 'G', 'R', 'R', 'R'] }]);
    raw.set(1, [{ guess: 'NORTH', codes: ['Y', 'R', 'R', 'R', 'R'] }]);

    const result = buildBoardSplitHistory(buildSplitArgs(raw));
    const cardState = buildCardDisplayState({
      wordSnapshotsByTarget: result.wordSnapshotsByTarget,
      guessViewStateByTarget: {
        0: {
          previewIndex: null,
          lockedIndex: null,
          previewRowId: 'shadow:0:0',
          lockedRowId: 'shadow:0:0',
        },
      },
      selectedTargetIndex: 0,
      confirmedBoardLettersByCoord: result.confirmedBoardLettersByCoord,
      wordSlots,
      strictInvalidViewState: false,
    });

    expect(result.boardTilesByCoord.get('0:2')?.steadyState).toMatchObject({
      letter: 'H',
      code: 'G',
    });
    expect(cardState.selectedNativeGuessByTarget[0]).toMatchObject({
      guess: 'XXHXXX',
      locked: false,
    });
    expect(cardState.detailRowsForSelectedTarget.map((entry) => ({
      rowId: entry.rowId,
      kind: entry.kind,
      interactive: entry.interactive,
    }))).toEqual([
      { rowId: 'shadow:0:0', kind: 'shadow', interactive: false },
      { rowId: 'native:0:0', kind: 'native', interactive: true },
    ]);
  });
});
