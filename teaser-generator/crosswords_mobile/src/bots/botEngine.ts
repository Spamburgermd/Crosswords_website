/**
 * src/bots/botEngine.ts
 * ---------------------------------------------------------------------------
 * Bot AI engine ported from server (crosswords_server/app/routers/games.py)
 * Implements Easy/Normal/Hard difficulty levels using:
 * - Easy: Random valid guesses
 * - Normal: Positional letter frequency + English letter frequency weighting
 * - Hard: Entropy minimization with sampling for large candidate pools
 */

import { computeFeedback } from '../gameEngine/feedback';
import { DEFAULT_RULES } from '../gameEngine/types';

// ============================= TYPES =====================================

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export type BotMoveRequest = {
  targetIndex: number;
  targetLength: number;
  previousGuesses: string[];
  previousFeedback: Array<{ guess: string; codes: string[] }>;
  dictionaryId: string;
  difficulty: BotDifficulty;
  candidatePool: string[]; // Pre-filtered words of correct length from dictionary
};

export type BotMoveResult = {
  guess: string;
  confidence: number; // 0-1, for future UI feedback
  candidatesRemaining: number;
};

// ============================= CONSTANTS =================================

/**
 * English letter frequency weights (ETAOIN) to bias guesses toward common letters.
 * Ported from server lines 53-80.
 */
const LETTER_FREQUENCY: Record<string, number> = {
  E: 12.0,
  T: 9.1,
  A: 8.2,
  O: 7.5,
  I: 7.0,
  N: 6.7,
  S: 6.3,
  H: 6.1,
  R: 6.0,
  D: 4.3,
  L: 4.0,
  C: 2.8,
  U: 2.8,
  M: 2.4,
  W: 2.4,
  F: 2.2,
  G: 2.0,
  Y: 2.0,
  P: 1.9,
  B: 1.5,
  V: 1.0,
  K: 0.8,
  J: 0.2,
  X: 0.2,
  Q: 0.1,
  Z: 0.1,
};

/**
 * Difficulty tuning parameters. feedbackRetention is the primary lever:
 * lower values make the bot "forget" prior clues, requiring more guesses.
 * Future: adaptive difficulty will adjust retention based on player win rate.
 */
const BOT_DIFFICULTY_CONFIG = {
  easy: {
    feedbackRetention: 0.5,
    strategy: 'random' as const,
    entropySampleSize: 0,
    entropyPoolLimit: 0,
    thinkingDelayBase: 600,
    thinkingDelayRange: 600, // 600-1200ms
  },
  normal: {
    feedbackRetention: 0.85,
    strategy: 'frequency' as const,
    entropySampleSize: 0,
    entropyPoolLimit: 0,
    thinkingDelayBase: 1200,
    thinkingDelayRange: 800, // 1200-2000ms
  },
  hard: {
    feedbackRetention: 1.0,
    strategy: 'entropy' as const,
    entropySampleSize: 500,
    entropyPoolLimit: 2000,
    thinkingDelayBase: 1800,
    thinkingDelayRange: 1200, // 1800-3000ms
  },
} as const;

// ============================= HELPER FUNCTIONS ==========================

/**
 * Normalize difficulty string to 'easy' | 'normal' | 'hard'.
 * Ported from server lines 156-168.
 */
function normalizeDifficulty(value?: string): BotDifficulty {
  if (!value) return 'normal';
  const lowered = value.trim().toLowerCase();
  if (lowered === 'easy' || lowered === 'normal' || lowered === 'hard') {
    return lowered as BotDifficulty;
  }
  if (lowered === 'expert' || lowered === 'pro') {
    return 'hard';
  }
  return 'normal';
}

/**
 * Convert feedback codes to short format (green→G, yellow→Y, red→R, blue→B)
 */
function toShortCodes(codes: string[]): string[] {
  return codes.map((c) => {
    const lower = c.toLowerCase();
    if (lower === 'green' || lower === 'g') return 'G';
    if (lower === 'yellow' || lower === 'y') return 'Y';
    if (lower === 'blue' || lower === 'b') return 'B';
    if (lower === 'red' || lower === 'r') return 'R';
    return 'R'; // unknown
  });
}

/**
 * Filter candidates that would produce the same feedback for the given guess.
 * Ported from server lines 494-513.
 */
function filterCandidatesWithFeedback(
  candidates: string[],
  guess: string,
  codes: string[]
): string[] {
  const guessUpper = guess.toUpperCase();

  // Normalize input codes to single-letter format (handles both 'green' and 'G')
  const shortInput = toShortCodes(codes);
  // Interpret BLUE the same as RED for the current target (letter belongs to other word)
  const mappedCodes = shortInput.map((c) => (c === 'B' ? 'R' : c));

  const filtered: string[] = [];
  for (const cand of candidates) {
    if (cand.length !== guessUpper.length) continue;

    try {
      // Simulate feedback for this candidate as if it were the target
      const result = computeFeedback(cand, guessUpper, DEFAULT_RULES);
      const shortCodes = toShortCodes(result.codes);
      if (JSON.stringify(shortCodes) === JSON.stringify(mappedCodes)) {
        filtered.push(cand);
      }
    } catch (error) {
      // Skip candidates that cause errors
      continue;
    }
  }

  return filtered.length > 0 ? filtered : candidates;
}

/**
 * Remove words the bot already guessed to avoid repeats.
 * Ported from server lines 516-520.
 */
function excludeGuessed(candidates: string[], priorGuesses: string[]): string[] {
  const priorSet = new Set(priorGuesses.map((g) => g.toUpperCase()));
  const remaining = candidates.filter((c) => !priorSet.has(c.toUpperCase()));
  return remaining.length > 0 ? remaining : candidates;
}

