/**
 * src/screens/tutorial/useTutorialGameState.ts
 * ---------------------------------------------
 * Tutorial state hook. Guided mode may inject scripted guesses, but tutorial
 * free-play now runs through the same core board pipeline as the live board.
 */

import { useCallback, useMemo, useState } from 'react';

import type { FeedbackGuessEntry } from '@src/lib/evidenceFeedback';
import { buildBoardSplitHistory, type CanonicalWordSnapshot, type ProvenancedEntry } from '@src/lib/boardHistoryPipeline';
import { buildFullIntersectionMap, buildIntersectionMap } from '@src/lib/boardRevealMap';
import { buildCardDisplayState, type CardDisplayState } from '@src/lib/cardDisplayState';
import {
  lockGuessByRowId,
  previewGuessByRowId,
  type GuessViewStateByTarget,
  unlockGuess,
} from '@src/lib/guessDisplayState';
import { computeBlueTickerEntries } from '@src/lib/blueTickerLogic';
import { getTutorialWordSlots, TUTORIAL_WORDS } from './tutorialPuzzle';

export type TutorialPipelineInput = {
  rawHistoryByTarget: Map<number, FeedbackGuessEntry[]>;
  guessViewStateByTarget: GuessViewStateByTarget;
  selectedTargetIndex?: number | null;
};

export type TutorialPipelineResult = {
  wordSnapshotsByTarget: Map<number, CanonicalWordSnapshot>;
  combinedHistoryByTarget: Map<number, ProvenancedEntry[]>;
  confirmedBoardLettersByCoord: Map<string, string>;
  boardTilesByCoord: ReturnType<typeof buildBoardSplitHistory>['boardTilesByCoord'];
  boardDiagnostics: string[];
  cardDisplayState: CardDisplayState<ProvenancedEntry>;
  groupedHistoryList: Array<{
    slot: ReturnType<typeof getTutorialWordSlots>[number];
    guesses: Array<{ target_index: number; guess: string; codes: string[]; created_at: string }>;
  }>;
  blueTickerEntries: Array<[string, number]>;
  solvedFlags: Record<number, boolean>;
};

export function buildTutorialPipeline(
  input: TutorialPipelineInput,
): TutorialPipelineResult {
  const { rawHistoryByTarget, guessViewStateByTarget } = input;
  const wordSlots = getTutorialWordSlots();
  const targetWords = TUTORIAL_WORDS;
  const slotsForIntersection = wordSlots.map((slot) => ({
    targetIndex: slot.targetIndex,
    coords: slot.coords as [number, number][],
  }));
  const intersectionMap = buildIntersectionMap(slotsForIntersection);

  const splitHistory = buildBoardSplitHistory({
    rawHistoryByTarget,
    wordSlots,
    targetWords,
    solvedFlags: Array(targetWords.length).fill(false),
    intersectionMap,
    fullIntersectionMap: buildFullIntersectionMap(slotsForIntersection),
    blockedSourceTarget: null,
  });
  const cardDisplayState = buildCardDisplayState({
    wordSnapshotsByTarget: splitHistory.wordSnapshotsByTarget,
    guessViewStateByTarget,
    selectedTargetIndex: input.selectedTargetIndex ?? 0,
    confirmedBoardLettersByCoord: splitHistory.confirmedBoardLettersByCoord,
    wordSlots,
  });

  const groupedHistoryList = wordSlots.map((slot) => {
    const guesses = (splitHistory.combinedHistoryByTarget.get(slot.targetIndex) ?? []).map((entry) => ({
      target_index: slot.targetIndex,
      guess: entry.guess,
      codes: entry.codes,
      created_at: '',
    }));
    return { slot, guesses };
  });

  const solvedFlags: Record<number, boolean> = {};
  for (const slot of wordSlots) {
    const guesses = groupedHistoryList.find((g) => g.slot.targetIndex === slot.targetIndex)?.guesses ?? [];
    const expectedLen = slot.length ?? 0;
    solvedFlags[slot.targetIndex] =
      expectedLen > 0 &&
      guesses.some(
        (entry) =>
          (entry.codes?.length ?? 0) === expectedLen &&
          (entry.guess?.length ?? 0) === expectedLen &&
          (entry.codes ?? []).every((code) => code === 'G'),
      );
  }

  const solvedWordsByTarget: Record<number, string> = {};
  for (const slot of wordSlots) {
    const guesses = groupedHistoryList.find((g) => g.slot.targetIndex === slot.targetIndex)?.guesses ?? [];
    const expectedLen = slot.length ?? 0;
    const solvedGuess = guesses.find(
      (entry) =>
        (entry.codes?.length ?? 0) === expectedLen &&
        (entry.guess?.length ?? 0) === expectedLen &&
        (entry.codes ?? []).every((code) => code === 'G'),
    );
    if (solvedGuess?.guess) {
      solvedWordsByTarget[slot.targetIndex] = solvedGuess.guess.toUpperCase();
    }
  }

  const discoveredBlueLetters = new Set<string>();
  for (const entries of splitHistory.combinedHistoryByTarget.values()) {
    for (const entry of entries) {
      const guess = (entry.guess ?? '').toUpperCase();
      const codes = entry.codes ?? [];
      const len = Math.min(guess.length, codes.length);
      for (let i = 0; i < len; i++) {
        const letter = guess[i];
        if (codes[i] === 'B' && letter && letter >= 'A' && letter <= 'Z') {
          discoveredBlueLetters.add(letter);
        }
      }
    }
  }

  const blueTickerEntries = computeBlueTickerEntries({
    groupedHistoryList,
    resolvedTargetWords: targetWords,
    solvedFlags,
    solvedWordsByTarget,
    discoveredBlueLetters,
    intersectionMap,
  });

  return {
    wordSnapshotsByTarget: splitHistory.wordSnapshotsByTarget,
    combinedHistoryByTarget: splitHistory.combinedHistoryByTarget,
    confirmedBoardLettersByCoord: splitHistory.confirmedBoardLettersByCoord,
    boardTilesByCoord: splitHistory.boardTilesByCoord,
    boardDiagnostics: splitHistory.boardDiagnostics,
    cardDisplayState,
    groupedHistoryList,
    blueTickerEntries,
    solvedFlags,
  };
}

