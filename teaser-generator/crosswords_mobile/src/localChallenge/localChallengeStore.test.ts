import type { PersistedState } from './types';

function buildEmptyPersistedState(): PersistedState {
  return {
    version: 4,
    sessions: [],
    offers: [],
    returns: [],
    bundles: [],
    results: [],
    opponentResults: [],
    hydratedAtMs: 0,
  };
}

function buildDailySession() {
  return {
    id: 'daily-session-1',
    mode: 'solo' as const,
    role: 'seed' as const,
    offerId: 'daily-offer-1',
    dictionaryId: 'standard',
    dictionaryVersion: 'v1',
    difficulty: 'daily',
    timerLimitSeconds: undefined,
    dailyDate: '2026-03-31',
    guessTurnLimit: 30,
    targets: ['HOUSE', 'PUDDLE', 'ALSO', 'STONE', 'TRAIL'],
    state: {
      targetWords: ['HOUSE', 'PUDDLE', 'ALSO', 'STONE', 'TRAIL'],
      guessesByTarget: [
        ['HOUSE'],
        ['PUDDLE'],
        ['ALSO'],
        ['STONE'],
        ['TRAIL'],
      ],
      solvedByTarget: [true, true, true, true, true],
      rules: { smartBlue: true },
      startedAtMs: 10,
    },
    rules: { smartBlue: true },
    createdAtMs: 10,
    updatedAtMs: 10,
  };
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('localChallengeStore hydration', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('preserves a daily result recorded before hydration completes', async () => {
    const persistedState = buildEmptyPersistedState();
    const savedStates: PersistedState[] = [];
    const deferredLoad: { resolve: (value: PersistedState) => void } = {
      resolve: () => undefined,
    };

    jest.doMock('./persistence', () => ({
      CURRENT_VERSION: 4,
      loadPersistedState: jest.fn(
        () =>
          new Promise<PersistedState>((resolve) => {
            deferredLoad.resolve = resolve;
          }),
      ),
      savePersistedState: jest.fn(async (state: PersistedState) => {
        savedStates.push(JSON.parse(JSON.stringify(state)) as PersistedState);
      }),
      summarizeSession: jest.requireActual('./persistence').summarizeSession,
    }));

    let store: typeof import('./localChallengeStore');
    jest.isolateModules(() => {
      // Import after mocking persistence so module startup begins with delayed hydration.
      store = require('./localChallengeStore') as typeof import('./localChallengeStore');
    });

    store!.recordResultFromSession(buildDailySession(), { completedAtMs: 20 });
    expect(store!.getSnapshot().results).toHaveLength(1);
    expect(store!.getSnapshot().hydrated).toBe(false);

    deferredLoad.resolve(persistedState);
    await flushAsyncWork();
    await flushAsyncWork();

    expect(store!.getSnapshot().hydrated).toBe(true);
    expect(store!.getSnapshot().results).toHaveLength(1);
    expect(store!.getSnapshot().results[0]?.sessionSummary?.gameMode).toBe('daily');
    expect(savedStates[savedStates.length - 1]?.results).toHaveLength(1);
  });
});
