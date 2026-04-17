import { loadPersistedState, savePersistedState, clearPersistedState } from './persistence';

describe('localChallenge persistence fallback', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('roundtrips in memory when FileSystem is unavailable', async () => {
    await clearPersistedState();
    const initial = await loadPersistedState();
    expect(initial.sessions.length).toBe(0);

    initial.sessions.push({
      id: 'test',
      role: 'sender',
      offerId: 'offer1',
      dictionaryId: 'twl',
      dictionaryVersion: 'v1',
      difficulty: undefined,
      timerLimitSeconds: undefined,
      targets: ['APPLE'],
      state: {
        targetWords: ['APPLE'],
        guessesByTarget: [[]],
        solvedByTarget: [false],
        rules: { smartBlue: true },
      },
      rules: { smartBlue: true },
      createdAtMs: 1,
      updatedAtMs: 1,
    });

    await savePersistedState(initial);
    const reloaded = await loadPersistedState();
    expect(reloaded.sessions[0].id).toBe('test');
  });

  it('migrates v3 tutorial results to v4 with explicit tutorial metadata', async () => {
    jest.doMock('expo-file-system/legacy', () => ({
      documentDirectory: 'file:///mock-docs/',
      getInfoAsync: jest.fn(async () => ({ exists: true })),
      readAsStringAsync: jest.fn(async () =>
        JSON.stringify({
          version: 3,
          sessions: [],
          offers: [],
          returns: [],
          bundles: [],
          results: [
            {
              code: 'tutorial-result',
              createdAtMs: 1,
              payload: {
                v: 1,
                challengeId: 'tutorial_1',
                completed: 'win',
                attempts: 4,
                guessesByTarget: [[], [], []],
              },
              sessionSummary: {
                totalTargets: 3,
                solvedCount: 3,
                updatedAtMs: 1,
                gameMode: 'solo',
                totalGuesses: 4,
                completed: 'win',
              },
            },
          ],
          hydratedAtMs: 0,
        }),
      ),
      writeAsStringAsync: jest.fn(async () => undefined),
      deleteAsync: jest.fn(async () => undefined),
    }));

    let moduleRef: typeof import('./persistence');
    jest.isolateModules(() => {
      moduleRef = require('./persistence') as typeof import('./persistence');
    });

    const migrated = await moduleRef!.loadPersistedState();
    expect(migrated.version).toBe(4);
    expect(migrated.results[0]?.sessionSummary?.isTutorial).toBe(true);
    expect(migrated.opponentResults).toEqual([]);
  });
});
