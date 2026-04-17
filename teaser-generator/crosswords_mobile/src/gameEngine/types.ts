/**
 * src/gameEngine/types.ts
 * ---------------------------------------------
 * Central type definitions for the client-side CrosSWords engine.
 * Keep these small and serializable so they can be encoded into URLs.
 * All structures are plain data (no class instances) for easy cloning.
 */

/** Per-game rules. Extendable, but we start with smartBlue toggling blue-letter pooling. */
export type Rules = {
  /**
   * When true, "blue" letters (letters that are not in the guessed target word
   * but do exist in another target word) are consumed from a shared pool so
   * duplicate guesses cannot repeatedly claim the same blue credit.
   * Defaults to true in examples.
   */
  smartBlue: boolean;
  /**
   * Optional precomputed pool of letters that exist in OTHER target words.
   * This is not required for correctness but lets feedback.ts produce "blue"
   * codes without needing the full GameState inside computeFeedback.
   */
  bluePoolLetters?: string[];
};

/** Letter-by-letter feedback code. Kept as string to match existing UI expectations. */
export type GuessCode = string;

/** Minimal feedback result for one guess. */
export type GuessResult = {
  codes: GuessCode[];
};

/**
 * Local, client-owned game state used by the deterministic engine.
 * - targetWords: canonical uppercase target words (index is target index).
 * - guessesByTarget: parallel array of guess history per target.
 * - solvedByTarget: per-target solved flag.
 */
export type GameState = {
  targetWords: string[];
  guessesByTarget: string[][];
  solvedByTarget: boolean[];
  rules: Rules;
  startedAtMs?: number;
  finishedAtMs?: number;
};

/** Payload shared when creating/joining a challenge (URL-safe once encoded). */
export type ChallengePayload = {
  v: 1;
  words: string[];
  rules: Rules;
  createdAtMs: number;
};

/** Payload that summarizes the outcome of a game for sharing. */
export type ResultPayload = {
  v: 1;
  challengeId: string;
  completed: 'win' | 'lose' | 'forfeit';
  attempts: number;
  timeMs?: number;
  guessesByTarget?: Array<Array<string | { guess: string; codes: string[] }>>;
};

/** Convenience constant for examples. */
export const DEFAULT_RULES: Rules = { smartBlue: true };

// ---------- Phase 7: offer/return packets (backward compatible) ----------
export type ChallengeOfferPayload = {
  v: 1 | 2;
  type: 'offer';
  offerId: string;
  mode: 'sender_picks_for_receiver' | 'same_list_seed';
  dictionaryId: string;
  dictionaryVersion?: string;
  difficulty?: string;
  timerLimitSeconds?: number;
  receiverTargets?: string[]; // present when mode=sender_picks_for_receiver
  seed?: number; // present when mode=same_list_seed
  rules?: Rules;
  createdAtMs: number;
};

export type ChallengeReturnPayload = {
  v: 1 | 2;
  type: 'return';
  offerId: string;
  senderTargets: string[];
  createdAtMs: number;
};

export type ChallengeBundlePayload = {
  v: 1 | 2;
  type: 'bundle';
  offer: ChallengeOfferPayload;
  return?: ChallengeReturnPayload;
};
