describe('guessScoring mode guards', () => {
  it('uses server submit in pvp-style server-enabled path', async () => {
    jest.resetModules();

    const submitGuessMock = jest.fn().mockResolvedValue({ ok: true, codes: ['G', 'G', 'G', 'G', 'G'] });

    jest.doMock('@src/flags', () => ({ USE_SERVERLESS_GUESS_SCORING: false }));
    jest.doMock('@lib/api', () => ({ submitGuess: submitGuessMock }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { scoreGuess } = require('./guessScoring') as typeof import('./guessScoring');

    const res = await scoreGuess({
      apiKey: 'dummy',
      gameId: 9,
      targetIndex: 0,
      guess: 'APPLE',
      forceServerless: false,
    });

    expect(res.ok).toBe(true);
    expect(submitGuessMock).toHaveBeenCalledTimes(1);
  });

  it('skips server submit when local scoring is forced', async () => {
    jest.resetModules();

    const submitGuessMock = jest.fn().mockResolvedValue({ ok: true, codes: ['X'] });

    jest.doMock('@src/flags', () => ({ USE_SERVERLESS_GUESS_SCORING: false }));
    jest.doMock('@lib/api', () => ({ submitGuess: submitGuessMock }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { scoreGuess } = require('./guessScoring') as typeof import('./guessScoring');

    const res = await scoreGuess({
      apiKey: 'dummy',
      gameId: 10,
      targetIndex: 0,
      guess: 'APPLY',
      targetWords: ['APPLE'],
      forceServerless: true,
    });

    expect(res.ok).toBe(true);
    expect(res.codes.length).toBe(5);
    expect(submitGuessMock).not.toHaveBeenCalled();
  });
});

