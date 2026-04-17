/**
 * src/lib/keyboardLetterStates.ts
 * ---------------------------------------------
 * Exact keyboard absent-letter helper.
 *
 * A key becomes grey only when the player has guessed the letter and that
 * letter does not appear anywhere in the current puzzle's target words.
 * If target words are unavailable, the keyboard stays neutral.
 */

export type KeyboardLetterState = 'white' | 'grey';

export type KeyboardHistoryEntry = {
  guess: string;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Build keyboard states from known target words and flat guess history.
 */
export function buildKeyboardLetterStates(
  targetWords: string[] | null,
  history: KeyboardHistoryEntry[],
): Record<string, KeyboardLetterState> {
  const states: Record<string, KeyboardLetterState> = {};

  for (const letter of ALPHABET) {
    states[letter] = 'white';
  }

  if (!targetWords || targetWords.length === 0) {
    return states;
  }

  const puzzleLetterSet = new Set<string>();
  for (const rawWord of targetWords) {
    const word = String(rawWord ?? '').toUpperCase();
    for (const letter of word) {
      if (letter >= 'A' && letter <= 'Z') {
        puzzleLetterSet.add(letter);
      }
    }
  }

  const guessedLetterSet = new Set<string>();
  for (const entry of history) {
    const guess = String(entry.guess ?? '').toUpperCase();
    for (const letter of guess) {
      if (letter >= 'A' && letter <= 'Z') {
        guessedLetterSet.add(letter);
      }
    }
  }

  for (const letter of ALPHABET) {
    if (guessedLetterSet.has(letter) && !puzzleLetterSet.has(letter)) {
      states[letter] = 'grey';
    }
  }

  return states;
}
