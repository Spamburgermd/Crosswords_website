import { buildBoardTilesByCoord, buildTileRevealMapFromBoardTiles, type BoardTile } from '@src/lib/boardRevealMap';
import type { DisplayGuessByTarget } from '@src/lib/guessDisplayState';

import {
  normalizeBoardTilesByViewCoords,
  resolveBoardTileRevealMap,
  resolveAtlanticTileRenderState,
  type SegmentPosition,
} from './boardViewHelpers';

describe('normalizeBoardTilesByViewCoords', () => {
  it('preserves the logged target-4 across / target-1 down shared-cell ownership at the normalized board coord', () => {
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

    const coordToSegmentPosition = new Map<string, SegmentPosition[]>([
      ['1:0', [{ segmentIndex: 0, positionInWord: 0 }]],
      ['1:1', [{ segmentIndex: 0, positionInWord: 1 }]],
      ['1:2', [
        { segmentIndex: 0, positionInWord: 2 },
        { segmentIndex: 1, positionInWord: 0 },
      ]],
      ['1:3', [{ segmentIndex: 0, positionInWord: 3 }]],
      ['1:4', [{ segmentIndex: 0, positionInWord: 4 }]],
      ['1:5', [{ segmentIndex: 0, positionInWord: 5 }]],
      ['2:2', [{ segmentIndex: 1, positionInWord: 1 }]],
      ['3:2', [{ segmentIndex: 1, positionInWord: 2 }]],
      ['4:2', [{ segmentIndex: 1, positionInWord: 3 }]],
    ]);
    const canonicalSlots = wordSlots.map((slot) => ({ coords: slot.coords }));

    const normalizedBoardTilesByCoord = normalizeBoardTilesByViewCoords(
      boardTilesByCoord,
      coordToSegmentPosition,
      canonicalSlots,
    ) as Map<string, BoardTile>;

    expect(normalizedBoardTilesByCoord.get('1:2')).toBe(boardTilesByCoord.get('5:4'));
    expect(buildTileRevealMapFromBoardTiles(normalizedBoardTilesByCoord, null, 4)?.get('1:2')).toMatchObject({
      primaryTargetIndex: 4,
      letter: 'K',
      primaryCode: 'R',
    });
    expect(buildTileRevealMapFromBoardTiles(normalizedBoardTilesByCoord, null, 1)?.get('1:2')).toMatchObject({
      primaryTargetIndex: 1,
      letter: 'P',
      primaryCode: 'R',
    });
  });
});

describe('resolveAtlanticTileRenderState', () => {
  it('does not cross-fade settled tiles, so a same-color shared-cell selection change can swap letters immediately', () => {
    expect(
      resolveAtlanticTileRenderState({
        hasFeedback: false,
        hasSolved: false,
        shouldAnimate: false,
      }),
    ).toEqual({
      mode: 'settled',
      applyLetterCrossFade: false,
      showCommittedLetterLayer: false,
    });
  });

  it('keeps cross-fade enabled for reveal animations, including newly-green shared cells', () => {
    expect(
      resolveAtlanticTileRenderState({
        hasFeedback: false,
        hasSolved: false,
        shouldAnimate: true,
      }),
    ).toEqual({
      mode: 'reveal',
      applyLetterCrossFade: true,
      showCommittedLetterLayer: true,
    });
  });
});

describe('resolveBoardTileRevealMap', () => {
  it('keeps the live Atlantic path canonical-only when board tiles are present', () => {
    const boardTilesByCoord = new Map<string, BoardTile>([
      [
        '1:2',
        {
          steadyState: {
            letter: 'K',
            code: 'R',
            targetIndex: 4,
            direction: 'A',
            positionInWord: 2,
            source: 'native',
          },
          candidateEntries: [
            {
              letter: 'K',
              code: 'R',
              targetIndex: 4,
              direction: 'A',
              positionInWord: 2,
              source: 'native',
            },
          ],
          isIntersection: false,
          isGreenLocked: false,
        },
      ],
    ]);
    const legacyDisplayGuessByTarget: DisplayGuessByTarget = {
      4: { guess: 'SPRAIN', codes: ['R', 'R', 'R', 'R', 'R', 'R'], sourceIndex: 0, locked: false },
    };

    const tileRevealMap = resolveBoardTileRevealMap({
      useAtlanticMode: true,
      normalizedBoardTilesByCoord: boardTilesByCoord,
      revealTargetIndex: null,
      activeTargetIndex: 4,
      displayGuessByTarget: legacyDisplayGuessByTarget,
      coordToSegmentPosition: new Map(),
      slotIndexToTargetIndex: new Map(),
      canonicalSlots: [],
    });

    expect(tileRevealMap?.get('1:2')).toMatchObject({
      primaryTargetIndex: 4,
      letter: 'K',
      primaryCode: 'R',
    });
  });
});
