import {
  buildBoardTilesByCoord,
  buildTileRevealMapFromBoardTiles,
  buildTileRevealMapFromDisplayGuess,
  mergeIntersectionCode,
  buildIntersectionMap,
  buildIntersectionPositionsByTarget,
  applyIntersectionMerge,
  buildFullIntersectionMap,
  buildCrossHistoryEntries,
  buildGatedCrossHistoryEntries,
  type CanonicalBoardSlot,
  type IntersectionMap,
} from './boardRevealMap';
import type { DisplayGuessByTarget } from './guessDisplayState';

/* ------------------------------------------------------------------ */
/*  Unit tests for mergeIntersectionCode                               */
/* ------------------------------------------------------------------ */

describe('mergeIntersectionCode', () => {
  it('passes through G unchanged when crossing word contains the letter', () => {
    expect(mergeIntersectionCode('G', 'A', 'APPLE')).toBe('G');
  });

  it('passes through G unchanged when crossing word does NOT contain the letter', () => {
    expect(mergeIntersectionCode('G', 'Z', 'APPLE')).toBe('G');
  });

  it('passes through Y unchanged when crossing word contains the letter', () => {
    expect(mergeIntersectionCode('Y', 'A', 'APPLE')).toBe('Y');
  });

  it('passes through Y unchanged when crossing word does NOT contain the letter', () => {
    expect(mergeIntersectionCode('Y', 'Z', 'APPLE')).toBe('Y');
  });

  it('upgrades B to Y when letter IS in crossing word', () => {
    expect(mergeIntersectionCode('B', 'P', 'APPLE')).toBe('Y');
  });

  it('keeps B when letter is NOT in crossing word', () => {
    expect(mergeIntersectionCode('B', 'Z', 'APPLE')).toBe('B');
  });

  it('upgrades R to Y when letter IS in crossing word (smartBlue edge case)', () => {
    expect(mergeIntersectionCode('R', 'L', 'APPLE')).toBe('Y');
  });

  it('keeps R when letter is NOT in crossing word', () => {
    expect(mergeIntersectionCode('R', 'Z', 'APPLE')).toBe('R');
  });

  it('is case-insensitive for letter and crossing word', () => {
    expect(mergeIntersectionCode('B', 'a', 'APPLE')).toBe('Y');
    expect(mergeIntersectionCode('B', 'A', 'apple')).toBe('Y');
  });

  // Duplicate letter edge case: TALL vs TALE
  // Second L gets B from scorer (blue pool has L from crossing word)
  // At cross, crossing word LEMON has L → upgrade B to Y
  it('upgrades B to Y for duplicate letter when crossing word has that letter', () => {
    expect(mergeIntersectionCode('B', 'L', 'LEMON')).toBe('Y');
  });

  // smartBlue consumed: raw R but crossing word genuinely has the letter
  it('upgrades R to Y for duplicate letter when smartBlue consumed pool but crossing word has letter', () => {
    expect(mergeIntersectionCode('R', 'L', 'LEMON')).toBe('Y');
  });
});

/* ------------------------------------------------------------------ */
/*  Unit tests for buildIntersectionMap                                */
/* ------------------------------------------------------------------ */

describe('buildIntersectionMap', () => {
  it('identifies intersection positions between two crossing words', () => {
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2]] as [number, number][] },
      { targetIndex: 1, coords: [[0, 0], [1, 0], [2, 0]] as [number, number][] },
    ];
    const map = buildIntersectionMap(wordSlots);
    // Target 0, position 0 crosses target 1
    expect(map.get(0)?.get(0)).toBe(1);
    // Target 1, position 0 crosses target 0
    expect(map.get(1)?.get(0)).toBe(0);
    // Non-intersection positions not in map
    expect(map.get(0)?.get(1)).toBeUndefined();
    expect(map.get(0)?.get(2)).toBeUndefined();
    expect(map.get(1)?.get(1)).toBeUndefined();
  });

  it('returns empty map when no intersections exist', () => {
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1]] as [number, number][] },
      { targetIndex: 1, coords: [[1, 0], [1, 1]] as [number, number][] },
    ];
    const map = buildIntersectionMap(wordSlots);
    expect(map.size).toBe(0);
  });

  it('handles multiple intersections in one word', () => {
    // Across word at row 0, cols 0-2
    // Down word 1 at col 0, rows 0-2
    // Down word 2 at col 2, rows 0-2
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2]] as [number, number][] },
      { targetIndex: 1, coords: [[0, 0], [1, 0], [2, 0]] as [number, number][] },
      { targetIndex: 2, coords: [[0, 2], [1, 2], [2, 2]] as [number, number][] },
    ];
    const map = buildIntersectionMap(wordSlots);
    // Target 0 has two intersection positions
    expect(map.get(0)?.get(0)).toBe(1);  // pos 0 crosses target 1
    expect(map.get(0)?.get(2)).toBe(2);  // pos 2 crosses target 2
    expect(map.get(0)?.get(1)).toBeUndefined(); // pos 1 is not an intersection
  });
});

