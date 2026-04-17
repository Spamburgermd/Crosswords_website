/**
 * src/lib/guessDisplayState.ts
 * ---------------------------------------------
 * Pure helpers that decide which historical guess should be visible for each
 * target word. This keeps preview and lock state separate so the board, list,
 * and detail panel can all read the same answer.
 */

export type GuessLike = {
  guess: string;
  codes: string[];
  rowId?: string | null;
};

export type GuessHistoryByTarget<T extends GuessLike = GuessLike> = Map<number, T[]>;

export type GuessViewState = {
  previewIndex: number | null;
  lockedIndex: number | null;
  previewRowId?: string | null;
  lockedRowId?: string | null;
};

export type GuessViewStateByTarget = Record<number, GuessViewState | undefined>;

export type DisplayGuessSnapshot<T extends GuessLike = GuessLike> = T & {
  sourceIndex: number;
  locked: boolean;
};

export type DisplayGuessByTarget<T extends GuessLike = GuessLike> = Record<number, DisplayGuessSnapshot<T> | null>;

export type DetailHistoryItem<T extends GuessLike = GuessLike> = T & {
  sourceIndex: number;
  isPreviewed: boolean;
  isLocked: boolean;
};

const EMPTY_VIEW_STATE: GuessViewState = {
  previewIndex: null,
  lockedIndex: null,
  previewRowId: null,
  lockedRowId: null,
};

export function getGuessViewState(
  guessViewStateByTarget: GuessViewStateByTarget,
  targetIndex: number,
): GuessViewState {
  return guessViewStateByTarget[targetIndex] ?? EMPTY_VIEW_STATE;
}

function isUsableIndex(index: number | null, guesses: GuessLike[]): index is number {
  return typeof index === 'number' && index >= 0 && index < guesses.length;
}

function findGuessIndexByRowId(guesses: GuessLike[], rowId: string | null | undefined): number | null {
  if (typeof rowId !== 'string' || rowId.length === 0) return null;
  const guessIndex = guesses.findIndex((guess) => guess.rowId === rowId);
  return guessIndex >= 0 ? guessIndex : null;
}

export function toSelectedGuessIndexByWord(
  guessViewStateByTarget: GuessViewStateByTarget,
): Record<number, number | null> {
  const selected: Record<number, number | null> = {};
  for (const [targetIndex, state] of Object.entries(guessViewStateByTarget)) {
    const numericTargetIndex = Number(targetIndex);
    if (!Number.isFinite(numericTargetIndex) || !state) continue;
    selected[numericTargetIndex] = state.previewIndex ?? null;
  }
  return selected;
}

export function resolveDisplayGuessForTarget<T extends GuessLike = GuessLike>(
  targetIndex: number,
  historyByTarget: GuessHistoryByTarget<T>,
  guessViewStateByTarget: GuessViewStateByTarget,
): DisplayGuessSnapshot<T> | null {
  const guesses = historyByTarget.get(targetIndex) ?? [];
  if (guesses.length === 0) return null;

  const { previewIndex, lockedIndex, previewRowId, lockedRowId } = getGuessViewState(
    guessViewStateByTarget,
    targetIndex,
  );
  const resolvedLockedIndex =
    findGuessIndexByRowId(guesses, lockedRowId) ??
    (isUsableIndex(lockedIndex, guesses) ? lockedIndex : null);
  const resolvedPreviewIndex =
    findGuessIndexByRowId(guesses, previewRowId) ??
    (isUsableIndex(previewIndex, guesses) ? previewIndex : null);
  const preferredIndex = resolvedLockedIndex ?? resolvedPreviewIndex ?? guesses.length - 1;
  const selectedGuess = guesses[preferredIndex];

  return {
    ...selectedGuess,
    sourceIndex: preferredIndex,
    locked: preferredIndex === resolvedLockedIndex,
  };
}

export function resolveDisplayGuessByTarget<T extends GuessLike = GuessLike>(
  historyByTarget: GuessHistoryByTarget<T>,
  guessViewStateByTarget: GuessViewStateByTarget,
): DisplayGuessByTarget<T> {
  const resolved: DisplayGuessByTarget<T> = {};
  const targetIndexes = new Set<number>();

  for (const targetIndex of historyByTarget.keys()) {
    targetIndexes.add(targetIndex);
  }
  for (const targetIndex of Object.keys(guessViewStateByTarget)) {
    const numericTargetIndex = Number(targetIndex);
    if (Number.isFinite(numericTargetIndex)) targetIndexes.add(numericTargetIndex);
  }

  for (const targetIndex of targetIndexes) {
    resolved[targetIndex] = resolveDisplayGuessForTarget(targetIndex, historyByTarget, guessViewStateByTarget);
  }

  return resolved;
}

