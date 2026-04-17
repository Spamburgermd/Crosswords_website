/**
 * src/gameEngine/feedback.ts
 * ---------------------------------------------
 * Deterministic feedback engine for a single guess against one target word.
 * The color logic mirrors today's server behavior conceptually:
 * - green  = correct letter, correct position
 * - yellow = correct letter, wrong position (respecting remaining counts)
 * - red    = letter does not exist in the target word (after counts are consumed)
 * - blue   = letter not in THIS target word, but present in a shared "other target"
 *            pool. Blue respects counts and shrinks when smartBlue=true.
 *
 * The current mobile UI already understands codes shaped like ['green','yellow',...].
 * We keep codes as strings to stay adaptable. If you later need single letters
 * like ['G','Y','R','B'], change ONLY the literals below.
 */

import { GuessCode, GuessResult, Rules } from './types';

// Literal codes kept in one place for easy future alignment with UI.
const CODE_GREEN: GuessCode = 'green';
const CODE_YELLOW: GuessCode = 'yellow';
const CODE_RED: GuessCode = 'red';
const CODE_BLUE: GuessCode = 'blue';

/**
 * Compute per-letter feedback for one guess.
 * @param targetWord Target word the player is trying to solve (uppercase recommended).
 * @param guessWord  Player's guess (will be uppercased internally).
 * @param rules      Rule set (smartBlue toggles shrinking blue pool).
 * @returns GuessResult with an array of codes, same length as guessWord.
 *
 * Determinism notes:
 * - All string comparisons are done in uppercase so callers do not need to pre-normalize.
 * - We run in two passes: first greens, then yellows, then blues/reds. Each pass
 *   consumes from letter count maps so duplicates behave predictably.
 * - Blue logic uses an optional pool of letters supplied via rules.bluePoolLetters.
 *   If no pool is provided, no blue codes will be emitted (they fall back to red),
 *   which is safe for single-target games and keeps behavior predictable.
 */
export function computeFeedback(targetWord: string, guessWord: string, rules: Rules): GuessResult {
  const target = targetWord.toUpperCase();
  const guess = guessWord.toUpperCase();

  const codes: GuessCode[] = Array.from({ length: guess.length }, () => CODE_RED);

  // Map of remaining letters in the target (consumed by greens/yellows).
  const targetCounts: Record<string, number> = {};
  for (const ch of target) {
    targetCounts[ch] = (targetCounts[ch] || 0) + 1;
  }

  // Optional pool representing letters that exist in OTHER target words.
  const bluePoolCounts: Record<string, number> = {};
  if (Array.isArray(rules.bluePoolLetters)) {
    for (const ch of rules.bluePoolLetters) {
      const upper = (ch || '').toUpperCase();
      bluePoolCounts[upper] = (bluePoolCounts[upper] || 0) + 1;
    }
  }

  // Pass 1: greens (exact position matches).
  for (let i = 0; i < guess.length; i++) {
    const g = guess[i];
    const t = target[i];
    if (g === t) {
      codes[i] = CODE_GREEN;
      targetCounts[g] -= 1;
    }
  }

  // Pass 2: yellows (correct letter, wrong position), respecting remaining counts.
  for (let i = 0; i < guess.length; i++) {
    if (codes[i] === CODE_GREEN) continue;
    const g = guess[i];
    if (targetCounts[g] > 0) {
      codes[i] = CODE_YELLOW;
      targetCounts[g] -= 1; // consume to keep duplicates honest
    }
  }

  // Pass 3: blues (letter exists in OTHER targets) otherwise red.
  // smartBlue: each blue consumes from the shared pool so counts shrink.
  for (let i = 0; i < guess.length; i++) {
    if (codes[i] !== CODE_RED) continue; // already green/yellow
    const g = guess[i];
    const available = bluePoolCounts[g] || 0;
    if (available > 0) {
      codes[i] = CODE_BLUE;
      if (rules.smartBlue) {
        bluePoolCounts[g] = available - 1;
      }
    } else {
      codes[i] = CODE_RED;
    }
  }

  // Post-pass: eliminate Blue+Red contradiction for same letter in one guess.
  // If a letter got Blue anywhere, upgrade remaining Reds of that letter to Blue.
  const blueLetters = new Set<string>();
  for (let i = 0; i < guess.length; i++) {
    if (codes[i] === CODE_BLUE) blueLetters.add(guess[i]);
  }
  for (let i = 0; i < guess.length; i++) {
    if (codes[i] === CODE_RED && blueLetters.has(guess[i])) {
      codes[i] = CODE_BLUE;
    }
  }

  return { codes };
}
