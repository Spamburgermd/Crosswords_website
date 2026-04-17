/** Animation timing constants for tile reveal sequences. */
export const REVEAL_STAGGER_MS = 320;  // delay between sequential tiles in a word
export const FLIP_HALF_MS      = 200;  // duration of each half-flip

/** Total reveal animation duration for a word of the given length. */
export function totalRevealMs(wordLength: number): number {
  return Math.max(0, wordLength - 1) * REVEAL_STAGGER_MS + FLIP_HALF_MS * 2;
}
