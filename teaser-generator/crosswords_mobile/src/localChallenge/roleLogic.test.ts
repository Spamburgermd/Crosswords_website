import { inferRoleFromOffers } from './localChallengeStore';

describe('inferRoleFromOffers', () => {
  it('returns sender when offer id is present locally', () => {
    const offers = [{ payload: { offerId: 'abc' } }];
    expect(inferRoleFromOffers('abc', offers)).toBe('sender');
  });

  it('returns receiver when offer id not present', () => {
    const offers = [{ payload: { offerId: 'xyz' } }];
    expect(inferRoleFromOffers('abc', offers)).toBe('receiver');
  });

  it('returns null when no offerId provided', () => {
    expect(inferRoleFromOffers(null, [])).toBeNull();
  });
});
