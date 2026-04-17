import {
  canonicalizeDictionaryId,
  getGuessValidationDictionaryId,
  getVisibleDictionaryOptions,
  isValidGuessWord,
  isValidWord,
  supportsCurrentTargetPattern,
} from './dictionaryAdapter';

describe('dictionaryAdapter', () => {
  it('maps legacy ids to canonical ids', () => {
    expect(canonicalizeDictionaryId('common')).toBe('core');
    expect(canonicalizeDictionaryId('modified')).toBe('standard');
    expect(canonicalizeDictionaryId('twl')).toBe('canon');
  });

  it('keeps junior hidden from visible options', () => {
    expect(getVisibleDictionaryOptions()).toEqual(['core', 'standard', 'advanced', 'canon']);
  });

  it('flags current-pattern support correctly', () => {
    expect(supportsCurrentTargetPattern('core')).toBe(true);
    expect(supportsCurrentTargetPattern('standard')).toBe(true);
    expect(supportsCurrentTargetPattern('advanced')).toBe(true);
    expect(supportsCurrentTargetPattern('canon')).toBe(true);
    expect(supportsCurrentTargetPattern('junior')).toBe(false);
  });

  it('validates words for canonical and legacy ids', () => {
    expect(isValidWord('ABOUT', 'common')).toBe(true);
    expect(isValidWord('ABOUT', 'core')).toBe(true);
    expect(isValidWord('ABOUT', 'advanced')).toBe(true);
  });

  it('excludes selected country names from the casual/core tier only', () => {
    for (const word of ['MALI', 'JAPAN', 'SPAIN', 'BRAZIL', 'PANAMA', 'CYPRUS']) {
      expect(isValidWord(word, 'core')).toBe(false);
      expect(isValidWord(word, 'common')).toBe(false);
      expect(isValidWord(word, 'canon')).toBe(true);
    }
  });

  it('uses canon tier for guess validation policy', () => {
    expect(getGuessValidationDictionaryId('core')).toBe('canon');
    expect(getGuessValidationDictionaryId('standard')).toBe('canon');
    expect(isValidGuessWord('ABOUT', 'core')).toBe(true);
  });
});
