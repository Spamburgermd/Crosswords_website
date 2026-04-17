// crosswords_mobile/src/screens/tutorial/tutorialWin.test.ts
import { isAllSolved, countTotalGuesses } from './tutorialWin';

describe('isAllSolved', () => {
  test('returns false when no words are solved', () => {
    expect(isAllSolved({ 0: false, 1: false, 2: false })).toBe(false);
  });

  test('returns false when only some words are solved', () => {
    expect(isAllSolved({ 0: true, 1: false, 2: true })).toBe(false);
  });

  test('returns true when all words are solved', () => {
    expect(isAllSolved({ 0: true, 1: true, 2: true })).toBe(true);
  });

  test('returns false for empty flags', () => {
    expect(isAllSolved({})).toBe(false);
  });
});

describe('countTotalGuesses', () => {
  test('returns 0 for empty history', () => {
    expect(countTotalGuesses(new Map())).toBe(0);
  });

  test('sums guesses across all targets', () => {
    const history = new Map<number, unknown[]>();
    history.set(0, [{}, {}, {}]);   // 3 guesses
    history.set(1, [{}]);           // 1 guess
    history.set(2, [{}, {}]);       // 2 guesses
    expect(countTotalGuesses(history)).toBe(6);
  });
});
