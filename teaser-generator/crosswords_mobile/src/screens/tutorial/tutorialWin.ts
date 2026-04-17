// crosswords_mobile/src/screens/tutorial/tutorialWin.ts

/** Returns true when every entry in solvedFlags is true (and there is at least one). */
export function isAllSolved(solvedFlags: Record<number, boolean>): boolean {
  const values = Object.values(solvedFlags);
  return values.length > 0 && values.every(Boolean);
}

/** Sums the number of guess entries across all targets. */
export function countTotalGuesses(history: Map<number, unknown[]>): number {
  let total = 0;
  for (const entries of history.values()) {
    total += entries.length;
  }
  return total;
}