export function resolveLatestGuessForTarget<T extends GuessLike = GuessLike>(
  targetIndex: number,
  historyByTarget: GuessHistoryByTarget<T>,
): DisplayGuessSnapshot<T> | null {
  const guesses = historyByTarget.get(targetIndex) ?? [];
  if (guesses.length === 0) return null;

  const sourceIndex = guesses.length - 1;
  const selectedGuess = guesses[sourceIndex];

  return {
    ...selectedGuess,
    sourceIndex,
    locked: false,
  };
}

export function resolveLatestGuessByTarget<T extends GuessLike = GuessLike>(
  historyByTarget: GuessHistoryByTarget<T>,
): DisplayGuessByTarget<T> {
  const resolved: DisplayGuessByTarget<T> = {};

  for (const targetIndex of historyByTarget.keys()) {
    resolved[targetIndex] = resolveLatestGuessForTarget(targetIndex, historyByTarget);
  }

  return resolved;
}

export function previewGuess(
  guessViewStateByTarget: GuessViewStateByTarget,
  targetIndex: number,
  guessIndex: number,
): GuessViewStateByTarget {
  const current = getGuessViewState(guessViewStateByTarget, targetIndex);

  return {
    ...guessViewStateByTarget,
    [targetIndex]: {
      previewIndex: guessIndex,
      // Previewing a different row should immediately stop pinning the old row.
      lockedIndex: current.lockedIndex === guessIndex ? guessIndex : null,
      previewRowId: null,
      lockedRowId: null,
    },
  };
}

export function previewGuessByRowId(
  guessViewStateByTarget: GuessViewStateByTarget,
  targetIndex: number,
  rowId: string,
): GuessViewStateByTarget {
  const current = getGuessViewState(guessViewStateByTarget, targetIndex);

  return {
    ...guessViewStateByTarget,
    [targetIndex]: {
      previewIndex: null,
      lockedIndex: null,
      previewRowId: rowId,
      lockedRowId: current.lockedRowId === rowId ? rowId : null,
    },
  };
}

export function lockGuess(
  guessViewStateByTarget: GuessViewStateByTarget,
  targetIndex: number,
  guessIndex: number,
): GuessViewStateByTarget {
  return {
    ...guessViewStateByTarget,
    [targetIndex]: {
      previewIndex: guessIndex,
      lockedIndex: guessIndex,
      previewRowId: null,
      lockedRowId: null,
    },
  };
}

export function lockGuessByRowId(
  guessViewStateByTarget: GuessViewStateByTarget,
  targetIndex: number,
  rowId: string,
): GuessViewStateByTarget {
  return {
    ...guessViewStateByTarget,
    [targetIndex]: {
      previewIndex: null,
      lockedIndex: null,
      previewRowId: rowId,
      lockedRowId: rowId,
    },
  };
}

export function unlockGuess(
  guessViewStateByTarget: GuessViewStateByTarget,
  targetIndex: number,
): GuessViewStateByTarget {
  const current = getGuessViewState(guessViewStateByTarget, targetIndex);

  return {
    ...guessViewStateByTarget,
    [targetIndex]: {
      previewIndex: current.previewIndex ?? current.lockedIndex ?? null,
      lockedIndex: null,
      previewRowId: current.previewRowId ?? current.lockedRowId ?? null,
      lockedRowId: null,
    },
  };
}

export function clearGuessView(
  guessViewStateByTarget: GuessViewStateByTarget,
  targetIndex: number,
): GuessViewStateByTarget {
  return {
    ...guessViewStateByTarget,
    [targetIndex]: {
      previewIndex: null,
      lockedIndex: null,
      previewRowId: null,
      lockedRowId: null,
    },
  };
}

export function getDetailHistory<T extends GuessLike = GuessLike>(
  targetIndex: number,
  historyByTarget: GuessHistoryByTarget<T>,
  guessViewStateByTarget: GuessViewStateByTarget,
): DetailHistoryItem<T>[] {
  const guesses = historyByTarget.get(targetIndex) ?? [];
  const { previewIndex, lockedIndex, previewRowId, lockedRowId } = getGuessViewState(
    guessViewStateByTarget,
    targetIndex,
  );
  const resolvedPreviewIndex =
    findGuessIndexByRowId(guesses, previewRowId) ??
    (isUsableIndex(previewIndex, guesses) ? previewIndex : null);
  const resolvedLockedIndex =
    findGuessIndexByRowId(guesses, lockedRowId) ??
    (isUsableIndex(lockedIndex, guesses) ? lockedIndex : null);

  return guesses.map((entry, sourceIndex) => ({
    ...entry,
    sourceIndex,
    isPreviewed: sourceIndex === resolvedPreviewIndex,
    isLocked: sourceIndex === resolvedLockedIndex,
  }));
}
