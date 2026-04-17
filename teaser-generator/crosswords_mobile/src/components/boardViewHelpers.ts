import {
  buildTileRevealMapFromBoardTiles,
  buildTileRevealMapFromDisplayGuess,
  type BoardTile,
  type CanonicalBoardSlot,
  type TileRevealInfo,
} from '@src/lib/boardRevealMap';
import type { DisplayGuessByTarget } from '@src/lib/guessDisplayState';

export type SegmentPosition = {
  segmentIndex: number;
  positionInWord: number;
};

export type CanonicalSlotCoords = {
  coords?: number[][];
};

export function normalizeBoardTilesByViewCoords(
  boardTilesByCoord: Map<string, BoardTile> | undefined,
  coordToSegmentPosition: Map<string, SegmentPosition[]>,
  canonicalSlots: CanonicalSlotCoords[],
): Map<string, BoardTile> | undefined {
  if (!boardTilesByCoord) return undefined;

  const normalized = new Map<string, BoardTile>();
  for (const [viewCoordKey, positions] of coordToSegmentPosition.entries()) {
    const firstPosition = positions[0];
    if (!firstPosition) continue;

    const originalCoord =
      canonicalSlots[firstPosition.segmentIndex]?.coords?.[firstPosition.positionInWord];
    if (!originalCoord) continue;

    const originalCoordKey = `${originalCoord[0]}:${originalCoord[1]}`;
    const tile = boardTilesByCoord.get(originalCoordKey);
    if (tile) {
      normalized.set(viewCoordKey, tile);
    }
  }

  return normalized;
}

type ResolveBoardTileRevealMapArgs = {
  useAtlanticMode: boolean;
  normalizedBoardTilesByCoord: Map<string, BoardTile> | undefined;
  revealTargetIndex?: number | null;
  activeTargetIndex?: number | null;
  displayGuessByTarget: DisplayGuessByTarget;
  coordToSegmentPosition: Map<string, SegmentPosition[]>;
  slotIndexToTargetIndex: Map<number, number>;
  canonicalSlots: CanonicalBoardSlot[];
};

export function resolveBoardTileRevealMap({
  useAtlanticMode,
  normalizedBoardTilesByCoord,
  revealTargetIndex,
  activeTargetIndex,
  displayGuessByTarget,
  coordToSegmentPosition,
  slotIndexToTargetIndex,
  canonicalSlots,
}: ResolveBoardTileRevealMapArgs): Map<string, TileRevealInfo> | undefined {
  if (useAtlanticMode) {
    if (!normalizedBoardTilesByCoord) {
      return undefined;
    }

    return buildTileRevealMapFromBoardTiles(
      normalizedBoardTilesByCoord,
      revealTargetIndex,
      activeTargetIndex,
    );
  }

  if (normalizedBoardTilesByCoord) {
    return buildTileRevealMapFromBoardTiles(
      normalizedBoardTilesByCoord,
      revealTargetIndex,
      activeTargetIndex,
    );
  }

  return buildTileRevealMapFromDisplayGuess(
    displayGuessByTarget,
    coordToSegmentPosition,
    slotIndexToTargetIndex,
    canonicalSlots,
    activeTargetIndex,
    revealTargetIndex,
  );
}

type AtlanticTileRenderStateArgs = {
  hasFeedback: boolean;
  hasSolved: boolean;
  shouldAnimate: boolean;
};

export type AtlanticTileRenderState = {
  mode: 'feedback' | 'solved' | 'reveal' | 'settled';
  applyLetterCrossFade: boolean;
  showCommittedLetterLayer: boolean;
};

export function resolveAtlanticTileRenderState({
  hasFeedback,
  hasSolved,
  shouldAnimate,
}: AtlanticTileRenderStateArgs): AtlanticTileRenderState {
  if (hasFeedback) {
    return {
      mode: 'feedback',
      applyLetterCrossFade: false,
      showCommittedLetterLayer: false,
    };
  }

  if (hasSolved) {
    return {
      mode: 'solved',
      applyLetterCrossFade: false,
      showCommittedLetterLayer: false,
    };
  }

  if (shouldAnimate) {
    return {
      mode: 'reveal',
      applyLetterCrossFade: true,
      showCommittedLetterLayer: true,
    };
  }

  return {
    mode: 'settled',
    applyLetterCrossFade: false,
    showCommittedLetterLayer: false,
  };
}
