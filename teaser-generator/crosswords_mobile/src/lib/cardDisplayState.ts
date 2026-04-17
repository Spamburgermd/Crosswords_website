import {
  buildConfirmedLettersByTargetFromCoordMap,
  type CoordinateWordSlot,
} from './confirmedBoardLetters';
import type { CanonicalWordSnapshot } from './boardHistoryPipeline';
import {
  getGuessViewState,
  type DisplayGuessByTarget,
  type DisplayGuessSnapshot,
  type GuessLike,
  type GuessViewStateByTarget,
} from './guessDisplayState';

export type CardRowKind = 'native' | 'shadow';

export type CardDetailRow<T extends GuessLike = GuessLike> = T & {
  sourceIndex: number;
  kind: CardRowKind;
  interactive: boolean;
  isPreviewed: boolean;
  isLocked: boolean;
};

export type CardDisplayState<T extends GuessLike = GuessLike> = {
  selectedNativeGuessByTarget: DisplayGuessByTarget<T>;
  detailRowsForSelectedTarget: CardDetailRow<T>[];
  greenPlaceholdersByTarget: Record<number, Record<number, string>>;
  diagnostics: string[];
};

type CardDisplayStateArgs<T extends GuessLike = GuessLike> = {
  wordSnapshotsByTarget: Map<number, CanonicalWordSnapshot & {
    nativeHistoryRows: T[];
    shadowHistoryRows: T[];
  }>;
  guessViewStateByTarget: GuessViewStateByTarget;
  selectedTargetIndex?: number | null;
  confirmedBoardLettersByCoord: Map<string, string>;
  wordSlots: CoordinateWordSlot[];
  strictInvalidViewState?: boolean;
};

function isUsableIndex(index: number | null, guesses: GuessLike[]): index is number {
  return typeof index === 'number' && index >= 0 && index < guesses.length;
}

function findGuessIndexByRowId(guesses: GuessLike[], rowId: string | null | undefined): number | null {
  if (typeof rowId !== 'string' || rowId.length === 0) return null;
  const guessIndex = guesses.findIndex((guess) => guess.rowId === rowId);
  return guessIndex >= 0 ? guessIndex : null;
}

function rowKindForEntry<T extends GuessLike>(entry: T): CardRowKind {
  const provenance = (entry as T & { provenance?: string }).provenance;
  return provenance === 'shadow' ? 'shadow' : 'native';
}

function isStrictInvalidViewStateEnabled(explicitSetting: boolean | undefined): boolean {
  if (typeof explicitSetting === 'boolean') {
    return explicitSetting;
  }

  return Boolean((globalThis as { __DEV__?: boolean }).__DEV__);
}

function resolveNativeDisplayGuessForTarget<T extends GuessLike = GuessLike>(
  targetIndex: number,
  wordSnapshotsByTarget: Map<number, CanonicalWordSnapshot & {
    nativeHistoryRows: T[];
    shadowHistoryRows: T[];
  }>,
  guessViewStateByTarget: GuessViewStateByTarget,
  diagnostics: string[],
  strictInvalidViewState: boolean,
): DisplayGuessSnapshot<T> | null {
  const snapshot = wordSnapshotsByTarget.get(targetIndex);
  const nativeGuesses = snapshot?.nativeHistoryRows ?? [];
  if (nativeGuesses.length === 0) return null;

  const shadowGuesses = snapshot?.shadowHistoryRows ?? [];
  const { previewIndex, lockedIndex, previewRowId, lockedRowId } = getGuessViewState(
    guessViewStateByTarget,
    targetIndex,
  );

  const previewShadowIndex = findGuessIndexByRowId(shadowGuesses, previewRowId);
  const lockedShadowIndex = findGuessIndexByRowId(shadowGuesses, lockedRowId);

  if (previewShadowIndex != null) {
    const message = `Card display state cannot preview shadow row "${previewRowId}" for target ${targetIndex}.`;
    if (strictInvalidViewState) {
      throw new Error(message);
    }
    diagnostics.push(message);
  }

  if (lockedShadowIndex != null) {
    const message = `Card display state cannot lock shadow row "${lockedRowId}" for target ${targetIndex}.`;
    if (strictInvalidViewState) {
      throw new Error(message);
    }
    diagnostics.push(message);
  }

  const resolvedLockedIndex =
    findGuessIndexByRowId(nativeGuesses, lockedRowId) ??
    (isUsableIndex(lockedIndex, nativeGuesses) ? lockedIndex : null);
  const resolvedPreviewIndex =
    findGuessIndexByRowId(nativeGuesses, previewRowId) ??
    (isUsableIndex(previewIndex, nativeGuesses) ? previewIndex : null);

  const preferredIndex = resolvedLockedIndex ?? resolvedPreviewIndex ?? nativeGuesses.length - 1;
  const selectedGuess = nativeGuesses[preferredIndex];

  return {
    ...selectedGuess,
    sourceIndex: preferredIndex,
    locked: preferredIndex === resolvedLockedIndex,
  };
}

