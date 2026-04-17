/**
 * Smoke tests for local challenge flow pieces.
 */

jest.mock('pako', () => {
  const { TextEncoder, TextDecoder } = require('util');
  return {
    deflate: (s: string) => new TextEncoder().encode(s),
    inflate: (u: Uint8Array) => new TextDecoder().decode(u),
  };
}, { virtual: true });

import { encodeChallenge, decodeChallenge } from './serialize';
import { initGameFromChallenge, applyGuess } from './state';
import type { ChallengePayload } from './types';

describe('challenge encode/decode roundtrip', () => {
  it('preserves payload fields', () => {
    const payload: ChallengePayload = { v: 1, words: ['APPLE', 'BERRY'], rules: { smartBlue: true }, createdAtMs: 123 };
    const code = encodeChallenge(payload);
    const decoded = decodeChallenge(code);
    expect(decoded.words).toEqual(payload.words);
    expect(decoded.rules.smartBlue).toBe(true);
  });
});

describe('applyGuess smoke', () => {
  it('computes codes and updates state', () => {
    const payload: ChallengePayload = { v: 1, words: ['APPLE'], rules: { smartBlue: true }, createdAtMs: Date.now() };
    const state = initGameFromChallenge(payload);
    const { nextState, result } = applyGuess(state, 0, 'APPLY');
    expect(result.codes.length).toBe(5);
    expect(nextState.guessesByTarget[0].length).toBe(1);
  });
});