describe('buildIntersectionPositionsByTarget', () => {
  it('returns no marked positions when no shared coordinates exist', () => {
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1]] as [number, number][] },
      { targetIndex: 1, coords: [[1, 0], [1, 1]] as [number, number][] },
    ];

    const positionsByTarget = buildIntersectionPositionsByTarget(wordSlots);

    expect(positionsByTarget.size).toBe(0);
    expect(positionsByTarget.get(0)).toBeUndefined();
    expect(positionsByTarget.get(1)).toBeUndefined();
  });

  it('marks the correct local index in both words for one shared coordinate', () => {
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2]] as [number, number][] },
      { targetIndex: 1, coords: [[0, 0], [1, 0], [2, 0]] as [number, number][] },
    ];

    const positionsByTarget = buildIntersectionPositionsByTarget(wordSlots);

    expect(Array.from(positionsByTarget.get(0) ?? [])).toEqual([0]);
    expect(Array.from(positionsByTarget.get(1) ?? [])).toEqual([0]);
  });

  it('marks every crossing position when one word has multiple intersections', () => {
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2]] as [number, number][] },
      { targetIndex: 1, coords: [[0, 0], [1, 0], [2, 0]] as [number, number][] },
      { targetIndex: 2, coords: [[0, 2], [1, 2], [2, 2]] as [number, number][] },
    ];

    const positionsByTarget = buildIntersectionPositionsByTarget(wordSlots);

    expect(Array.from(positionsByTarget.get(0) ?? []).sort((a, b) => a - b)).toEqual([0, 2]);
    expect(Array.from(positionsByTarget.get(1) ?? [])).toEqual([0]);
    expect(Array.from(positionsByTarget.get(2) ?? [])).toEqual([0]);
  });
});

/* ------------------------------------------------------------------ */
/*  Unit tests for applyIntersectionMerge                              */
/* ------------------------------------------------------------------ */

describe('applyIntersectionMerge', () => {
  it('upgrades B to Y at intersection when letter is in crossing word', () => {
    const intersectionMap: IntersectionMap = new Map([
      [0, new Map([[0, 1]])], // target 0, position 0 crosses target 1
    ]);
    const history = new Map([
      [0, [{ guess: 'BX', codes: ['B', 'R'] }]],
    ]);
    const result = applyIntersectionMerge(history, intersectionMap, ['AX', 'BD']);
    expect(result.get(0)?.[0].codes[0]).toBe('Y'); // B in crossing word 'BD'
    expect(result.get(0)?.[0].codes[1]).toBe('R'); // non-intersection, unchanged
  });

  it('keeps B at intersection when letter is NOT in crossing word', () => {
    const intersectionMap: IntersectionMap = new Map([
      [0, new Map([[0, 1]])],
    ]);
    const history = new Map([
      [0, [{ guess: 'ZX', codes: ['B', 'R'] }]],
    ]);
    const result = applyIntersectionMerge(history, intersectionMap, ['AX', 'BD']);
    expect(result.get(0)?.[0].codes[0]).toBe('B'); // Z not in 'BD'
  });

  it('upgrades R to Y at intersection when letter is in crossing word', () => {
    const intersectionMap: IntersectionMap = new Map([
      [0, new Map([[0, 1]])],
    ]);
    const history = new Map([
      [0, [{ guess: 'BX', codes: ['R', 'R'] }]],
    ]);
    const result = applyIntersectionMerge(history, intersectionMap, ['AX', 'BD']);
    expect(result.get(0)?.[0].codes[0]).toBe('Y'); // B in crossing word 'BD'
  });

  it('does not modify entries for targets without intersections', () => {
    const intersectionMap: IntersectionMap = new Map(); // empty
    const history = new Map([
      [0, [{ guess: 'BX', codes: ['B', 'R'] }]],
    ]);
    const result = applyIntersectionMerge(history, intersectionMap, ['AX', 'BD']);
    expect(result.get(0)?.[0].codes).toEqual(['B', 'R']);
  });

  it('preserves extra entry properties', () => {
    const intersectionMap: IntersectionMap = new Map([
      [0, new Map([[0, 1]])],
    ]);
    const history = new Map([
      [0, [{ guess: 'BX', codes: ['B', 'R'], rawCodes: ['B', 'R'] }]],
    ]);
    const result = applyIntersectionMerge(history, intersectionMap, ['AX', 'BD']);
    expect(result.get(0)?.[0].codes[0]).toBe('Y');
    expect((result.get(0)?.[0] as any).rawCodes).toEqual(['B', 'R']); // rawCodes untouched
  });

  it('merges all history entries for a target, not just the latest', () => {
    const intersectionMap: IntersectionMap = new Map([
      [0, new Map([[0, 1]])],
    ]);
    const history = new Map([
      [0, [
        { guess: 'BX', codes: ['B', 'R'] },
        { guess: 'DX', codes: ['R', 'G'] },
      ]],
    ]);
    const result = applyIntersectionMerge(history, intersectionMap, ['AX', 'BD']);
    expect(result.get(0)?.[0].codes[0]).toBe('Y'); // B in 'BD'
    expect(result.get(0)?.[1].codes[0]).toBe('Y'); // D in 'BD'
  });

  it('reproduces LIKE vs MINI/TOKEN bug: K at intersection should be Y', () => {
    // MINI is target 0 (across), TOKEN is target 1 (down)
    // They cross at MINI position 2 (N) = TOKEN position ?
    // Guess LIKE against MINI: L=R, I=G, K=B, E=B
    // K is at position 2, which is the intersection with TOKEN
    // TOKEN contains K → B should upgrade to Y
    const intersectionMap: IntersectionMap = new Map([
      [0, new Map([[2, 1]])], // MINI position 2 crosses TOKEN (target 1)
    ]);
    const history = new Map([
      [0, [{ guess: 'LIKE', codes: ['R', 'G', 'B', 'B'] }]],
    ]);
    const result = applyIntersectionMerge(history, intersectionMap, ['MINI', 'TOKEN']);
    expect(result.get(0)?.[0].codes).toEqual(['R', 'G', 'Y', 'B']);
  });
});

