import { computeBlueTickerEntries } from './blueTickerLogic';
import type { IntersectionMap } from './boardRevealMap';

// Minimal slot builder — only fields the function needs.
function slot(targetIndex: number, key?: string) {
  return {
    segmentIndex: targetIndex,
    targetIndex,
    signature: `sig-${targetIndex}`,
    key: key ?? `slot-${targetIndex}`,
    clueNumber: targetIndex + 1,
    displayIndex: targetIndex,
    direction: 'A' as const,
    coords: [] as number[][],
    startRow: 0,
    startCol: 0,
    length: 5,
  };
}

type GuessEntry = { target_index: number; guess: string; codes: string[]; created_at: string };

function entry(targetIndex: number, guess: string, codes: string[]): GuessEntry {
  return { target_index: targetIndex, guess, codes, created_at: '' };
}

const NO_INTERSECTION: IntersectionMap = new Map();

describe('computeBlueTickerEntries', () => {
  /* ------------------------------------------------------------------ */
  /*  Single word discovery — count must not leak to untried words        */
  /* ------------------------------------------------------------------ */

  it('limits count to the discovering word only', () => {
    // 3 words: EAGLE, ELECT, EMBER.  E appears in all three targets.
    // Player only guessed in word 0, got B for E.  Words 1 & 2 untried.
    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'EXOOO', ['B', 'R', 'R', 'R', 'R'])] },
        { slot: slot(1), guesses: [] },
        { slot: slot(2), guesses: [] },
      ],
      resolvedTargetWords: ['OOOOO', 'ELECT', 'EMBER'],
      solvedFlags: {},
      solvedWordsByTarget: {},
      discoveredBlueLetters: new Set(['E']),
      intersectionMap: NO_INTERSECTION,
    });

    // E is discovered (chip visible) but count should only come from tried words.
    // Word 0 target is OOOOO (no E), word 1 & 2 have E but are untried.
    // Tried words contribute 0 remaining E's → count 0, chip still present.
    const eEntry = result.find(([ch]) => ch === 'E');
    expect(eEntry).toBeDefined();
    expect(eEntry![1]).toBe(0);
  });

  /* ------------------------------------------------------------------ */
  /*  Multi-word progressive discovery                                   */
  /* ------------------------------------------------------------------ */

  it('increments count as player tries letter in more words', () => {
    // Word 0: target OOOOO, player guessed EXXXX → B for E (E not in word 0)
    // Word 1: target SLEEP, player guessed ESHIP → G for E at pos 0
    // Word 2: target EMBER, untried
    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'EXXXX', ['B', 'R', 'R', 'R', 'R'])] },
        { slot: slot(1), guesses: [entry(1, 'ESHIP', ['G', 'R', 'R', 'R', 'R'])] },
        { slot: slot(2), guesses: [] },
      ],
      resolvedTargetWords: ['OOOOO', 'SLEEP', 'EMBER'],
      solvedFlags: {},
      solvedWordsByTarget: {},
      discoveredBlueLetters: new Set(['E']),
      intersectionMap: NO_INTERSECTION,
    });

    const eEntry = result.find(([ch]) => ch === 'E');
    expect(eEntry).toBeDefined();
    // Word 0: OOOOO has 0 E's → contributes 0
    // Word 1: SLEEP has 2 E's, 1 confirmed green → remaining 1
    // Word 2: untried → excluded
    expect(eEntry![1]).toBe(1);
  });

  /* ------------------------------------------------------------------ */
  /*  Undiscovered words excluded                                        */
  /* ------------------------------------------------------------------ */

  it('excludes words where the letter was never guessed', () => {
    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'EXXXX', ['B', 'R', 'R', 'R', 'R'])] },
        { slot: slot(1), guesses: [entry(1, 'XXXXX', ['R', 'R', 'R', 'R', 'R'])] }, // tried but no E
        { slot: slot(2), guesses: [] }, // untried
      ],
      resolvedTargetWords: ['OOOOO', 'SLEEP', 'EMBER'],
      solvedFlags: {},
      solvedWordsByTarget: {},
      discoveredBlueLetters: new Set(['E']),
      intersectionMap: NO_INTERSECTION,
    });

    const eEntry = result.find(([ch]) => ch === 'E');
    expect(eEntry).toBeDefined();
    // Word 0: OOOOO → 0 E's
    // Word 1: SLEEP has 2 E's, but player never guessed E in word 1 → excluded
    // Word 2: untried → excluded
    expect(eEntry![1]).toBe(0);
  });

  /* ------------------------------------------------------------------ */
  /*  Intersection discovery                                             */
  /* ------------------------------------------------------------------ */

  it('counts crossing word inventory when letter tried at intersection', () => {
    // Word 0 (across): target OOOOO.  Player guessed ELBOW.
    //   Position 0 (E) intersects word 1 (down).
    // Word 1 (down): target EAGLE.  Player never guessed directly.
    // The intersection means E is tried in word 1 via crossing.
    const iMap: IntersectionMap = new Map([
      [0, new Map([[0, 1]])],  // word 0, pos 0 → crosses word 1
    ]);

    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'ELBOW', ['B', 'R', 'R', 'R', 'R'])] },
        { slot: slot(1), guesses: [] },
      ],
      resolvedTargetWords: ['OOOOO', 'EAGLE'],
      solvedFlags: {},
      solvedWordsByTarget: {},
      discoveredBlueLetters: new Set(['E']),
      intersectionMap: iMap,
    });

    const eEntry = result.find(([ch]) => ch === 'E');
    expect(eEntry).toBeDefined();
    // Word 0: OOOOO has 0 E's → 0
    // Word 1: EAGLE has 2 E's, 0 confirmed → 2, included via intersection
    expect(eEntry![1]).toBe(2);
  });

  /* ------------------------------------------------------------------ */
  /*  Intersection does not bleed to non-crossing words                  */
  /* ------------------------------------------------------------------ */

  it('does not count non-crossing words from intersection', () => {
    // Word 0 pos 0 crosses word 1 only. Word 2 is unrelated.
    const iMap: IntersectionMap = new Map([
      [0, new Map([[0, 1]])],
    ]);

    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'ELBOW', ['B', 'R', 'R', 'R', 'R'])] },
        { slot: slot(1), guesses: [] },
        { slot: slot(2), guesses: [] },
      ],
      resolvedTargetWords: ['OOOOO', 'EAGLE', 'EVERY'],
      solvedFlags: {},
      solvedWordsByTarget: {},
      discoveredBlueLetters: new Set(['E']),
      intersectionMap: iMap,
    });

    const eEntry = result.find(([ch]) => ch === 'E');
    expect(eEntry).toBeDefined();
    // Word 1 (EAGLE): 2 E's via intersection → 2
    // Word 2 (EVERY): 2 E's but NOT tried → excluded
    expect(eEntry![1]).toBe(2);
  });

  /* ------------------------------------------------------------------ */
  /*  Solved word exclusion                                              */
  /* ------------------------------------------------------------------ */

  it('excludes solved words from the blue pool', () => {
    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'EXXXX', ['B', 'R', 'R', 'R', 'R'])] },
        { slot: slot(1), guesses: [entry(1, 'SLEEP', ['G', 'G', 'G', 'G', 'G'])] },
      ],
      resolvedTargetWords: ['OOOOO', 'SLEEP'],
      solvedFlags: { 1: true },
      solvedWordsByTarget: { 1: 'SLEEP' },
      discoveredBlueLetters: new Set(['E']),
      intersectionMap: NO_INTERSECTION,
    });

    const eEntry = result.find(([ch]) => ch === 'E');
    expect(eEntry).toBeDefined();
    // Word 0: OOOOO → 0 E's.  Word 1: solved → excluded.
    expect(eEntry![1]).toBe(0);
  });

  /* ------------------------------------------------------------------ */
  /*  Letter not yet discovered — not in ticker                          */
  /* ------------------------------------------------------------------ */

  it('excludes letters never discovered as blue', () => {
    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'XXXXX', ['R', 'R', 'R', 'R', 'R'])] },
      ],
      resolvedTargetWords: ['EAGLE'],
      solvedFlags: {},
      solvedWordsByTarget: {},
      discoveredBlueLetters: new Set(), // nothing discovered
      intersectionMap: NO_INTERSECTION,
    });

    expect(result).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /*  Tried words exhausted, untried remain — chip with count 0          */
  /* ------------------------------------------------------------------ */

  it('returns count 0 when tried words are exhausted but letter still discovered', () => {
    // Player tried E in word 0 (B) and word 1 (G for both E's → fully confirmed).
    // Word 2 has E but untried.  discoveredBlueLetters still has E.
    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'EXXXX', ['B', 'R', 'R', 'R', 'R'])] },
        { slot: slot(1), guesses: [entry(1, 'EXEXX', ['G', 'R', 'G', 'R', 'R'])] },
        { slot: slot(2), guesses: [] },
      ],
      resolvedTargetWords: ['OOOOO', 'EXEXX', 'EMBER'],
      solvedFlags: {},
      solvedWordsByTarget: {},
      discoveredBlueLetters: new Set(['E']),
      intersectionMap: NO_INTERSECTION,
    });

    const eEntry = result.find(([ch]) => ch === 'E');
    expect(eEntry).toBeDefined();
    // Word 0: 0 E's.  Word 1: 2 E's, 2 green → 0 remaining.  Word 2: untried.
    expect(eEntry![1]).toBe(0);
  });

  /* ------------------------------------------------------------------ */
  /*  Reconciler exhaustion — letter dropped from discoveredBlueLetters  */
  /* ------------------------------------------------------------------ */

  it('excludes letter when reconciler drops it from discoveredBlueLetters', () => {
    // All words solved or E fully accounted for → reconciler collapsed B→R.
    // discoveredBlueLetters no longer has E.
    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'EXXXX', ['R', 'R', 'R', 'R', 'R'])] }, // was B, now R
        { slot: slot(1), guesses: [entry(1, 'SLEEP', ['G', 'G', 'G', 'G', 'G'])] },
      ],
      resolvedTargetWords: ['OOOOO', 'SLEEP'],
      solvedFlags: { 1: true },
      solvedWordsByTarget: { 1: 'SLEEP' },
      discoveredBlueLetters: new Set(), // E dropped by reconciler
      intersectionMap: NO_INTERSECTION,
    });

    const eEntry = result.find(([ch]) => ch === 'E');
    expect(eEntry).toBeUndefined();
  });

  /* ------------------------------------------------------------------ */
  /*  All words tried — matches full-knowledge count                     */
  /* ------------------------------------------------------------------ */

  it('matches full-knowledge count when all words have been tried', () => {
    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'EXXXX', ['B', 'R', 'R', 'R', 'R'])] },
        { slot: slot(1), guesses: [entry(1, 'EXEXX', ['G', 'R', 'R', 'R', 'R'])] },
        { slot: slot(2), guesses: [entry(2, 'EOXXX', ['R', 'R', 'R', 'R', 'R'])] },
      ],
      resolvedTargetWords: ['OOOOO', 'EXEXX', 'EMBER'],
      solvedFlags: {},
      solvedWordsByTarget: {},
      discoveredBlueLetters: new Set(['E']),
      intersectionMap: NO_INTERSECTION,
    });

    const eEntry = result.find(([ch]) => ch === 'E');
    expect(eEntry).toBeDefined();
    // Word 0: OOOOO → 0 E's
    // Word 1: EXEXX → 2 E's, 1 green → 1 remaining
    // Word 2: EMBER → 2 E's, 0 green → 2 remaining
    // Total = 3
    expect(eEntry![1]).toBe(3);
  });

  /* ------------------------------------------------------------------ */
  /*  Fallback path — no target words                                    */
  /* ------------------------------------------------------------------ */

  it('gates by direct guesses when target words are hidden', () => {
    // No resolvedTargetWords — uses estimation path.
    // Word 0: player guessed E, got B (discovered=1, confirmed=0) → slot contributes 1
    // Word 1: player never guessed E → slot excluded from E count
    const result = computeBlueTickerEntries({
      groupedHistoryList: [
        { slot: slot(0), guesses: [entry(0, 'EXXXX', ['B', 'R', 'R', 'R', 'R'])] },
        { slot: slot(1), guesses: [entry(1, 'XXXXX', ['R', 'R', 'R', 'R', 'R'])] },
      ],
      resolvedTargetWords: null,
      solvedFlags: {},
      solvedWordsByTarget: {},
      discoveredBlueLetters: new Set(['E']),
      intersectionMap: NO_INTERSECTION,
    });

    const eEntry = result.find(([ch]) => ch === 'E');
    expect(eEntry).toBeDefined();
    // Only word 0 tried E → discovered 1, confirmed 0 → remaining 1
    expect(eEntry![1]).toBe(1);
  });
});