export type TutorialGameOutput = TutorialPipelineResult & {
  guessViewStateByTarget: GuessViewStateByTarget;
  injectScriptedGuess: (targetIndex: number, guess: string, codes: string[]) => void;
  clearGuessHistory: () => void;
  previewGuessRow: (targetIndex: number, rowId: string) => void;
  lockGuessRow: (targetIndex: number, rowId: string) => void;
  unlockGuessView: (targetIndex: number) => void;
};

export function useTutorialGameState(selectedTargetIndex = 0): TutorialGameOutput {
  const [rawHistoryByTarget, setRawHistoryByTarget] = useState<Map<number, FeedbackGuessEntry[]>>(
    () => new Map(),
  );
  const [guessViewStateByTarget, setGuessViewStateByTarget] = useState<GuessViewStateByTarget>(
    () => ({}),
  );

  const injectScriptedGuess = useCallback(
    (targetIndex: number, guess: string, codes: string[]) => {
      setRawHistoryByTarget((prev) => {
        const next = new Map(prev);
        const existing = next.get(targetIndex) ?? [];
        next.set(targetIndex, [...existing, { guess: guess.toUpperCase(), codes }]);
        return next;
      });
      setGuessViewStateByTarget((prev) => ({
        ...prev,
        [targetIndex]: {
          previewIndex: null,
          lockedIndex: null,
          previewRowId: null,
          lockedRowId: null,
        },
      }));
    },
    [],
  );

  const clearGuessHistory = useCallback(() => {
    setRawHistoryByTarget(new Map());
    setGuessViewStateByTarget({});
  }, []);

  const previewGuessRow = useCallback(
    (targetIndex: number, rowId: string) => {
      setGuessViewStateByTarget((prev) => previewGuessByRowId(prev, targetIndex, rowId));
    },
    [],
  );

  const lockGuessRow = useCallback(
    (targetIndex: number, rowId: string) => {
      setGuessViewStateByTarget((prev) => lockGuessByRowId(prev, targetIndex, rowId));
    },
    [],
  );

  const unlockGuessView = useCallback(
    (targetIndex: number) => {
      setGuessViewStateByTarget((prev) => unlockGuess(prev, targetIndex));
    },
    [],
  );

  const pipelineResult = useMemo(
    () =>
        buildTutorialPipeline({
          rawHistoryByTarget,
          guessViewStateByTarget,
          selectedTargetIndex,
        }),
    [rawHistoryByTarget, guessViewStateByTarget, selectedTargetIndex],
  );

  return {
    ...pipelineResult,
    guessViewStateByTarget,
    injectScriptedGuess,
    clearGuessHistory,
    previewGuessRow,
    lockGuessRow,
    unlockGuessView,
  };
}