/* ------------------------------------------------------------------ */
/*  Integration tests for buildTileRevealMapFromDisplayGuess           */
/* ------------------------------------------------------------------ */

function buildBoardFixture() {
  const coordToSegmentPosition = new Map<string, { segmentIndex: number; positionInWord: number }[]>([
    ['0:0', [
      { segmentIndex: 0, positionInWord: 0 },
      { segmentIndex: 1, positionInWord: 0 },
    ]],
    ['0:1', [{ segmentIndex: 0, positionInWord: 1 }]],
    ['1:0', [{ segmentIndex: 1, positionInWord: 1 }]],
  ]);
  const slotIndexToTargetIndex = new Map<number, number>([
    [0, 0],
    [1, 1],
  ]);
  const canonicalSlots: CanonicalBoardSlot[] = [
    { direction: 'A' },
    { direction: 'D' },
  ];

  return { coordToSegmentPosition, slotIndexToTargetIndex, canonicalSlots };
}

describe('buildTileRevealMapFromDisplayGuess', () => {
  it('uses the selected target snapshot as the tile face at intersections', () => {
    const { coordToSegmentPosition, slotIndexToTargetIndex, canonicalSlots } = buildBoardFixture();
    const displayGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'AB', codes: ['R', 'G'], sourceIndex: 0, locked: false },
      1: { guess: 'CD', codes: ['Y', 'R'], sourceIndex: 0, locked: false },
    };

    const map = buildTileRevealMapFromDisplayGuess(
      displayGuessByTarget,
      coordToSegmentPosition,
      slotIndexToTargetIndex,
      canonicalSlots,
      1,
      null,
    );

    expect(map?.get('0:0')).toMatchObject({
      primaryTargetIndex: 1,
      letter: 'C',
      primaryCode: 'Y',
      primaryDirection: 'D',
    });
  });

  it('uses each non-selected target display snapshot for its own cells', () => {
    const { coordToSegmentPosition, slotIndexToTargetIndex, canonicalSlots } = buildBoardFixture();
    const displayGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'QB', codes: ['G', 'R'], sourceIndex: 3, locked: false },
      1: { guess: 'CD', codes: ['Y', 'R'], sourceIndex: 0, locked: false },
    };

    const map = buildTileRevealMapFromDisplayGuess(
      displayGuessByTarget,
      coordToSegmentPosition,
      slotIndexToTargetIndex,
      canonicalSlots,
      1,
      null,
    );

    expect(map?.get('0:1')).toMatchObject({
      primaryTargetIndex: 0,
      letter: 'B',
      primaryCode: 'R',
    });
  });

  it('does NOT include crossing fields in TileRevealInfo', () => {
    const { coordToSegmentPosition, slotIndexToTargetIndex, canonicalSlots } = buildBoardFixture();
    const displayGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'AB', codes: ['G', 'R'], sourceIndex: 2, locked: true },
      1: { guess: 'CD', codes: ['Y', 'R'], sourceIndex: 1, locked: false },
    };

    const map = buildTileRevealMapFromDisplayGuess(
      displayGuessByTarget,
      coordToSegmentPosition,
      slotIndexToTargetIndex,
      canonicalSlots,
      0,
      null,
    );

    const intersection = map?.get('0:0');
    expect(intersection).toBeDefined();
    expect(intersection).not.toHaveProperty('crossingCode');
    expect(intersection).not.toHaveProperty('crossingTargetIndex');
    expect(intersection).not.toHaveProperty('crossingPositionInWord');
    expect(intersection).not.toHaveProperty('crossingDirection');
  });

  it('green from crossing word wins over non-green active word at intersection', () => {
    const { coordToSegmentPosition, slotIndexToTargetIndex, canonicalSlots } = buildBoardFixture();
    const displayGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'BX', codes: ['B', 'R'], sourceIndex: 0, locked: false },
      1: { guess: 'BD', codes: ['G', 'R'], sourceIndex: 0, locked: false },
    };

    const map = buildTileRevealMapFromDisplayGuess(
      displayGuessByTarget,
      coordToSegmentPosition,
      slotIndexToTargetIndex,
      canonicalSlots,
      0,
      null,
    );

    // Green entry from target 1 wins over active target 0's B
    expect(map?.get('0:0')).toMatchObject({ primaryCode: 'G', primaryTargetIndex: 1 });
  });

  it('non-intersection cells pass through codes unchanged', () => {
    const { coordToSegmentPosition, slotIndexToTargetIndex, canonicalSlots } = buildBoardFixture();
    const displayGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'BX', codes: ['B', 'R'], sourceIndex: 0, locked: false },
      1: { guess: 'BD', codes: ['R', 'R'], sourceIndex: 0, locked: false },
    };

    const map = buildTileRevealMapFromDisplayGuess(
      displayGuessByTarget,
      coordToSegmentPosition,
      slotIndexToTargetIndex,
      canonicalSlots,
      0,
      null,
    );

    // 0:1 is non-intersection (only target 0)
    expect(map?.get('0:1')).toMatchObject({ primaryCode: 'R' });
    // 1:0 is non-intersection (only target 1)
    expect(map?.get('1:0')).toMatchObject({ primaryCode: 'R' });
  });

  it('prefers green entry at intersection even when active word is non-green', () => {
    const { coordToSegmentPosition, slotIndexToTargetIndex, canonicalSlots } = buildBoardFixture();
    // Target 0 (Across) has 'B' with code 'Y' at intersection 0:0
    // Target 1 (Down) has 'B' with code 'G' at intersection 0:0
    // Active word is target 0 — but target 1's green should win
    const displayGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'BX', codes: ['Y', 'R'], sourceIndex: 0, locked: false },
      1: { guess: 'BD', codes: ['G', 'R'], sourceIndex: 0, locked: false },
    };

    const map = buildTileRevealMapFromDisplayGuess(
      displayGuessByTarget,
      coordToSegmentPosition,
      slotIndexToTargetIndex,
      canonicalSlots,
      0,    // activeTargetIndex = 0 (the non-green word)
      null, // no revealTargetIndex
    );

    expect(map?.get('0:0')).toMatchObject({
      primaryTargetIndex: 1,
      letter: 'B',
      primaryCode: 'G',
    });
  });

  it('changing one target preview only updates that targets tiles', () => {
    const { coordToSegmentPosition, slotIndexToTargetIndex, canonicalSlots } = buildBoardFixture();
    const firstDisplayGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'AB', codes: ['R', 'G'], sourceIndex: 0, locked: false },
      1: { guess: 'CD', codes: ['Y', 'R'], sourceIndex: 0, locked: false },
    };
    const secondDisplayGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'XB', codes: ['G', 'G'], sourceIndex: 1, locked: false },
      1: { guess: 'CD', codes: ['Y', 'R'], sourceIndex: 0, locked: false },
    };

    const firstMap = buildTileRevealMapFromDisplayGuess(
      firstDisplayGuessByTarget,
      coordToSegmentPosition,
      slotIndexToTargetIndex,
      canonicalSlots,
      0,
      null,
    );
    const secondMap = buildTileRevealMapFromDisplayGuess(
      secondDisplayGuessByTarget,
      coordToSegmentPosition,
      slotIndexToTargetIndex,
      canonicalSlots,
      0,
      null,
    );

    expect(firstMap?.get('0:1')).toMatchObject({ letter: 'B', primaryCode: 'G' });
    expect(secondMap?.get('0:1')).toMatchObject({ letter: 'B', primaryCode: 'G' });
    expect(firstMap?.get('1:0')).toEqual(secondMap?.get('1:0'));
  });
});

