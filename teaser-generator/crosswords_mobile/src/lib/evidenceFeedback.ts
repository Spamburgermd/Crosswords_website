/**
 * src/lib/evidenceFeedback.ts
 * ---------------------------------------------
 * Builds a user-visible feedback layer on top of raw guess results.
 *
 * Important distinction:
 * - raw codes are what the scorer returned when the guess was submitted
 * - reconciled codes are what the player is currently allowed to infer
 *
 * Collapse rules:
 * - G, Y, and R are always preserved as-is
 * - B → R when cross-word capacity is exhausted
 */

export type FeedbackGuessEntry = {
  guess: string;
  codes: string[];
};

export type ReconciledFeedbackGuessEntry = FeedbackGuessEntry & {
  rawCodes: string[];
};

export type EvidenceFeedbackResult = {
  historyByTarget: Map<number, ReconciledFeedbackGuessEntry[]>;
};

function normalizeCode(code: string | undefined): string {
  return ((code ?? '')[0] ?? '').toUpperCase();
}

function normalizeLetter(letter: string | undefined): string {
  const upper = (letter ?? '').toUpperCase();
  return upper >= 'A' && upper <= 'Z' ? upper : '';
}

function countLetters(word: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ch of word) {
    const upper = normalizeLetter(ch);
    if (!upper) continue;
    counts[upper] = (counts[upper] ?? 0) + 1;
  }
  return counts;
}

/**
 * Reconcile raw feedback into a conservative display layer.
 */
export function reconcileEvidenceFeedback(args: {
  targetWords?: string[] | null;
  historyByTarget: Map<number, FeedbackGuessEntry[]>;
  confirmedLettersByTarget?: Record<number, Record<number, string>>;
}): EvidenceFeedbackResult {
  const rawHistoryByTarget = new Map<number, ReconciledFeedbackGuessEntry[]>();

  // Normalize input first so every caller receives uppercase guess/codes.
  for (const [targetIndex, entries] of args.historyByTarget.entries()) {
    rawHistoryByTarget.set(
      targetIndex,
      (entries ?? []).map((entry) => {
        const guess = String(entry.guess ?? '').toUpperCase();
        const rawCodes = (entry.codes ?? []).map((code) => normalizeCode(code));

        return {
          guess,
          codes: [...rawCodes],
          rawCodes,
        };
      }),
    );
  }

  const targetWords = (args.targetWords ?? []).map((word) => String(word ?? '').toUpperCase());
  if (targetWords.length === 0) {
    return {
      historyByTarget: rawHistoryByTarget,
    };
  }

  // Direct evidence: any raw green or externally confirmed green locks that
  // position/letter for the target.
  const greenCountsByTarget = new Map<number, Record<string, number>>();
  for (const [targetIndex, entries] of rawHistoryByTarget.entries()) {
    const targetWord = targetWords[targetIndex] ?? '';
    if (!targetWord) continue;

    const greenPositions = new Map<number, string>();
    for (const entry of entries) {
      const len = Math.min(entry.guess.length, entry.rawCodes.length, targetWord.length);
      for (let i = 0; i < len; i++) {
        if (entry.rawCodes[i] !== 'G') continue;
        const letter = normalizeLetter(entry.guess[i]);
        if (letter) greenPositions.set(i, letter);
      }
    }
    const externallyConfirmed = args.confirmedLettersByTarget?.[targetIndex] ?? {};
    for (const [position, letter] of Object.entries(externallyConfirmed)) {
      const index = Number(position);
      if (!Number.isInteger(index) || index < 0 || index >= targetWord.length) continue;
      const normalizedLetter = normalizeLetter(letter);
      if (normalizedLetter) greenPositions.set(index, normalizedLetter);
    }

    const counts: Record<string, number> = {};
    for (const letter of greenPositions.values()) {
      counts[letter] = (counts[letter] ?? 0) + 1;
    }
    greenCountsByTarget.set(targetIndex, counts);
  }

  const targetLetterCounts = targetWords.map((word) => countLetters(word));

  const sameWordPlausible = (targetIndex: number, letter: string): boolean => {
    const total = targetLetterCounts[targetIndex]?.[letter] ?? 0;
    const confirmed = greenCountsByTarget.get(targetIndex)?.[letter] ?? 0;
    return total > confirmed;
  };

  const crossWordPlausible = (targetIndex: number, letter: string): boolean => {
    let total = 0;
    let confirmed = 0;

    for (let i = 0; i < targetWords.length; i++) {
      if (i === targetIndex) continue;
      total += targetLetterCounts[i]?.[letter] ?? 0;
      confirmed += greenCountsByTarget.get(i)?.[letter] ?? 0;
    }

    return total > confirmed;
  };

  const reconciledHistoryByTarget = new Map<number, ReconciledFeedbackGuessEntry[]>();

  for (const [targetIndex, entries] of rawHistoryByTarget.entries()) {
    const reconciledEntries = entries.map((entry) => {
      const nextCodes = entry.rawCodes.map((rawCode, codeIndex) => {
        const letter = normalizeLetter(entry.guess[codeIndex]);
        if (!letter) return rawCode;
        if (rawCode === 'G' || rawCode === 'R') return rawCode;

        if (rawCode === 'Y') return 'Y';

        if (rawCode === 'B') {
          return crossWordPlausible(targetIndex, letter) ? 'B' : 'R';
        }

        return rawCode;
      });

      return {
        guess: entry.guess,
        codes: nextCodes,
        rawCodes: entry.rawCodes,
      };
    });

    reconciledHistoryByTarget.set(targetIndex, reconciledEntries);
  }

  return {
    historyByTarget: reconciledHistoryByTarget,
  };
}
