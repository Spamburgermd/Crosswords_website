import { createSeedSession, getSession } from './localChallengeStore';

describe('local play helper', () => {
  it('creates a seed-based session without exposing targets in names', () => {
    const sessionId = createSeedSession({
      seed: 12345,
      dictionaryId: 'twl',
      difficulty: undefined,
      timerLimitSeconds: undefined,
    });
    const session = getSession(sessionId);
    expect(session).not.toBeNull();
    expect(session?.mode).not.toBe('bot');
    if (!session || session.mode === 'bot') {
      throw new Error('Expected a non-bot local challenge session');
    }
    expect(session.role).toBe('seed');
    expect(session.targets.length).toBe(5);
    // Ensure we did not accidentally leave a human-readable seed in offerId unrelated to targets visibility
    expect(session.offerId).toBeDefined();
    expect(session.offerId ?? '').toContain('seed_');
  });
});