/* ------------------------------------------------------------------ */
/*  Unit tests for buildFullIntersectionMap                            */
/* ------------------------------------------------------------------ */

describe('buildFullIntersectionMap', () => {
  it('returns crossing target index AND crossing position for both words', () => {
    // Across: target 0 at row 0, cols 0-2
    // Down:   target 1 at col 1, rows 0-2
    // They cross at (0,1) — target 0 pos 1, target 1 pos 0
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2]] as [number, number][] },
      { targetIndex: 1, coords: [[0, 1], [1, 1], [2, 1]] as [number, number][] },
    ];
    const map = buildFullIntersectionMap(wordSlots);

    const t0 = map.get(0);
    expect(t0?.get(1)).toEqual({ crossingTargetIndex: 1, crossingPosition: 0 });

    const t1 = map.get(1);
    expect(t1?.get(0)).toEqual({ crossingTargetIndex: 0, crossingPosition: 1 });
  });

  it('handles multiple intersections in one word', () => {
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2]] as [number, number][] },
      { targetIndex: 1, coords: [[0, 0], [1, 0], [2, 0]] as [number, number][] },
      { targetIndex: 2, coords: [[0, 2], [1, 2], [2, 2]] as [number, number][] },
    ];
    const map = buildFullIntersectionMap(wordSlots);

    // Target 0 pos 0 crosses target 1 pos 0
    expect(map.get(0)?.get(0)).toEqual({ crossingTargetIndex: 1, crossingPosition: 0 });
    // Target 0 pos 2 crosses target 2 pos 0
    expect(map.get(0)?.get(2)).toEqual({ crossingTargetIndex: 2, crossingPosition: 0 });
  });

  it('returns empty map when no intersections exist', () => {
    const wordSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1]] as [number, number][] },
      { targetIndex: 1, coords: [[1, 0], [1, 1]] as [number, number][] },
    ];
    const map = buildFullIntersectionMap(wordSlots);
    expect(map.size).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Unit tests for buildCrossHistoryEntries                            */
/* ------------------------------------------------------------------ */

