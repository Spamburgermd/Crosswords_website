/**
 * Lightweight tests for targetWordsProvider.
 * Run with: npm test -- targetWordsProvider.test
 */

import { explainWhyMissingTargetWords, getTargetWordsForGame } from './targetWordsProvider';

describe('targetWordsProvider', () => {
  it('returns target_words if present', () => {
    const state = { target_words: ['APPLE', 'BERRY'] } as any;
    expect(getTargetWordsForGame(state, 1)).toEqual(['APPLE', 'BERRY']);
  });

  it('returns debug_solution_words when present', () => {
    const state = { debug_solution_words: ['APPLE', 'BERRY'] } as any;
    expect(getTargetWordsForGame(state, 1)).toEqual(['APPLE', 'BERRY']);
  });

  it('falls back to bot words', () => {
    const state = { debug_bot_words: ['CANDY', 'DONUT'] } as any;
    expect(getTargetWordsForGame(state, 2)).toEqual(['CANDY', 'DONUT']);
  });

  it('returns null and explains when missing', () => {
    const state = {} as any;
    expect(getTargetWordsForGame(state, 3)).toBeNull();
    const reason = explainWhyMissingTargetWords(state);
    expect(reason.toLowerCase()).toContain('server response does not include target_words');
  });
});
