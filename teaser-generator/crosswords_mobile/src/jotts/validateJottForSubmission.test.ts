import { validateJottForSubmission } from './validateJottForSubmission';

const baseJott = {
  id: 'x',
  title: 'test',
  words: ['APPLE', 'BERRY', 'CANDY', 'STONE', 'BRICK'],
  dictionaryId: 'twl',
  createdAtMs: 0,
  updatedAtMs: 0,
};

describe('validateJottForSubmission', () => {
  it('passes valid jott (length 4–6 enforced)', () => {
    const res = validateJottForSubmission(baseJott as any);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.words.length).toBe(5);
  });

  it('fails wrong lengths and duplicates', () => {
    const j = { ...baseJott, words: ['AA', 'AA', 'BBBB', 'CCCCC', 'DDDDDDDD'] };
    const res = validateJottForSubmission(j as any);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.length).toBeGreaterThan(0);
    }
  });
});
