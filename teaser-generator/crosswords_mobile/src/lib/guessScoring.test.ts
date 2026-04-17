import { initGameFromChallenge } from '../gameEngine/state';

jest.mock('@src/flags', () => ({ USE_SERVERLESS_GUESS_SCORING: true }));

describe('scoreGuess uses provider-derived target words', () => {
  it('scores using target_words from gameState', async () => {
    const { scoreGuess } = require('./guessScoring') as typeof import('./guessScoring');
    const payload = { v: 1, words: ['APPLE'], rules: { smartBlue: true }, createdAtMs: Date.now() };
    const gameState = { target_words: payload.words };
    const res = await scoreGuess({
      apiKey: 'dummy',
      gameId: 1,
      targetIndex: 0,
      guess: 'APPLY',
      gameState,
    });
    expect(res.ok).toBe(true);
    expect(res.codes.length).toBe(5);
  });
});
