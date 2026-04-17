import { parseDeepLink } from './deepLinking';

describe('parseDeepLink', () => {
  it('parses path style challenge', () => {
    expect(parseDeepLink('myapp://c/ABC')).toEqual({ kind: 'challenge', code: 'ABC' });
  });

  it('parses path style result', () => {
    expect(parseDeepLink('myapp://r/XYZ')).toEqual({ kind: 'result', code: 'XYZ' });
  });

  it('parses path style offer', () => {
    expect(parseDeepLink('myapp://offer/ABC')).toEqual({ kind: 'offer', code: 'ABC' });
  });

  it('parses path style return', () => {
    expect(parseDeepLink('myapp://return/RET123')).toEqual({ kind: 'return', code: 'RET123' });
  });

  it('parses query style challenge', () => {
    expect(parseDeepLink('myapp://challenge?code=HELLO')).toEqual({ kind: 'challenge', code: 'HELLO' });
  });

  it('parses query style result', () => {
    expect(parseDeepLink('myapp://result?code=WORLD')).toEqual({ kind: 'result', code: 'WORLD' });
  });

  it('parses query style offer/return', () => {
    expect(parseDeepLink('myapp://offer?code=AAA')).toEqual({ kind: 'offer', code: 'AAA' });
    expect(parseDeepLink('myapp://return?code=BBB')).toEqual({ kind: 'return', code: 'BBB' });
  });

  it('returns null for invalid', () => {
    expect(parseDeepLink('not-a-url')).toEqual({ kind: null });
  });
});
