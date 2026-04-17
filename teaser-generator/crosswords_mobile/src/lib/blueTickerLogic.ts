import type { IntersectionMap } from './boardRevealMap';
import type { CanonicalWordSlot } from '@src/utils/wordSlots';

export type BlueTickerGuessEntry = {
  target_index: number;
  guess: string;
  codes: string[];
  created_at: string;
};

/**
 * Build triedLettersByTarget: for each target word, the set of letters the
 * player has tried — either by guessing directly in that word slot, or by
 * guessing at an intersection position that crosses that word.
 */
function buildTriedLetters(
  groupedHistoryList: Array<{ slot: CanonicalWordSlot; guesses: BlueTickerGuessEntry[] }>,
  intersectionMap: IntersectionMap,
): Map<number, Set<string>> {
  const tried = new Map<number, Set<string>>();

  for (const { slot, guesses } of groupedHistoryList) {
    const targetIndex = slot.targetIndex;
    if (!tried.has(targetIndex)) tried.set(targetIndex, new Set());
    const posMap = intersectionMap.get(targetIndex);

    for (const entry of guesses) {
      const guess = (entry.guess ?? '').toUpperCase();
      for (let i = 0; i < guess.length; i++) {
        const letter = guess[i];
        if (!letter || letter < 'A' || letter > 'Z') continue;

        // Direct: player tried this letter in this word.
        tried.get(targetIndex)!.add(letter);

        // Intersection: this position crosses another word — mark letter tried there too.
        const crossingTarget = posMap?.get(i);
        if (crossingTarget != null) {
          if (!tried.has(crossingTarget)) tried.set(crossingTarget, new Set());
          tried.get(crossingTarget)!.add(letter);
        }
      }
    }
  }

  return tried;
}

export function computeBlueTickerEntries(args: {
  groupedHistoryList: Array<{ slot: CanonicalWordSlot; guesses: BlueTickerGuessEntry[] }>;
  resolvedTargetWords: string[] | null;
  solvedFlags: Record<number, boolean>;
  solvedWordsByTarget: Record<number, string>;
  discoveredBlueLetters: Set<string>;
  intersectionMap: IntersectionMap;
}): Array<[string, number]> {
  const {
    groupedHistoryList,
    resolvedTargetWords,
    solvedFlags,
    solvedWordsByTarget,
    discoveredBlueLetters,
    intersectionMap,
  } = args;

  if (discoveredBlueLetters.size === 0) return [];

  const triedLetters = buildTriedLetters(groupedHistoryList, intersectionMap);

  // ── Path 1: hidden target words — estimation from feedback patterns ──
  if (!resolvedTargetWords || resolvedTargetWords.length === 0) {
    const discoveredByLetter: Record<string, number> = {};
    const confirmedByLetter: Record<string, number> = {};

    groupedHistoryList.forEach(({ slot, guesses }) => {
      const slotDiscovered: Record<string, number> = {};
      const slotConfirmed: Record<string, number> = {};

      for (const entry of guesses) {
        const codes = entry.codes ?? [];
        const guess = (entry.guess ?? '').toUpperCase();
        const len = Math.min(codes.length, guess.length);
        const entryB: Record<string, number> = {};
        const entryGY: Record<string, number> = {};
        for (let i = 0; i < len; i++) {
          const code = (codes[i] ?? '').toUpperCase();
          const letter = guess[i];
          if (!letter || letter < 'A' || letter > 'Z') continue;
          if (code === 'B') entryB[letter] = (entryB[letter] ?? 0) + 1;
          if (code === 'G' || code === 'Y') entryGY[letter] = (entryGY[letter] ?? 0) + 1;
        }
        for (const [letter, count] of Object.entries(entryB)) {
          slotDiscovered[letter] = Math.max(slotDiscovered[letter] ?? 0, count);
        }
        for (const [letter, count] of Object.entries(entryGY)) {
          slotConfirmed[letter] = Math.max(slotConfirmed[letter] ?? 0, count);
        }
      }

      // Gate: only include this slot's contributions for letters tried here.
      const triedHere = triedLetters.get(slot.targetIndex);
      for (const [letter, count] of Object.entries(slotDiscovered)) {
        if (!triedHere?.has(letter)) continue;
        discoveredByLetter[letter] = (discoveredByLetter[letter] ?? 0) + count;
      }
      for (const [letter, count] of Object.entries(slotConfirmed)) {
        if (!triedHere?.has(letter)) continue;
        confirmedByLetter[letter] = (confirmedByLetter[letter] ?? 0) + count;
      }
    });

    return Object.entries(discoveredByLetter)
      .map(([letter, discovered]) => [letter, Math.max(0, discovered - (confirmedByLetter[letter] ?? 0))] as [string, number])
      .filter(([letter]) => discoveredBlueLetters.has(letter))
      .sort(([a], [b]) => a.localeCompare(b));
  }

  // ── Path 2: known target words — exact inventory ──
  const remainingByLetter: Record<string, number> = {};

  groupedHistoryList.forEach(({ slot, guesses }) => {
    const targetIndex = slot.targetIndex;
    const rawWord = resolvedTargetWords[targetIndex] ?? '';
    const targetWord = String(rawWord).toUpperCase().replace(/[^A-Z]/g, '');
    if (!targetWord) return;

    // Solved targets are no longer part of the unresolved blue pool.
    const isSolved = Boolean(solvedFlags[targetIndex] || solvedWordsByTarget[targetIndex]);
    if (isSolved) return;

    const totalCountForTarget: Record<string, number> = {};
    for (const ch of targetWord) {
      totalCountForTarget[ch] = (totalCountForTarget[ch] ?? 0) + 1;
    }

    // Track only fully confirmed (green) occurrences in this target.
    const confirmedByTarget: Record<string, number> = {};
    for (const entry of guesses) {
      const codes = entry.codes ?? [];
      const guess = (entry.guess ?? '').toUpperCase();
      const len = Math.min(codes.length, guess.length);
      const entryConfirmed: Record<string, number> = {};
      for (let i = 0; i < len; i++) {
        const code = (codes[i] ?? '').toUpperCase();
        const letter = guess[i];
        if (code === 'G' && letter >= 'A' && letter <= 'Z') {
          entryConfirmed[letter] = (entryConfirmed[letter] ?? 0) + 1;
        }
      }
      for (const [letter, count] of Object.entries(entryConfirmed)) {
        confirmedByTarget[letter] = Math.max(confirmedByTarget[letter] ?? 0, count);
      }
    }

    // Gate: only include this target's letter inventory for letters tried here.
    const triedHere = triedLetters.get(targetIndex);
    for (const [letter, total] of Object.entries(totalCountForTarget)) {
      if (!triedHere?.has(letter)) continue;
      const confirmed = confirmedByTarget[letter] ?? 0;
      const remaining = Math.max(0, total - confirmed);
      remainingByLetter[letter] = (remainingByLetter[letter] ?? 0) + remaining;
    }
  });

  // Include discovered letters with count 0 (chip visible, no badge)
  // so the chip stays as long as the reconciler keeps B alive.
  const result: Array<[string, number]> = [];
  for (const letter of discoveredBlueLetters) {
    const count = remainingByLetter[letter] ?? 0;
    result.push([letter, count]);
  }

  return result.sort(([a], [b]) => a.localeCompare(b));
}
