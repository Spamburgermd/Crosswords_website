/**
 * src/localChallenge/statsComputer.ts
 * -----------------------------------------------------------
 * Pure computation module: derives aggregate stats from StoredResult[].
 * No side effects, no storage access — easily unit-testable.
 */

import type { StoredResult } from './types';

export type ModeStats = {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  /** Average total guesses per word across won games. */
  avgGuessesPerWord: number;
  /** Fewest total guesses in a single won game. */
  bestGameGuesses: number | null;
  /** Average wall-clock solve time across won games with time data. */
  avgSolveTimeMs: number | null;
  /** Fastest solve time across won games with time data. */
  fastestSolveTimeMs: number | null;
};

export type GameStats = {
  overall: ModeStats;
  byMode: {
    bot: ModeStats;
    daily: ModeStats;
    solo: ModeStats;
    pvp: ModeStats;
  };
  /** Consecutive calendar days with a daily puzzle win. */
  currentStreak: number;
  /** Longest consecutive-day daily puzzle win streak ever. */
  bestStreak: number;
  lastPlayedDateStr: string | null;
};

type GameMode = 'bot' | 'daily' | 'solo' | 'pvp';

const EMPTY_MODE_STATS: ModeStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  winRate: 0,
  avgGuessesPerWord: 0,
  bestGameGuesses: null,
  avgSolveTimeMs: null,
  fastestSolveTimeMs: null,
};

function isTutorialResult(result: StoredResult): boolean {
  if (result.sessionSummary?.isTutorial != null) {
    return result.sessionSummary.isTutorial;
  }
  return result.payload.challengeId.startsWith('tutorial_');
}

function toLocalDateStr(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeModeStats(results: StoredResult[]): ModeStats {
  if (results.length === 0) return { ...EMPTY_MODE_STATS };

  let gamesPlayed = 0;
  let gamesWon = 0;
  let totalGuessesSum = 0;
  let totalWordsSum = 0;
  let bestGuesses: number | null = null;
  let solveTimeSum = 0;
  let solveTimeCount = 0;
  let fastestTime: number | null = null;

  for (const r of results) {
    gamesPlayed++;
    const s = r.sessionSummary;
    const completed = s?.completed ?? r.payload.completed;
    const isWin = completed === 'win';
    if (isWin) {
      gamesWon++;
      const guesses = s?.totalGuesses ?? r.payload.attempts;
      const targets = s?.totalTargets ?? 5;
      if (guesses != null && guesses > 0) {
        totalGuessesSum += guesses;
        totalWordsSum += targets;
        if (bestGuesses === null || guesses < bestGuesses) {
          bestGuesses = guesses;
        }
      }
      const time = s?.solveTimeMs;
      if (time != null && time > 0) {
        solveTimeSum += time;
        solveTimeCount++;
        if (fastestTime === null || time < fastestTime) {
          fastestTime = time;
        }
      }
    }
  }

  return {
    gamesPlayed,
    gamesWon,
    winRate: gamesPlayed > 0 ? gamesWon / gamesPlayed : 0,
    avgGuessesPerWord: totalWordsSum > 0 ? totalGuessesSum / totalWordsSum : 0,
    bestGameGuesses: bestGuesses,
    avgSolveTimeMs: solveTimeCount > 0 ? solveTimeSum / solveTimeCount : null,
    fastestSolveTimeMs: fastestTime,
  };
}

function isConsecutiveDay(dateA: string, dateB: string): boolean {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diffMs = b.getTime() - a.getTime();
  return diffMs >= 23 * 3600000 && diffMs <= 25 * 3600000;
}

function computeStreaks(results: StoredResult[]): { currentStreak: number; bestStreak: number } {
  // Collect unique calendar dates of daily wins
  const winDates = new Set<string>();
  for (const r of results) {
    const completed = r.sessionSummary?.completed ?? r.payload.completed;
    const isDaily = r.sessionSummary?.gameMode === 'daily';
    if (completed === 'win' && isDaily) {
      winDates.add(toLocalDateStr(r.createdAtMs));
    }
  }

  if (winDates.size === 0) return { currentStreak: 0, bestStreak: 0 };

  const sortedDates = Array.from(winDates).sort();

  // Best streak: longest consecutive-day run
  let bestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    if (isConsecutiveDay(sortedDates[i - 1], sortedDates[i])) {
      runLength++;
    } else {
      runLength = 1;
    }
    if (runLength > bestStreak) bestStreak = runLength;
  }

  // Current streak: walk backward from today (or yesterday)
  const today = toLocalDateStr(Date.now());
  let startDate = today;
  if (!winDates.has(today)) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toLocalDateStr(yesterday.getTime());
    if (!winDates.has(yesterdayStr)) {
      return { currentStreak: 0, bestStreak };
    }
    startDate = yesterdayStr;
  }

  let currentStreak = 1;
  const d = new Date(startDate);
  d.setDate(d.getDate() - 1);
  while (winDates.has(toLocalDateStr(d.getTime()))) {
    currentStreak++;
    d.setDate(d.getDate() - 1);
  }

  return { currentStreak, bestStreak };
}

export function computeStats(results: StoredResult[]): GameStats {
  const trackedResults = results.filter((result) => !isTutorialResult(result));

  // Partition by mode
  const byModeMap: Record<GameMode, StoredResult[]> = {
    bot: [],
    daily: [],
    solo: [],
    pvp: [],
  };

  for (const r of trackedResults) {
    const mode = r.sessionSummary?.gameMode;
    if (mode && mode in byModeMap) {
      byModeMap[mode].push(r);
    }
  }

  const { currentStreak, bestStreak } = computeStreaks(trackedResults);

  // Sort by date descending to find last played
  const sorted = [...trackedResults].sort((a, b) => b.createdAtMs - a.createdAtMs);
  const lastPlayedDateStr = sorted.length > 0 ? toLocalDateStr(sorted[0].createdAtMs) : null;

  return {
    overall: computeModeStats(trackedResults),
    byMode: {
      bot: computeModeStats(byModeMap.bot),
      daily: computeModeStats(byModeMap.daily),
      solo: computeModeStats(byModeMap.solo),
      pvp: computeModeStats(byModeMap.pvp),
    },
    currentStreak,
    bestStreak,
    lastPlayedDateStr,
  };
}