describe('buildCrossHistoryEntries', () => {
  // Across: target 0 = "TREE" at row 0, cols 0-3
  // Down:   target 1 = "RIVER" at col 1, rows 0-4
  // Cross at (0,1): target 0 pos 1 ↔ target 1 pos 0
  const wordSlots = [
    { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2], [0, 3]] as [number, number][], length: 4 },
    { targetIndex: 1, coords: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] as [number, number][], length: 5 },
  ];

  it('creates a shadow entry in the crossing word history', () => {
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [{ guess: 'TREE', codes: ['G', 'Y', 'G', 'R'] }]);
    rawHistory.set(1, []);

    const fullMap = buildFullIntersectionMap(wordSlots);
    const cross = buildCrossHistoryEntries(rawHistory, fullMap, wordSlots);

    const t1Entries = cross.get(1) ?? [];
    expect(t1Entries).toHaveLength(1);
    // Shadow entry for target 1: R at position 0, blanks elsewhere
    expect(t1Entries[0].guess).toBe('R    ');
    expect(t1Entries[0].codes).toEqual(['Y', '_', '_', '_', '_']);
  });

  it('does not create shadow entries for non-intersection positions', () => {
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [{ guess: 'TREE', codes: ['G', 'Y', 'G', 'R'] }]);
    rawHistory.set(1, []);

    const fullMap = buildFullIntersectionMap(wordSlots);
    const cross = buildCrossHistoryEntries(rawHistory, fullMap, wordSlots);

    const t1Entry = cross.get(1)?.[0];
    // Only position 0 should have a real letter
    expect(t1Entry?.guess[1]).toBe(' ');
    expect(t1Entry?.codes[1]).toBe('_');
  });

  it('creates shadow entries in both directions', () => {
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [{ guess: 'TREE', codes: ['G', 'Y', 'G', 'R'] }]);
    rawHistory.set(1, [{ guess: 'RIVER', codes: ['Y', 'G', 'B', 'R', 'G'] }]);

    const fullMap = buildFullIntersectionMap(wordSlots);
    const cross = buildCrossHistoryEntries(rawHistory, fullMap, wordSlots);

    // Target 0 should get shadow from target 1's guess at pos 1 (R from RIVER pos 0)
    const t0Entries = cross.get(0) ?? [];
    expect(t0Entries).toHaveLength(1);
    expect(t0Entries[0].guess).toBe(' R  ');
    expect(t0Entries[0].codes).toEqual(['_', 'Y', '_', '_']);

    // Target 1 should get shadow from target 0's guess
    const t1Entries = cross.get(1) ?? [];
    expect(t1Entries).toHaveLength(1);
  });

  it('compacts multiple non-overlapping shadow fragments into one row', () => {
    const compactSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] as [number, number][], length: 5 },
      { targetIndex: 1, coords: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] as [number, number][], length: 5 },
      { targetIndex: 2, coords: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]] as [number, number][], length: 5 },
      { targetIndex: 3, coords: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] as [number, number][], length: 5 },
    ];
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [{ guess: 'EAGLE', codes: ['G', 'R', 'R', 'R', 'R'] }]);
    rawHistory.set(1, []);
    rawHistory.set(2, [{ guess: 'ROTOR', codes: ['Y', 'R', 'R', 'R', 'R'] }]);
    rawHistory.set(3, [{ guess: 'MANGO', codes: ['B', 'R', 'R', 'R', 'R'] }]);

    const fullMap = buildFullIntersectionMap(compactSlots);
    const cross = buildCrossHistoryEntries(rawHistory, fullMap, compactSlots);

    const t1Entries = cross.get(1) ?? [];
    expect(t1Entries).toHaveLength(1);
    expect(t1Entries[0]).toEqual({
      guess: 'ER M ',
      codes: ['G', 'Y', '_', 'B', '_'],
    });
  });

  it('keeps conflicting shadow fragments at the same position in separate rows', () => {
    const conflictSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2], [0, 3]] as [number, number][], length: 4 },
      { targetIndex: 1, coords: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3]] as [number, number][], length: 5 },
    ];
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [
      { guess: 'MATS', codes: ['R', 'R', 'R', 'Y'] },
      { guess: 'MATT', codes: ['R', 'R', 'R', 'B'] },
      { guess: 'MATR', codes: ['R', 'R', 'R', 'G'] },
    ]);

    const fullMap = buildFullIntersectionMap(conflictSlots);
    const cross = buildCrossHistoryEntries(rawHistory, fullMap, conflictSlots);

    const t1Entries = cross.get(1) ?? [];
    expect(t1Entries).toHaveLength(3);
    expect(t1Entries.map((entry) => entry.guess)).toEqual(['S    ', 'T    ', 'R    ']);
    expect(t1Entries.map((entry) => entry.codes)).toEqual([
      ['Y', '_', '_', '_', '_'],
      ['B', '_', '_', '_', '_'],
      ['G', '_', '_', '_', '_'],
    ]);
  });

  it('packs mixed shadow fragments into multiple stable rows when only some positions conflict', () => {
    const mixedSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] as [number, number][], length: 5 },
      { targetIndex: 1, coords: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] as [number, number][], length: 5 },
      { targetIndex: 2, coords: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] as [number, number][], length: 5 },
      { targetIndex: 3, coords: [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] as [number, number][], length: 5 },
      { targetIndex: 4, coords: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]] as [number, number][], length: 5 },
    ];
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [{ guess: 'EAGLE', codes: ['G', 'R', 'R', 'R', 'R'] }]);
    rawHistory.set(1, []);
    rawHistory.set(2, [{ guess: 'ROTOR', codes: ['Y', 'R', 'R', 'R', 'R'] }]);
    rawHistory.set(3, []);
    rawHistory.set(4, [
      { guess: 'STONE', codes: ['B', 'R', 'R', 'R', 'R'] },
      { guess: 'THORN', codes: ['G', 'R', 'R', 'R', 'R'] },
    ]);

    const fullMap = buildFullIntersectionMap(mixedSlots);
    const cross = buildCrossHistoryEntries(rawHistory, fullMap, mixedSlots);

    const t1Entries = cross.get(1) ?? [];
    expect(t1Entries).toHaveLength(2);
    expect(t1Entries[0]).toEqual({ guess: 'E   S', codes: ['G', '_', '_', '_', 'B'] });
    expect(t1Entries[1]).toEqual({ guess: '    T', codes: ['_', '_', '_', '_', 'G'] });

    const t2Entries = cross.get(2) ?? [];
    expect(t2Entries).toHaveLength(2);
    expect(t2Entries[0]).toEqual({ guess: 'A   T', codes: ['R', '_', '_', '_', 'R'] });
    expect(t2Entries[1]).toEqual({ guess: '    H', codes: ['_', '_', '_', '_', 'R'] });
  });

  it('merges identical overlapping shadow evidence into one row', () => {
    const overlapSlots = [
      { targetIndex: 0, coords: [[0, 2], [1, 2], [2, 2], [3, 2]] as [number, number][], length: 4 },
      { targetIndex: 1, coords: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] as [number, number][], length: 5 },
    ];
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [
      { guess: 'MATE', codes: ['R', 'R', 'R', 'B'] },
      { guess: 'HOPE', codes: ['R', 'R', 'R', 'B'] },
    ]);

    const fullMap = buildFullIntersectionMap(overlapSlots);
    const cross = buildCrossHistoryEntries(rawHistory, fullMap, overlapSlots);

    const t1Entries = cross.get(1) ?? [];
    expect(t1Entries).toHaveLength(1);
    expect(t1Entries[0]).toEqual({ guess: '  E  ', codes: ['_', '_', 'B', '_', '_'] });
  });

  it('upgrades same-letter overlapping shadow evidence to the strongest code', () => {
    const overlapSlots = [
      { targetIndex: 0, coords: [[0, 2], [1, 2], [2, 2], [3, 2]] as [number, number][], length: 4 },
      { targetIndex: 1, coords: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] as [number, number][], length: 5 },
    ];
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [
      { guess: 'MATE', codes: ['R', 'R', 'R', 'B'] },
      { guess: 'HOPE', codes: ['R', 'R', 'R', 'Y'] },
    ]);

    const fullMap = buildFullIntersectionMap(overlapSlots);
    const cross = buildCrossHistoryEntries(rawHistory, fullMap, overlapSlots);

    const t1Entries = cross.get(1) ?? [];
    expect(t1Entries).toHaveLength(1);
    expect(t1Entries[0]).toEqual({ guess: '  E  ', codes: ['_', '_', 'Y', '_', '_'] });
  });

  it('merges compatible multi-letter sparse rows', () => {
    const multiSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 2]] as [number, number][], length: 5 },
      { targetIndex: 1, coords: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] as [number, number][], length: 5 },
      { targetIndex: 2, coords: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] as [number, number][], length: 5 },
    ];
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [{ guess: 'PLANT', codes: ['G', 'R', 'Y', 'R', 'R'] }]);
    rawHistory.set(1, []);
    rawHistory.set(2, [{ guess: 'MANGO', codes: ['B', 'R', 'R', 'R', 'R'] }]);

    const fullMap = buildFullIntersectionMap(multiSlots);
    const cross = buildCrossHistoryEntries(rawHistory, fullMap, multiSlots);

    const t1Entries = cross.get(1) ?? [];
    expect(t1Entries).toHaveLength(1);
    expect(t1Entries[0]).toEqual({ guess: 'PA M ', codes: ['G', 'Y', '_', 'B', '_'] });

    expect(cross.get(2)).toBeUndefined();
  });

  it('returns empty map when there are no intersections', () => {
    const noIntersectionSlots = [
      { targetIndex: 0, coords: [[0, 0], [0, 1]] as [number, number][], length: 2 },
      { targetIndex: 1, coords: [[1, 0], [1, 1]] as [number, number][], length: 2 },
    ];
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [{ guess: 'AB', codes: ['G', 'R'] }]);

    const fullMap = buildFullIntersectionMap(noIntersectionSlots);
    const cross = buildCrossHistoryEntries(rawHistory, fullMap, noIntersectionSlots);

    expect(cross.size).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Unit tests for buildGatedCrossHistoryEntries                       */
/* ------------------------------------------------------------------ */

describe('buildGatedCrossHistoryEntries', () => {
  // Across: target 0 = "TREE" at row 0, cols 0-3
  // Down:   target 1 = "RIVER" at col 1, rows 0-4
  // Cross at (0,1): target 0 pos 1 ↔ target 1 pos 0
  const wordSlots = [
    { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2], [0, 3]] as [number, number][], length: 4 },
    { targetIndex: 1, coords: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] as [number, number][], length: 5 },
  ];

  it('suppresses cross-history from the blocked source target', () => {
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [{ guess: 'TREE', codes: ['G', 'G', 'G', 'R'] }]);
    rawHistory.set(1, []);

    const fullMap = buildFullIntersectionMap(wordSlots);

    // Without blocking: target 1 should get a shadow entry from target 0
    const unblocked = buildGatedCrossHistoryEntries(rawHistory, fullMap, wordSlots, null);
    expect(unblocked.get(1)?.length).toBe(1);

    // With target 0 blocked: target 1 should NOT get shadow entries from target 0
    const blocked = buildGatedCrossHistoryEntries(rawHistory, fullMap, wordSlots, 0);
    expect(blocked.get(1)).toBeUndefined();
  });

  it('still allows cross-history from non-blocked targets', () => {
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [{ guess: 'TREE', codes: ['G', 'G', 'G', 'R'] }]);
    rawHistory.set(1, [{ guess: 'RIVER', codes: ['Y', 'G', 'B', 'R', 'G'] }]);

    const fullMap = buildFullIntersectionMap(wordSlots);

    // Block target 0: target 1's cross-history from target 0 is suppressed,
    // but target 0 still gets cross-history from target 1
    const result = buildGatedCrossHistoryEntries(rawHistory, fullMap, wordSlots, 0);
    expect(result.get(0)?.length).toBe(1); // target 0 still gets shadow from target 1
    expect(result.get(1)).toBeUndefined();  // target 1's shadow from target 0 is blocked
  });

  it('passes through all cross-history when blockedSourceTarget is null', () => {
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [{ guess: 'TREE', codes: ['G', 'G', 'G', 'R'] }]);
    rawHistory.set(1, []);

    const fullMap = buildFullIntersectionMap(wordSlots);

    const result = buildGatedCrossHistoryEntries(rawHistory, fullMap, wordSlots, null);
    const ungated = buildCrossHistoryEntries(rawHistory, fullMap, wordSlots);

    // Should produce identical results
    expect(result.get(1)?.[0].guess).toBe(ungated.get(1)?.[0].guess);
    expect(result.get(1)?.[0].codes).toEqual(ungated.get(1)?.[0].codes);
  });

  it('keeps multi-row packed shadow output gated to non-blocked source targets', () => {
    const conflictSlots = [
      { targetIndex: 0, coords: [[0, 4], [1, 4], [2, 4], [3, 4]] as [number, number][], length: 4 },
      { targetIndex: 1, coords: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] as [number, number][], length: 5 },
      { targetIndex: 2, coords: [[3, 1], [4, 1], [5, 1], [6, 1]] as [number, number][], length: 4 },
    ];
    const rawHistory = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistory.set(0, [
      { guess: 'MATS', codes: ['R', 'R', 'R', 'Y'] },
      { guess: 'MATT', codes: ['R', 'R', 'R', 'B'] },
    ]);
    rawHistory.set(2, [{ guess: 'TONE', codes: ['G', 'R', 'R', 'R'] }]);

    const fullMap = buildFullIntersectionMap(conflictSlots);

    const unblocked = buildGatedCrossHistoryEntries(rawHistory, fullMap, conflictSlots, null);
    expect(unblocked.get(1)?.map((entry) => entry.guess)).toEqual([' T  S', '    T']);

    const blocked = buildGatedCrossHistoryEntries(rawHistory, fullMap, conflictSlots, 0);
    expect(blocked.get(1)).toEqual([{ guess: ' T   ', codes: ['_', 'G', '_', '_', '_'] }]);
  });
});

