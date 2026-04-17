import { parseWords } from './wordParsing';

describe('parseWords', () => {
  it('handles spaces commas newlines', () => {
    expect(parseWords('apple, berry\ncandy')).toEqual(['APPLE', 'BERRY', 'CANDY']);
  });

  it('ignores trailing separators', () => {
    expect(parseWords('apple, berry,')).toEqual(['APPLE', 'BERRY']);
  });

  it('filters empties and uppercases', () => {
    expect(parseWords('  apple   BERRY   ')).toEqual(['APPLE', 'BERRY']);
  });
});
