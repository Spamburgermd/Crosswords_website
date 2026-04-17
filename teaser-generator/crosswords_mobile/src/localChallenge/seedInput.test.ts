import { createRandomSeed, parseExplicitSeed } from './seedInput';

describe('seedInput helpers', () => {
  it('creates a stable pseudo-random seed from the provided clock value', () => {
    expect(createRandomSeed(1_234_567)).toBe(234567);
    expect(createRandomSeed(1_234_567)).toBe(createRandomSeed(1_234_567));
  });

  it('accepts explicit numeric seeds including zero', () => {
    expect(parseExplicitSeed('0')).toEqual({ ok: true, seed: 0 });
    expect(parseExplicitSeed('12345')).toEqual({ ok: true, seed: 12345 });
    expect(parseExplicitSeed('00012')).toEqual({ ok: true, seed: 12 });
  });

  it('rejects empty or non-numeric explicit seeds', () => {
    expect(parseExplicitSeed('')).toEqual({
      ok: false,
      error: 'Enter a numeric seed.',
    });
    expect(parseExplicitSeed('abc')).toEqual({
      ok: false,
      error: 'Seed must contain digits only.',
    });
    expect(parseExplicitSeed('12abc')).toEqual({
      ok: false,
      error: 'Seed must contain digits only.',
    });
  });
});
