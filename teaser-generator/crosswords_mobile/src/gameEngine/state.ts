/**
 * src/gameEngine/state.ts
 * ---------------------------------------------
 * Pure helpers for constructing and evolving local GameState.
 * No side effects, no network, no React — safe to use in any environment.
 */

import { computeFeedback } from './feedback';
import { ChallengePayload, GameState, GuessResult, Rules } from './types';

/**
 * Build an initial GameState from a challenge payload.
 * All target words are uppercased to keep comparisons consistent.
 */
export function initGameFromChallenge(payload: ChallengePayload): GameState {
  const targetWords = payload.words.map((w) => w.toUpperCase());
  return {
    targetWords,
    guessesByTarget: targetWords.map(() => []),
    solvedByTarget: targetWords.map(() => false),
    rules: payload.rules,
    startedAtMs: Date.now(),
  };
}

/**
 * Apply a guess to one target index and produce the next immutable state.
 * @param state       Existing GameState (not mutated).
 * @param targetIndex Which target word to guess (0-based).
 * @param guessWord   The player's guess (any casing).
 * @returns nextState (new object) plus the GuessResult.
 */
export function applyGuess(
  state: GameState,
  targetIndex: number,
  guessWord: string,
): { nextState: GameState; result: GuessResult } {
  const targetWord = state.targetWords[targetIndex];
  if (!targetWord) {
    throw new Error(`No target word at index ${targetIndex}`);
  }

  // Build a blue-letter pool from all other targets so blue codes can be emitted.
  const bluePoolLetters: string[] = state.targetWords
    .filter((_, idx) => idx !== targetIndex)
    .join('')
    .split('');

  const rulesWithPool: Rules = { ...state.rules, bluePoolLetters };
  const result = computeFeedback(targetWord, guessWord, rulesWithPool);

  // Clone shallow arrays to keep immutability and avoid accidental shared state.
  const nextGuesses = state.guessesByTarget.map((arr, idx) =>
    idx === targetIndex ? [...arr, guessWord.toUpperCase()] : [...arr],
  );
  const nextSolved = state.solvedByTarget.map((flag, idx) =>
    idx === targetIndex ? result.codes.every((c) => c === 'green') || flag : flag,
  );

  const allSolved = nextSolved.every(Boolean);

  const nextState: GameState = {
    ...state,
    guessesByTarget: nextGuesses,
    solvedByTarget: nextSolved,
    finishedAtMs: allSolved ? Date.now() : state.finishedAtMs,
  };

  return { nextState, result };
}

/** Returns true if every target has been solved. */
export function isSolved(state: GameState): boolean {
  return state.solvedByTarget.every(Boolean);
}

/**
 * Returns true if the player has exceeded an optional max attempts per target.
 * If maxAttemptsPerTarget is undefined, this always returns false.
 */
export function isFailed(state: GameState, maxAttemptsPerTarget?: number): boolean {
  if (maxAttemptsPerTarget == null) return false;
  return state.guessesByTarget.some((guesses) => guesses.length > maxAttemptsPerTarget);
}
