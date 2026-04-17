import { computeStats } from './statsComputer';
import type { StoredResult } from './types';

function buildResult(params: {
  code: string;
  createdAtMs: number;
  mode: 'bot' | 'daily' | 'solo' | 'pvp';
  completed?: 'win' | 'lose';
  totalTargets?: number;
  totalGuesses?: number;
  solveTimeMs?: number;
  isTutorial?: boolean;
}): StoredResult {
  const completed = params.completed ?? 'win';
  const totalTargets = params.totalTargets ?? 5;
  const totalGuesses = params.totalGuesses ?? totalTargets;
  return {
    code: params.code,
    createdAtMs: params.createdAtMs,
    payload: {
      v: 1,
      challengeId: params.code,
      completed,
      attempts: totalGuesses,
      guessesByTarget: Array.from({ length: totalTargets }, () => []),
    },
    sessionSummary: {
      totalTargets,
      solvedCount: completed === 'win' ? totalTargets : Math.max(0, totalTargets - 1),
      updatedAtMs: params.createdAtMs,
      gameMode: params.mode,
      totalGuesses,
      solveTimeMs: params.solveTimeMs,
      completed,
      isTutorial: params.isTutorial,
    },
  };
}

describe('computeStats', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('excludes tutorial-tagged results from aggregate stats and daily streaks', () => {
    const nowDate = new Date(2026, 2, 31, 12, 0, 0, 0);
    const yesterdayDate = new Date(2026, 2, 30, 12, 0, 0, 0);
    const tutorialDate = new Date(2026, 2, 29, 12, 0, 0, 0);
    const now = nowDate.getTime();
    const yesterday = yesterdayDate.getTime();
    const tutorialDay = tutorialDate.getTime();

    jest.useFakeTimers().setSystemTime(now);

    const stats = computeStats([
      buildResult({
        code: 'tutorial_legacy',
        createdAtMs: tutorialDay,
        mode: 'solo',
        totalTargets: 3,
        totalGuesses: 4,
        solveTimeMs: 20000,
        isTutorial: true,
      }),
      buildResult({
        code: 'daily_today',
        createdAtMs: now,
        mode: 'daily',
        totalGuesses: 9,
        solveTimeMs: 60000,
      }),
      buildResult({
        code: 'daily_yesterday',
        createdAtMs: yesterday,
        mode: 'daily',
        totalGuesses: 10,
        solveTimeMs: 70000,
      }),
      buildResult({
        code: 'bot_loss',
        createdAtMs: now - 1000,
        mode: 'bot',
        completed: 'lose',
        totalGuesses: 7,
      }),
    ]);

    expect(stats.overall.gamesPlayed).toBe(3);
    expect(stats.overall.gamesWon).toBe(2);
    expect(stats.byMode.solo.gamesPlayed).toBe(0);
    expect(stats.byMode.daily.gamesPlayed).toBe(2);
    expect(stats.byMode.bot.gamesPlayed).toBe(1);
    expect(stats.bestStreak).toBe(2);
    expect(stats.lastPlayedDateStr).toBe('2026-03-31');
  });

  it('treats missing isTutorial as a regular stored result', () => {
    const stats = computeStats([
      buildResult({
        code: 'solo_real',
        createdAtMs: new Date(2026, 2, 31, 12, 0, 0, 0).getTime(),
        mode: 'solo',
        totalGuesses: 8,
      }),
    ]);

    expect(stats.overall.gamesPlayed).toBe(1);
    expect(stats.byMode.solo.gamesPlayed).toBe(1);
    expect(stats.overall.gamesWon).toBe(1);
  });
});
