import { evaluateDailyAvailability, findActiveNonDailySession, isCurrentDailySession } from './dailyLifecycle';
import {
  buildBotSession,
  buildDailySession,
  buildEmptyPersistedState,
  buildSoloSession,
} from './testUtils/dailyFixtures';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: null,
}));

describe('dailyLifecycle evaluator', () => {
  const today = new Date('2026-04-10T12:00:00');

  it('returns play when no current-day daily session exists', () => {
    const snapshot = buildEmptyPersistedState();

    expect(evaluateDailyAvailability(snapshot, today)).toEqual({
      todayDate: '2026-04-10',
      status: 'play',
      guessesUsed: 0,
      guessLimit: 25,
    });
  });

  it('returns resume for current-day unfinished daily', () => {
    const session = buildDailySession({ date: '2026-04-10', totalGuesses: 4, guessTurnLimit: 25 });
    const snapshot = buildEmptyPersistedState();
    snapshot.sessions.push(session);

    expect(evaluateDailyAvailability(snapshot, today)).toEqual({
      todayDate: '2026-04-10',
      status: 'resume',
      sessionId: session.id,
      guessesUsed: 4,
      guessLimit: 25,
    });
  });

  it('returns won for current-day solved daily', () => {
    const session = buildDailySession({ date: '2026-04-10', solved: true, totalGuesses: 5 });
    const snapshot = buildEmptyPersistedState();
    snapshot.sessions.push(session);

    expect(evaluateDailyAvailability(snapshot, today).status).toBe('won');
  });

  it('returns lost for current-day out-of-guesses daily', () => {
    const session = buildDailySession({ date: '2026-04-10', totalGuesses: 25, guessTurnLimit: 25 });
    const snapshot = buildEmptyPersistedState();
    snapshot.sessions.push(session);

    const result = evaluateDailyAvailability(snapshot, today);
    expect(result.status).toBe('lost');
    expect(result.guessesUsed).toBe(25);
    expect(result.guessLimit).toBe(25);
  });

  it('treats prior-day sessions as not resumable', () => {
    const snapshot = buildEmptyPersistedState();
    snapshot.sessions.push(buildDailySession({ date: '2026-04-09', totalGuesses: 6 }));

    expect(evaluateDailyAvailability(snapshot, today).status).toBe('play');
  });

  it('prefers most recently updated session when duplicates exist', () => {
    const older = buildDailySession({ id: 'older', date: '2026-04-10', totalGuesses: 2, updatedAtMs: 10 });
    const newer = buildDailySession({ id: 'newer', date: '2026-04-10', totalGuesses: 8, updatedAtMs: 20 });
    const snapshot = buildEmptyPersistedState();
    snapshot.sessions.push(older, newer);

    const result = evaluateDailyAvailability(snapshot, today);
    expect(result.sessionId).toBe('newer');
    expect(result.guessesUsed).toBe(8);
  });
});

describe('dailyLifecycle congruence helpers', () => {
  const today = new Date('2026-04-10T12:00:00');

  it('generic resume excludes all daily sessions', () => {
    const daily = buildDailySession({ date: '2026-04-10', totalGuesses: 4 });
    expect(findActiveNonDailySession([daily] as any[])).toBeNull();
  });

  it('non-daily active sessions still render generic resume', () => {
    const solo = buildSoloSession({ id: 'solo-1' });
    const bot = buildBotSession({ id: 'bot-1' });

    expect(findActiveNonDailySession([solo] as any[])).toEqual({ id: 'solo-1', mode: 'solo' });
    expect(findActiveNonDailySession([solo, bot] as any[])).toEqual({ id: 'bot-1', mode: 'bot' });
  });

  it('allows current-day daily session', () => {
    const daily = buildDailySession({ date: '2026-04-10', totalGuesses: 1 });
    expect(isCurrentDailySession(daily as any, today)).toBe(true);
  });

  it('redirects stale daily session to lobby', () => {
    const staleDaily = buildDailySession({ date: '2026-04-09', solved: true });
    expect(isCurrentDailySession(staleDaily as any, today)).toBe(false);
  });
});
