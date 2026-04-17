import { parseTutorialBody, type TutorialBodySegment } from './parseTutorialBody';

describe('parseTutorialBody', () => {
  it('returns plain text as a single text segment', () => {
    const result = parseTutorialBody('Hello world');
    expect(result).toEqual([{ type: 'text', value: 'Hello world' }]);
  });

  it('parses a swatch token into a swatch segment', () => {
    const result = parseTutorialBody('The O is {{correct}} nice');
    expect(result).toEqual([
      { type: 'text', value: 'The O is ' },
      { type: 'swatch', paletteKey: 'correct' },
      { type: 'text', value: ' nice' },
    ]);
  });

  it('parses multiple tokens', () => {
    const result = parseTutorialBody('{{correct}} and {{notInWord}}');
    expect(result).toEqual([
      { type: 'swatch', paletteKey: 'correct' },
      { type: 'text', value: ' and ' },
      { type: 'swatch', paletteKey: 'notInWord' },
    ]);
  });

  it('handles all four palette keys', () => {
    const result = parseTutorialBody('{{correct}}{{wrongSpot}}{{notInWord}}{{notInPuzzle}}');
    expect(result).toEqual([
      { type: 'swatch', paletteKey: 'correct' },
      { type: 'swatch', paletteKey: 'wrongSpot' },
      { type: 'swatch', paletteKey: 'notInWord' },
      { type: 'swatch', paletteKey: 'notInPuzzle' },
    ]);
  });

  it('treats unknown tokens as plain text', () => {
    const result = parseTutorialBody('{{unknown}} stuff');
    expect(result).toEqual([{ type: 'text', value: '{{unknown}} stuff' }]);
  });
});
