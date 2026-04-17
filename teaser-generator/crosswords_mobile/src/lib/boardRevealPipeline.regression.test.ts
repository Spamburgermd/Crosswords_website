/**
 * Regression tests for the canonical board snapshot pipeline.
 */

import {
  buildFullIntersectionMap,
  buildIntersectionMap,
  buildTileRevealMapFromBoardTiles,
} from './boardRevealMap';
import { buildBoardMergedHistory, buildBoardSplitHistory } from './boardHistoryPipeline';
import { resolveDisplayGuessByTarget } from './guessDisplayState';

function buildStrainAlterFixture() {
  const wordSlots = [
    { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] as [number, number][], length: 6 },
    { targetIndex: 1, coords: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] as [number, number][], length: 5 },
  ];

  return {
    wordSlots,
    intersectionMap: buildIntersectionMap(wordSlots),
    fullIntersectionMap: buildFullIntersectionMap(wordSlots),
  };
}

function buildPipelineArgs(
  fixture: ReturnType<typeof buildStrainAlterFixture>,
  rawHistoryByTarget: Map<number, { guess: string; codes: string[] }[]>,
  opts?: { blockedSourceTarget?: number | null; targetWords?: string[]; solvedFlags?: boolean[] },
) {
  return {
    rawHistoryByTarget,
    wordSlots: fixture.wordSlots,
    targetWords: opts?.targetWords ?? ['PLANET', 'ALTER'],
    solvedFlags: opts?.solvedFlags ?? [false, false],
    intersectionMap: fixture.intersectionMap,
    fullIntersectionMap: fixture.fullIntersectionMap,
    blockedSourceTarget: opts?.blockedSourceTarget ?? null,
  };
}

describe('Legacy path: STRAIN/ALTER contamination (proves old bug exists)', () => {
  it('legacy resolveDisplayGuessByTarget picks a shadow row when a target has no native guesses', () => {
    const fixture = buildStrainAlterFixture();
    const rawHistoryByTarget = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistoryByTarget.set(0, [{ guess: 'STRAIN', codes: ['R', 'R', 'Y', 'R', 'R', 'R'] }]);
    rawHistoryByTarget.set(1, []);

    const merged = buildBoardMergedHistory(buildPipelineArgs(fixture, rawHistoryByTarget));
    const display = resolveDisplayGuessByTarget(merged, {});

    expect(display[1]).not.toBeNull();
    expect(display[1]?.guess).toBe('R    ');
  });
});

