import { totalRevealMs, REVEAL_STAGGER_MS, FLIP_HALF_MS } from '@src/animations/revealTiming';

describe('totalRevealMs', () => {
  it('returns full flip duration for a 1-letter word (no stagger)', () => {
    expect(totalRevealMs(1)).toBe(FLIP_HALF_MS * 2); // 400ms
  });

  it('returns stagger * (n-1) + flip for a 5-letter word', () => {
    // (5-1)*320 + 400 = 1680
    expect(totalRevealMs(5)).toBe(4 * REVEAL_STAGGER_MS + FLIP_HALF_MS * 2);
  });

  it('returns 0-safe for zero-length input', () => {
    expect(totalRevealMs(0)).toBe(FLIP_HALF_MS * 2);
  });
});
