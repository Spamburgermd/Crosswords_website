describe('api guard when server functions are disabled', () => {
  it('throws before network call in submitGuess', async () => {
    jest.resetModules();
    jest.doMock('expo/virtual/env', () => ({ env: {} }), { virtual: true });
    jest.doMock('@src/flags', () => ({
      isServerFunctionsEnabled: () => false,
    }));
    (globalThis as unknown as { __DEV__?: boolean }).__DEV__ = false;

    const fetchMock = jest.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { submitGuess } = require('./api') as typeof import('./api');

    await expect(
      submitGuess('dummy', 123, { target_index: 0, guess: 'APPLE' }),
    ).rejects.toThrow('Server functions disabled');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
