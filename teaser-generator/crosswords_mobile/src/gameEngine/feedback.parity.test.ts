/**
 * Parity tests comparing local engine feedback to golden fixtures
 * captured from the FastAPI server. Run with: npm test -- feedback.parity.test
 */

import fs from 'fs';
import path from 'path';

import { applyGuess, initGameFromChallenge } from './state';
import { diffCodes } from './parity';
import type { Rules } from './types';

type Fixture = {
  name: string;
  targetWords: string[];
  targetIndex: number;
  guessWord: string;
  rules: Rules;
  expectedCodes: string[];
};

function loadFixtures(): Fixture[] {
  const file = path.join(__dirname, '__fixtures__', 'guess_fixtures.json');
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as Fixture[];
}

describe('applyGuess parity vs server fixtures (blue pool aware)', () => {
  const fixtures = loadFixtures();

  fixtures.forEach((fx) => {
    it(`matches fixture: ${fx.name}`, () => {
      const state = initGameFromChallenge({
        v: 1,
        words: fx.targetWords,
        rules: fx.rules,
        createdAtMs: Date.now(),
      });
      const { result } = applyGuess(state, fx.targetIndex, fx.guessWord);
      const cmp = diffCodes(fx.expectedCodes, result.codes);
      expect(cmp.ok).toBe(true);
      if (!cmp.ok && cmp.message) {
        throw new Error(cmp.message);
      }
    });
  });
});

describe('scoreGuess serverless branch (local only)', () => {
  it('returns codes consistent with computeFeedback when flag is forced on', async () => {
    // Mock the flag module so the adapter takes the serverless path without importing Expo env.
    jest.resetModules();
    jest.doMock('@src/flags', () => ({ USE_SERVERLESS_GUESS_SCORING: true }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { scoreGuess } = require('../lib/guessScoring') as typeof import('../lib/guessScoring');

    const targetWords = ['APPLE'];
    const guess = 'AMPLE';
    const baseState = initGameFromChallenge({
      v: 1,
      words: targetWords,
      rules: { smartBlue: true },
      createdAtMs: Date.now(),
    });
    const expectCodes = applyGuess(baseState, 0, guess).result.codes;

    const res = await scoreGuess({
      apiKey: 'dummy',
      gameId: 999,
      targetIndex: 0,
      guess,
      targetWords,
    });

    expect(res.ok).toBe(true);
    const cmp = diffCodes(expectCodes, res.codes);
    expect(cmp.ok).toBe(true);
  });
});