describe('Canonical board snapshot: STRAIN/ALTER', () => {
  it('excludes shadow-only targets from native resurfacing while preserving their shadow rows', () => {
    const fixture = buildStrainAlterFixture();
    const rawHistoryByTarget = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistoryByTarget.set(0, [{ guess: 'STRAIN', codes: ['R', 'R', 'Y', 'R', 'R', 'R'] }]);
    rawHistoryByTarget.set(1, []);

    const result = buildBoardSplitHistory(buildPipelineArgs(fixture, rawHistoryByTarget));

    expect(result.wordSnapshotsByTarget.get(1)?.latestNativeRow).toBeNull();
    expect(result.wordSnapshotsByTarget.get(1)?.shadowHistoryRows.length ?? 0).toBeGreaterThan(0);
    expect(result.wordSnapshotsByTarget.get(0)?.latestNativeRow?.guess).toBe('STRAIN');
  });

  it('renders STRAIN as the steady-state owner when ALTER has no native guess', () => {
    const fixture = buildStrainAlterFixture();
    const rawHistoryByTarget = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistoryByTarget.set(0, [{ guess: 'STRAIN', codes: ['R', 'R', 'Y', 'R', 'R', 'R'] }]);
    rawHistoryByTarget.set(1, []);

    const result = buildBoardSplitHistory(buildPipelineArgs(fixture, rawHistoryByTarget));
    const tileMap = buildTileRevealMapFromBoardTiles(result.boardTilesByCoord, null, 0);

    expect(tileMap?.get('0:0')).toMatchObject({ primaryTargetIndex: 0, letter: 'S', primaryCode: 'R' });
    expect(tileMap?.get('0:1')).toMatchObject({ primaryTargetIndex: 0, letter: 'T', primaryCode: 'R' });
    expect(tileMap?.get('0:2')).toMatchObject({ primaryTargetIndex: 0, letter: 'R', primaryCode: 'Y' });
  });

  it('lets the active target own a shared non-green cell', () => {
    const fixture = buildStrainAlterFixture();
    const rawHistoryByTarget = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistoryByTarget.set(0, [{ guess: 'STRAIN', codes: ['R', 'R', 'Y', 'R', 'R', 'R'] }]);
    rawHistoryByTarget.set(1, [{ guess: 'ABOUT', codes: ['R', 'R', 'R', 'R', 'R'] }]);

    const result = buildBoardSplitHistory(buildPipelineArgs(fixture, rawHistoryByTarget));

    expect(buildTileRevealMapFromBoardTiles(result.boardTilesByCoord, null, 0)?.get('0:2')).toMatchObject({
      primaryTargetIndex: 0,
      letter: 'R',
    });
    expect(buildTileRevealMapFromBoardTiles(result.boardTilesByCoord, null, 1)?.get('0:2')).toMatchObject({
      primaryTargetIndex: 1,
      letter: 'A',
    });
  });

  it('keeps green precedence over selected-word ownership', () => {
    const fixture = buildStrainAlterFixture();
    const rawHistoryByTarget = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistoryByTarget.set(0, [{ guess: 'STRAIN', codes: ['R', 'R', 'Y', 'R', 'R', 'R'] }]);
    rawHistoryByTarget.set(1, [{ guess: 'ALTER', codes: ['G', 'R', 'G', 'R', 'R'] }]);

    const result = buildBoardSplitHistory(buildPipelineArgs(fixture, rawHistoryByTarget));
    const intersection = buildTileRevealMapFromBoardTiles(result.boardTilesByCoord, null, 0)?.get('0:2');

    expect(intersection?.primaryCode).toBe('G');
    expect(intersection?.letter).toBe('A');
  });

  it('lets reveal-target precedence temporarily override the active owner without changing steady-state truth', () => {
    const fixture = buildStrainAlterFixture();
    const rawHistoryByTarget = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistoryByTarget.set(0, [{ guess: 'STRAIN', codes: ['R', 'R', 'Y', 'R', 'R', 'R'] }]);
    rawHistoryByTarget.set(1, [{ guess: 'ALTER', codes: ['R', 'R', 'B', 'R', 'R'] }]);

    const result = buildBoardSplitHistory(buildPipelineArgs(fixture, rawHistoryByTarget));

    const revealTile = buildTileRevealMapFromBoardTiles(result.boardTilesByCoord, 1, 0)?.get('0:2');
    const settledTile = buildTileRevealMapFromBoardTiles(result.boardTilesByCoord, null, 0)?.get('0:2');

    expect(revealTile).toMatchObject({ primaryTargetIndex: 1, shouldAnimate: true });
    expect(settledTile).toMatchObject({ primaryTargetIndex: 0, shouldAnimate: false });
    expect(result.boardTilesByCoord.get('0:2')?.steadyState.targetIndex).toBe(0);
  });

  it('keeps latest-native board repaint stable regardless of card row view state', () => {
    const fixture = buildStrainAlterFixture();
    const rawHistoryByTarget = new Map<number, { guess: string; codes: string[] }[]>();
    rawHistoryByTarget.set(0, [
      { guess: 'STRAIN', codes: ['R', 'R', 'Y', 'R', 'R', 'R'] },
      { guess: 'PLAINS', codes: ['G', 'R', 'R', 'R', 'R', 'R'] },
    ]);
    rawHistoryByTarget.set(1, [{ guess: 'ALTER', codes: ['R', 'R', 'B', 'R', 'R'] }]);

    const nativeLockedResult = buildBoardSplitHistory(buildPipelineArgs(fixture, rawHistoryByTarget));
    const shadowPreviewResult = buildBoardSplitHistory(buildPipelineArgs(fixture, rawHistoryByTarget));

    expect(nativeLockedResult.wordSnapshotsByTarget.get(0)?.latestNativeRow).toMatchObject({
      guess: 'PLAINS',
      locked: false,
      provenance: 'native',
    });
    expect(shadowPreviewResult.wordSnapshotsByTarget.get(0)?.latestNativeRow).toMatchObject({
      guess: 'PLAINS',
      locked: false,
      provenance: 'native',
    });
    expect(buildTileRevealMapFromBoardTiles(nativeLockedResult.boardTilesByCoord, null, 0)?.get('0:2')?.letter).toBe('A');
    expect(buildTileRevealMapFromBoardTiles(shadowPreviewResult.boardTilesByCoord, null, 0)?.get('0:2')?.letter).toBe('A');
  });
});
