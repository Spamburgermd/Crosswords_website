import {
  beginRevealOwnership,
  resolveRevealTargetIndex,
} from './revealOwnership';

describe('revealOwnership', () => {
  it('treats reveal ownership as active before its expiry', () => {
    const reveal = beginRevealOwnership(3, 1_000, 600);

    expect(resolveRevealTargetIndex(reveal, 1_000)).toBe(3);
    expect(resolveRevealTargetIndex(reveal, 1_599)).toBe(3);
  });

  it('expires reveal ownership at or after its deadline', () => {
    const reveal = beginRevealOwnership(2, 5_000, 400);

    expect(resolveRevealTargetIndex(reveal, 5_400)).toBeNull();
    expect(resolveRevealTargetIndex(reveal, 5_900)).toBeNull();
  });

  it('returns null when no reveal ownership exists', () => {
    expect(resolveRevealTargetIndex(null, 10_000)).toBeNull();
  });
});
