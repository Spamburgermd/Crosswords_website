import type { PersistedState } from './types';
import {
  buildDailyResult,
  buildDailySession,
  buildEmptyPersistedState,
  buildSoloSession,
  buildBotSession,
  buildTutorialResult,
} from './testUtils/dailyFixtures';

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function loadStoreWithState(initialState: PersistedState) {
  const savedStates: PersistedState[] = [];

  jest.doMock('./persistence', () => ({
    CURRENT_VERSION: 4,
    loadPersistedState: jest.fn(async () => cloneState(initialState)),
    savePersistedState: jest.fn(async (state: PersistedState) => {
      savedStates.push(cloneState(state));
    }),
    summarizeSession: jest.requireActual('./persistence').summarizeSession,
  }));

  let store: typeof import('./localChallengeStore');
  let lifecycle: typeof import('./dailyLifecycle');

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = require('./localChallengeStore') as typeof import('./localChallengeStore');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lifecycle = require('./dailyLifecycle') as typeof import('./dailyLifecycle');
  });

  return { store: store!, lifecycle: lifecycle!, savedStates };
}

describe('dailyLifecycle reconciliation', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('records one loss when unfinished daily expires', async () => {
    const state = buildEmptyPersistedState();
    state.sessions.push(buildDailySession({ date: '2026-04-09', totalGuesses: 7 }));

    const { store, lifecycle } = loadStoreWithState(state);
    await lifecycle.reconcileDailySessions(new Date('2026-04-10T12:00:00'));
    await flushAsyncWork();

    expect(store.getSnapshot().sessions).toHaveLength(0);
    expect(store.getSnapshot().results).toHaveLength(1);
    expect(store.getSnapshot().results[0]?.payload.completed).toBe('lose');
  });

  it('does not duplicate a result for an already recorded expired daily', async () => {
    const solved = buildDailySession({ date: '2026-04-09', solved: true, totalGuesses: 5 });
    const state = buildEmptyPersistedState();
    state.sessions.push(solved);
    state.results.push(buildDailyResult(solved, 'win'));

    const { store, lifecycle } = loadStoreWithState(state);
    await lifecycle.reconcileDailySessions(new Date('2026-04-10T12:00:00'));
    await lifecycle.reconcileDailySessions(new Date('2026-04-10T12:00:00'));
    await flushAsyncWork();

    expect(store.getSnapshot().sessions).toHaveLength(0);
    expect(store.getSnapshot().results).toHaveLength(1);
    expect(store.getSnapshot().results[0]?.payload.completed).toBe('win');
  });

  it('removes expired daily sessions from active storage', async () => {
    const stale = buildDailySession({ date: '2026-04-09', totalGuesses: 4 });
    const current = buildDailySession({ id: 'today', date: '2026-04-10', totalGuesses: 2 });
    const state = buildEmptyPersistedState();
    state.sessions.push(stale, current);

    const { store, lifecycle } = loadStoreWithState(state);
    await lifecycle.reconcileDailySessions(new Date('2026-04-10T12:00:00'));
    await flushAsyncWork();

    expect(store.getSnapshot().sessions.map((session) => session.id)).toEqual(['today']);
  });

  it('does not affect non-daily sessions', async () => {
    const state = buildEmptyPersistedState();
    state.sessions.push(
      buildDailySession({ date: '2026-04-10', totalGuesses: 3 }),
      buildSoloSession({ id: 'solo-active' }),
      buildBotSession({ id: 'bot-active' }),
    );

    const { store, lifecycle } = loadStoreWithState(state);
    await lifecycle.reconcileDailySessions(new Date('2026-04-10T12:00:00'));
    await flushAsyncWork();

    expect(store.getSnapshot().sessions.map((session) => session.id).sort()).toEqual([
      'bot-active',
      'daily-2026-04-10',
      'solo-active',
    ]);
  });

  it('daily reconciliation ignores tutorial stats and state', async () => {
    const state = buildEmptyPersistedState();
    state.sessions.push(buildDailySession({ date: '2026-04-09', totalGuesses: 6 }));
    state.results.push(buildTutorialResult());

    const { store, lifecycle } = loadStoreWithState(state);
    await lifecycle.reconcileDailySessions(new Date('2026-04-10T12:00:00'));
    await flushAsyncWork();

    expect(store.getSnapshot().results).toHaveLength(2);
    expect(store.getSnapshot().results.some((result) => result.payload.challengeId === 'tutorial_1')).toBe(true);
    expect(store.getSnapshot().results.filter((result) => result.payload.challengeId === 'tutorial_1')).toHaveLength(1);
  });
});
