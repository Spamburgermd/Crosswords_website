/**
 * src/lib/guessScoring.ts
 * ---------------------------------------------
 * Adapter that routes guess submissions to either:
 * - Server mode (default): POST /games/{id}/guess via submitGuess.
 * - Serverless-local mode: client-side engine computes feedback codes.
 *
 * This file keeps the surface identical for the UI: scoreGuess() always
 * returns a Promise<{ ok: true; codes: string[] }> on success, or throws
 * an Error on failure. No other runtime behavior is changed.
 */

import { USE_SERVERLESS_GUESS_SCORING } from '@src/flags';
import { submitGuess } from '@lib/api';
import {
  DEFAULT_RULES,
  type GameState as LocalGameState,
  type Rules,
} from '../gameEngine/types';
import { applyGuess, initGameFromChallenge } from '../gameEngine/state';
import { explainWhyMissingTargetWords, getTargetWordsForGame } from './targetWordsProvider';

type ScoreGuessParams = {
  apiKey: string;
  gameId: number;
  targetIndex: number;
  guess: string;
  targetSignature?: string;
  /** Needed only for serverless-local path; optional otherwise. */
  targetWords?: string[] | null;
  /** Optional full game state so provider can extract target words. */
  gameState?: unknown;
  /** Optional rule overrides; smartBlue defaults to true. */
  rules?: Rules;
  /** Force the serverless-local path even if the global flag is off (used for offline modes). */
  forceServerless?: boolean;
};

type ScoreGuessOk = { ok: true; codes: string[] };

// If true, serverless scoring will silently fall back to server scoring when target
// words are missing. Default false to surface errors during migration.
const FALLBACK_TO_SERVER_ON_MISSING_TARGETS = false;

// In-memory local game state cache, keyed by gameId. Keeps guesses per target.
const localGames = new Map<number, LocalGameState>();
type LocalGuess = { targetIndex: number; guess: string; codes: string[]; createdAt: string };
const localGuessHistory = new Map<number, LocalGuess[]>();

/** Exposed so UI can render local guesses while in serverless-local mode. */
export function getLocalGuesses(gameId: number | null | undefined): LocalGuess[] {
  if (!gameId) return [];
  return localGuessHistory.get(gameId) ?? [];
}

/**
 * Main adapter called by the UI.
 * - In server mode, delegates to submitGuess (current behavior).
 * - In serverless-local mode, uses the client engine to compute codes.
 */
export async function scoreGuess(params: ScoreGuessParams): Promise<ScoreGuessOk> {
  const { apiKey, gameId, targetIndex, guess, targetSignature } = params;

  const shouldServerless = params.forceServerless || USE_SERVERLESS_GUESS_SCORING;

  if (!shouldServerless) {
    // --- Server mode (unchanged behavior) ---
    const serverResult = await submitGuess(apiKey, gameId, {
      target_index: targetIndex,
      guess,
      target_signature: targetSignature,
    });
    return { ok: true, codes: serverResult.codes ?? [] };
  }

  // --- Serverless-local mode (no network call for scoring) ---
  const targetWords =
    params.targetWords ??
    getTargetWordsForGame(params.gameState as { debug_solution_words?: unknown }, gameId);
  if (!targetWords || !targetWords[targetIndex]) {
    const reason = explainWhyMissingTargetWords(params.gameState as { debug_solution_words?: unknown });
    if (FALLBACK_TO_SERVER_ON_MISSING_TARGETS) {
      const serverResult = await submitGuess(apiKey, gameId, {
        target_index: targetIndex,
        guess,
        target_signature: targetSignature,
      });
      return { ok: true, codes: serverResult.codes ?? [] };
    }
    throw new Error(`Serverless-local scoring needs targetWords. ${reason}`);
  }

  const rules: Rules = { ...DEFAULT_RULES, ...params.rules };

  // Initialize per-game local state if missing.
  let localState = localGames.get(gameId);
  if (!localState) {
    localState = initGameFromChallenge({
      v: 1,
      words: targetWords,
      rules,
      createdAtMs: Date.now(),
    });
    localGames.set(gameId, localState);
  }

  // Compute feedback and persist the updated local state.
  const { nextState, result } = applyGuess(localState, targetIndex, guess);
  localGames.set(gameId, nextState);

  // Record history so the UI can render even without server updates.
  const record: LocalGuess = {
    targetIndex,
    guess,
    codes: result.codes,
    createdAt: new Date().toISOString(),
  };
  const existing = localGuessHistory.get(gameId) ?? [];
  localGuessHistory.set(gameId, [...existing, record]);

  return { ok: true, codes: result.codes };
}