/**
 * Return a compact feedback string for entropy bucketing.
 * Ported from server lines 584-586.
 */
function scorePattern(guess: string, target: string): string {
  const result = computeFeedback(target, guess, DEFAULT_RULES);
  const shortCodes = toShortCodes(result.codes);
  return shortCodes.join('');
}

/**
 * Pick a random bot guess matching the target length (for easy mode).
 * Ported from server lines 486-491.
 */
function chooseBotGuess(targetLen: number, wordList: string[]): string {
  const filtered = wordList.filter((w) => w.length === targetLen);
  if (filtered.length === 0) {
    return 'A'.repeat(Math.max(targetLen, 1));
  }
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/**
 * Score candidates by positional letter frequency + English letter frequency.
 * Used by Normal mode (all pool sizes) and Hard mode (tiny pools ≤30).
 */
function scoreByFrequency(pool: string[]): string {
  const wordLength = pool[0].length;
  const posCounts: Array<Record<string, number>> = Array.from(
    { length: wordLength },
    () => ({})
  );

  for (const word of pool) {
    for (let idx = 0; idx < word.length; idx++) {
      const ch = word[idx];
      posCounts[idx][ch] = (posCounts[idx][ch] || 0) + 1;
    }
  }

  let bestWord = pool[0];
  let bestWeight = -1.0;

  for (const word of pool) {
    const positionalScore = Array.from(word).reduce(
      (sum, ch, idx) => sum + (posCounts[idx][ch] || 0),
      0
    );
    const uniqueLetters = new Set(word.toUpperCase());
    const letterBonus = Array.from(uniqueLetters).reduce(
      (sum, ch) => sum + (LETTER_FREQUENCY[ch] || 0.0),
      0
    );
    const weight = positionalScore * 2.0 + letterBonus;
    if (weight > bestWeight) {
      bestWeight = weight;
      bestWord = word;
    }
  }

  return bestWord;
}

/**
 * Main bot decision engine. Selects best guess based on difficulty level.
 */
function chooseBestGuess(
  candidates: string[],
  priorGuesses: string[],
  difficulty: BotDifficulty,
  targetLength: number
): string {
  if (candidates.length === 0) return 'A'.repeat(targetLength || 1);

  const normalizedDifficulty = normalizeDifficulty(difficulty);

  // Avoid repeats
  let pool = excludeGuessed(candidates, priorGuesses);

  // Safety check: if pool is somehow empty, return fallback
  if (pool.length === 0) {
    console.warn('Bot candidate pool empty after filtering, using fallback');
    return 'A'.repeat(targetLength || 4);
  }

  // EASY MODE: Random valid guess
  if (normalizedDifficulty === 'easy') {
    return chooseBotGuess(pool[0].length, pool);
  }

  // NORMAL MODE: Positional letter frequency (always, regardless of pool size)
  if (normalizedDifficulty === 'normal') {
    return scoreByFrequency(pool);
  }

  // HARD MODE: Entropy minimization (positional frequency for tiny pools)
  if (pool.length <= 30) {
    return scoreByFrequency(pool);
  }

  const hardConfig = BOT_DIFFICULTY_CONFIG.hard;
  let sample = pool;
  if (pool.length > hardConfig.entropyPoolLimit) {
    sample = pool.slice().sort(() => Math.random() - 0.5).slice(0, hardConfig.entropySampleSize);
  }

  let bestGuess = sample[0];
  let bestScore = Infinity;
  const total = pool.length;

  for (const guess of sample) {
    const buckets: Record<string, number> = {};
    for (const cand of pool) {
      const pattern = scorePattern(guess, cand);
      buckets[pattern] = (buckets[pattern] || 0) + 1;
    }
    const expectedRemaining =
      Object.values(buckets).reduce((sum, size) => sum + size * size, 0) / total;
    if (expectedRemaining < bestScore) {
      bestScore = expectedRemaining;
      bestGuess = guess;
    }
  }

  return bestGuess;
}

// ============================= PUBLIC API ================================

/**
 * Generate a bot move for the given request.
 * Main entry point for bot decision-making.
 */
export async function generateBotMove(request: BotMoveRequest): Promise<BotMoveResult> {
  // Apply feedback-based filtering to candidate pool
  let candidates = request.candidatePool.filter(
    (w) => w.length === request.targetLength
  );

  // Filter by previous feedback (Easy mode probabilistically "forgets" clues)
  const config = BOT_DIFFICULTY_CONFIG[request.difficulty];
  for (const feedback of request.previousFeedback) {
    if (config.feedbackRetention < 1.0 && Math.random() > config.feedbackRetention) {
      continue;
    }
    candidates = filterCandidatesWithFeedback(
      candidates,
      feedback.guess,
      feedback.codes
    );
  }

  // Choose best guess based on difficulty
  const guess = chooseBestGuess(
    candidates,
    request.previousGuesses,
    request.difficulty,
    request.targetLength
  );

  // Calculate confidence (0-1) based on pool reduction
  const confidence =
    request.candidatePool.length > 0
      ? 1.0 - candidates.length / request.candidatePool.length
      : 0.5;

  return {
    guess,
    confidence: Math.max(0, Math.min(1, confidence)),
    candidatesRemaining: candidates.length,
  };
}

/**
 * Get random delay in milliseconds based on difficulty (for UI realism).
 */
export function getBotThinkingDelay(difficulty: BotDifficulty): number {
  const cfg = BOT_DIFFICULTY_CONFIG[difficulty] ?? BOT_DIFFICULTY_CONFIG.normal;
  return cfg.thinkingDelayBase + Math.random() * cfg.thinkingDelayRange;
}
