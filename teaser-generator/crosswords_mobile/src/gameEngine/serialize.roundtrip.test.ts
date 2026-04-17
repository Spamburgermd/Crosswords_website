import { encodeChallenge, decodeChallenge, encodeResult, decodeResult } from './serialize';

describe('serialize roundtrip', () => {
  it('challenge roundtrip', () => {
    const payload = { v: 1, words: ['APPLE', 'BERRY'], rules: { smartBlue: true }, createdAtMs: 42 };
    const code = encodeChallenge(payload as any);
    const decoded = decodeChallenge(code);
    expect(decoded.words).toEqual(payload.words);
    expect(decoded.rules.smartBlue).toBe(true);
  });

  it('result roundtrip', () => {
    const payload = { v: 1, challengeId: 'abc', completed: 'win', attempts: 7, timeMs: 1234 };
    const code = encodeResult(payload as any);
    const decoded = decodeResult(code);
    expect(decoded.challengeId).toBe('abc');
    expect(decoded.completed).toBe('win');
    expect(decoded.attempts).toBe(7);
  });
});