function buildDetailRowsForTarget<T extends GuessLike = GuessLike>(
  targetIndex: number,
  wordSnapshotsByTarget: Map<number, CanonicalWordSnapshot & {
    nativeHistoryRows: T[];
    shadowHistoryRows: T[];
  }>,
  guessViewStateByTarget: GuessViewStateByTarget,
  diagnostics: string[],
  strictInvalidViewState: boolean,
): CardDetailRow<T>[] {
  const snapshot = wordSnapshotsByTarget.get(targetIndex);
  const nativeGuesses = snapshot?.nativeHistoryRows ?? [];
  const shadowGuesses = snapshot?.shadowHistoryRows ?? [];
  const combinedGuesses = [...shadowGuesses, ...nativeGuesses];
  const { previewIndex, lockedIndex, previewRowId, lockedRowId } = getGuessViewState(
    guessViewStateByTarget,
    targetIndex,
  );

  const previewShadowIndex = findGuessIndexByRowId(shadowGuesses, previewRowId);
  const lockedShadowIndex = findGuessIndexByRowId(shadowGuesses, lockedRowId);

  if (previewShadowIndex != null) {
    const message = `Card detail rows cannot mark shadow row "${previewRowId}" as previewed for target ${targetIndex}.`;
    if (strictInvalidViewState) {
      throw new Error(message);
    }
    diagnostics.push(message);
  }

  if (lockedShadowIndex != null) {
    const message = `Card detail rows cannot mark shadow row "${lockedRowId}" as locked for target ${targetIndex}.`;
    if (strictInvalidViewState) {
      throw new Error(message);
    }
    diagnostics.push(message);
  }

  const resolvedPreviewIndex =
    findGuessIndexByRowId(nativeGuesses, previewRowId) ??
    (isUsableIndex(previewIndex, nativeGuesses) ? previewIndex : null);
  const resolvedLockedIndex =
    findGuessIndexByRowId(nativeGuesses, lockedRowId) ??
    (isUsableIndex(lockedIndex, nativeGuesses) ? lockedIndex : null);
  const previewedRowId = resolvedPreviewIndex != null ? nativeGuesses[resolvedPreviewIndex]?.rowId ?? null : null;
  const lockedRowIdResolved = resolvedLockedIndex != null ? nativeGuesses[resolvedLockedIndex]?.rowId ?? null : null;

  return combinedGuesses.map((entry, sourceIndex) => {
    const kind = rowKindForEntry(entry);
    return {
      ...entry,
      sourceIndex,
      kind,
      interactive: kind === 'native',
      isPreviewed: kind === 'native' && entry.rowId === previewedRowId,
      isLocked: kind === 'native' && entry.rowId === lockedRowIdResolved,
    };
  });
}

export function buildCardDisplayState<T extends GuessLike = GuessLike>(
  args: CardDisplayStateArgs<T>,
): CardDisplayState<T> {
  const strictInvalidViewState = isStrictInvalidViewStateEnabled(args.strictInvalidViewState);
  const diagnostics: string[] = [];
  const selectedNativeGuessByTarget: DisplayGuessByTarget<T> = {};
  const targetIndexes = new Set<number>();

  for (const targetIndex of args.wordSnapshotsByTarget.keys()) {
    targetIndexes.add(targetIndex);
  }
  for (const targetIndex of Object.keys(args.guessViewStateByTarget)) {
    const numericTargetIndex = Number(targetIndex);
    if (Number.isFinite(numericTargetIndex)) {
      targetIndexes.add(numericTargetIndex);
    }
  }
  for (const slot of args.wordSlots) {
    targetIndexes.add(slot.targetIndex);
  }

  const detailRowsForSelectedTarget =
    typeof args.selectedTargetIndex === 'number'
      ? buildDetailRowsForTarget(
          args.selectedTargetIndex,
          args.wordSnapshotsByTarget,
          args.guessViewStateByTarget,
          diagnostics,
          strictInvalidViewState,
        )
      : [];

  for (const targetIndex of targetIndexes) {
    selectedNativeGuessByTarget[targetIndex] = resolveNativeDisplayGuessForTarget(
      targetIndex,
      args.wordSnapshotsByTarget,
      args.guessViewStateByTarget,
      diagnostics,
      strictInvalidViewState,
    );
  }

  return {
    selectedNativeGuessByTarget,
    detailRowsForSelectedTarget,
    greenPlaceholdersByTarget: buildConfirmedLettersByTargetFromCoordMap(
      args.confirmedBoardLettersByCoord,
      args.wordSlots,
    ),
    diagnostics,
  };
}
