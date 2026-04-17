/**
 * src/bots/botScoringAdapter.ts
 * ---------------------------------------------
 * Minimal hook so bots can share the same scoring path when serverless
 * scoring is enabled. Currently a stub because bots are server-driven.
 */

import { USE_SERVERLESS_GUESS_SCORING } from '../flags';
import { scoreGuess } from '../lib/guessScoring';

export async function botScoreGuess(params: {
  apiKey: string;
  gameId: number;
  targetIndex: number;
  guess: string;
  gameState?: unknown;
}): Promise<{ ok: true; codes: string[] }> {
  if (!USE_SERVERLESS_GUESS_SCORING) {
    throw new Error('Bot serverless scoring not active (flag off).');
  }
  return scoreGuess({
    apiKey: params.apiKey,
    gameId: params.gameId,
    targetIndex: params.targetIndex,
    guess: params.guess,
    gameState: params.gameState,
  });
}