describe('canonical board tiles', () => {
  it('keeps steady-state ownership deterministic and reveal ownership temporary', () => {
    const latestNativeGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'AB', codes: ['Y', 'R'], sourceIndex: 0, locked: false },
      1: { guess: 'CD', codes: ['R', 'R'], sourceIndex: 0, locked: false },
    };
    const wordSlots = [
      { targetIndex: 0, direction: 'A' as const, coords: [[0, 0], [0, 1]] },
      { targetIndex: 1, direction: 'D' as const, coords: [[0, 0], [1, 0]] },
    ];

    const { boardTilesByCoord, boardDiagnostics } = buildBoardTilesByCoord(
      latestNativeGuessByTarget,
      wordSlots,
      new Map(),
    );

    expect(boardDiagnostics).toEqual([]);
    expect(boardTilesByCoord.get('0:0')?.steadyState).toMatchObject({
      targetIndex: 0,
      letter: 'A',
      code: 'Y',
      direction: 'A',
      source: 'native',
    });

    const steadyTileMap = buildTileRevealMapFromBoardTiles(boardTilesByCoord, null);
    expect(steadyTileMap?.get('0:0')).toMatchObject({
      primaryTargetIndex: 0,
      letter: 'A',
      primaryCode: 'Y',
      shouldAnimate: false,
    });

    const revealTileMap = buildTileRevealMapFromBoardTiles(boardTilesByCoord, 1);
    expect(revealTileMap?.get('0:0')).toMatchObject({
      primaryTargetIndex: 1,
      letter: 'C',
      primaryCode: 'R',
      shouldAnimate: true,
    });
  });

  it('fails fast when confirmed green truth conflicts with a native green', () => {
    const latestNativeGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'AB', codes: ['G', 'R'], sourceIndex: 0, locked: false },
    };
    const wordSlots = [
      { targetIndex: 0, direction: 'A' as const, coords: [[0, 0], [0, 1]] },
    ];

    expect(() =>
      buildBoardTilesByCoord(
        latestNativeGuessByTarget,
        wordSlots,
        new Map<string, string>([['0:0', 'Z']]),
      ),
    ).toThrow(/conflicting green truth/i);
  });

  it('gives non-green shared-cell ownership to the currently selected word and restores it when selection changes', () => {
    const latestLiteralNativeGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'HOPE', codes: ['R', 'R', 'R', 'R'], sourceIndex: 0, locked: false },
      1: { guess: 'HOUSE', codes: ['R', 'R', 'R', 'R', 'R'], sourceIndex: 0, locked: false },
    };
    const wordSlots = [
      { targetIndex: 0, direction: 'A' as const, coords: [[2, 0], [2, 1], [2, 2], [2, 3]] },
      { targetIndex: 1, direction: 'D' as const, coords: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] },
    ];

    const { boardTilesByCoord } = buildBoardTilesByCoord(
      latestLiteralNativeGuessByTarget,
      wordSlots,
      new Map(),
    );

    const hopeSelected = buildTileRevealMapFromBoardTiles(boardTilesByCoord, null, 0);
    expect(hopeSelected?.get('2:1')).toMatchObject({
      primaryTargetIndex: 0,
      letter: 'O',
      primaryCode: 'R',
      shouldAnimate: false,
    });

    const houseSelected = buildTileRevealMapFromBoardTiles(boardTilesByCoord, null, 1);
    expect(houseSelected?.get('2:1')).toMatchObject({
      primaryTargetIndex: 1,
      letter: 'U',
      primaryCode: 'R',
      shouldAnimate: false,
    });

    const hopeReselected = buildTileRevealMapFromBoardTiles(boardTilesByCoord, null, 0);
    expect(hopeReselected?.get('2:1')).toMatchObject({
      primaryTargetIndex: 0,
      letter: 'O',
      primaryCode: 'R',
      shouldAnimate: false,
    });
  });

  it('keeps green-locked shared cells stable across selected-word switches', () => {
    const latestLiteralNativeGuessByTarget: DisplayGuessByTarget = {
      0: { guess: 'HOPE', codes: ['R', 'R', 'R', 'R'], sourceIndex: 0, locked: false },
      1: { guess: 'HOUSE', codes: ['R', 'R', 'R', 'R', 'R'], sourceIndex: 0, locked: false },
    };
    const wordSlots = [
      { targetIndex: 0, direction: 'A' as const, coords: [[2, 0], [2, 1], [2, 2], [2, 3]] },
      { targetIndex: 1, direction: 'D' as const, coords: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] },
    ];

    const { boardTilesByCoord } = buildBoardTilesByCoord(
      latestLiteralNativeGuessByTarget,
      wordSlots,
      new Map<string, string>([['2:1', 'O']]),
    );

    expect(buildTileRevealMapFromBoardTiles(boardTilesByCoord, null, 0)?.get('2:1')).toMatchObject({
      letter: 'O',
      primaryCode: 'G',
      shouldAnimate: false,
    });
    expect(buildTileRevealMapFromBoardTiles(boardTilesByCoord, null, 1)?.get('2:1')).toMatchObject({
      letter: 'O',
      primaryCode: 'G',
      shouldAnimate: false,
    });
  });

  it('uses the selected target at coord 5:4 for the logged target-4 across / target-1 down fixture', () => {
    const latestNativeGuessByTarget: DisplayGuessByTarget = {
      1: { guess: 'POND', codes: ['R', 'R', 'R', 'R'], sourceIndex: 0, locked: false },
      4: { guess: 'STKAIN', codes: ['R', 'R', 'R', 'R', 'R', 'R'], sourceIndex: 0, locked: false },
    };
    const wordSlots = [
      { targetIndex: 4, direction: 'A' as const, coords: [[5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 7]] },
      { targetIndex: 1, direction: 'D' as const, coords: [[5, 4], [6, 4], [7, 4], [8, 4]] },
    ];

    const { boardTilesByCoord, boardDiagnostics } = buildBoardTilesByCoord(
      latestNativeGuessByTarget,
      wordSlots,
      new Map(),
    );

    expect(boardDiagnostics).toEqual([]);
    expect(boardTilesByCoord.get('5:4')?.candidateEntries).toEqual([
      expect.objectContaining({ targetIndex: 4, positionInWord: 2, letter: 'K', code: 'R' }),
      expect.objectContaining({ targetIndex: 1, positionInWord: 0, letter: 'P', code: 'R' }),
    ]);
    expect(boardTilesByCoord.get('5:4')?.steadyState).toMatchObject({
      targetIndex: 4,
      positionInWord: 2,
      letter: 'K',
      code: 'R',
    });

    expect(buildTileRevealMapFromBoardTiles(boardTilesByCoord, null, 4)?.get('5:4')).toMatchObject({
      primaryTargetIndex: 4,
      positionInWord: 2,
      letter: 'K',
      primaryCode: 'R',
      shouldAnimate: false,
    });
    expect(buildTileRevealMapFromBoardTiles(boardTilesByCoord, null, 1)?.get('5:4')).toMatchObject({
      primaryTargetIndex: 1,
      positionInWord: 0,
      letter: 'P',
      primaryCode: 'R',
      shouldAnimate: false,
    });
    expect(buildTileRevealMapFromBoardTiles(boardTilesByCoord, null, 4)?.get('5:4')).toMatchObject({
      primaryTargetIndex: 4,
      positionInWord: 2,
      letter: 'K',
      primaryCode: 'R',
      shouldAnimate: false,
    });
  });

  it('keeps a newly-green shared cell green while still surfacing reveal animation for the submitted target', () => {
    const latestNativeGuessByTarget: DisplayGuessByTarget = {
      1: { guess: 'POND', codes: ['G', 'R', 'R', 'R'], sourceIndex: 0, locked: false },
      4: { guess: 'STPAIN', codes: ['R', 'R', 'G', 'R', 'R', 'R'], sourceIndex: 0, locked: false },
    };
    const wordSlots = [
      { targetIndex: 4, direction: 'A' as const, coords: [[5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 7]] },
      { targetIndex: 1, direction: 'D' as const, coords: [[5, 4], [6, 4], [7, 4], [8, 4]] },
    ];

    const { boardTilesByCoord } = buildBoardTilesByCoord(
      latestNativeGuessByTarget,
      wordSlots,
      new Map<string, string>([['5:4', 'P']]),
    );

    expect(boardTilesByCoord.get('5:4')?.steadyState).toMatchObject({
      letter: 'P',
      code: 'G',
    });
    expect(buildTileRevealMapFromBoardTiles(boardTilesByCoord, 4, 4)?.get('5:4')).toMatchObject({
      letter: 'P',
      primaryCode: 'G',
      shouldAnimate: true,
    });
    expect(buildTileRevealMapFromBoardTiles(boardTilesByCoord, null, 1)?.get('5:4')).toMatchObject({
      letter: 'P',
      primaryCode: 'G',
      shouldAnimate: false,
    });
  });
});
