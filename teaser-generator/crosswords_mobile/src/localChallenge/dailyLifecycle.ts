/**
 * src/localChallenge/dailyLifecycle.ts
 * -----------------------------------------------------------
 * Single source of truth for Daily Puzzle availability.
 *
 * Responsibilities:
 * - Evaluate the current day's daily state from persisted sessions/results.
 * - Reconcile stale daily sessions when a new local day begins.
 * - Provide pure helpers so UI entry points stay congruent.
 */

import {
  deleteSession,
  ensureHydrated,
  getDailyPuzzleDate,
  getSnapshot,
  recordResultFromSession,
  type LocalChallengeSession,
  type SoloOrPvPSession,
} from './localChallengeStore';
import type { StoredResult } from './types';

export type DailyAvailabilityStatus = 'play' | 'resume' | 'won' | 'lost';

export type DailyAvailabilitySnapshot = {
  todayDate: string;
  status: DailyAvailabilityStatus;
  sessionId?: string;
  guessesUsed: number;
  guessLimit: number;
};

export type ActiveLocalResumeSession = {
  id: string;
  mode: 'solo' | 'bot';
};

type DailyStateInput = Pick<ReturnType<typeof getSnapshot>, 'sessions' | 'results'>;

const DEFAULT_DAILY_GUESS_LIMIT = 25;

function isSoloSession(session: LocalChallengeSession): session is SoloOrPvPSession {
  return session.mode !== 'bot';
}

function isDailySession(session: LocalChallengeSession): session is SoloOrPvPSession & { dailyDate: string } {
  return isSoloSession(session) && typeof session.dailyDate === 'string' && session.dailyDate.length > 0;
}

function getGuessesUsed(session: SoloOrPvPSession): number {
  return session.state.guessesByTarget?.reduce((sum, guesses) => sum + (guesses?.length ?? 0), 0) ?? 0;
}

function getGuessLimit(session: SoloOrPvPSession | null | undefined): number {
  return session?.guessTurnLimit ?? DEFAULT_DAILY_GUESS_LIMIT;
}

function isSolved(session: SoloOrPvPSession): boolean {
  return session.state.solvedByTarget?.every(Boolean) === true;
}

function isOutOfGuesses(session: SoloOrPvPSession): boolean {
  return !isSolved(session) && getGuessesUsed(session) >= getGuessLimit(session);
}

function getSessionOutcome(session: SoloOrPvPSession): DailyAvailabilityStatus {
  if (isSolved(session)) return 'won';
  if (isOutOfGuesses(session)) return 'lost';
  return 'resume';
}

function getChallengeId(session: SoloOrPvPSession): string {
  return session.offerId ?? session.id;
}

function hasResultForSession(results: StoredResult[], session: SoloOrPvPSession): boolean {
  const challengeId = getChallengeId(session);
  return results.some((result) => result.payload.challengeId === challengeId);
}

function selectLatestDailySessionForDate(
  sessions: LocalChallengeSession[],
  dateStr: string,
): (SoloOrPvPSession & { dailyDate: string }) | null {
  const matches = sessions
    .filter(isDailySession)
    .filter((session) => session.dailyDate === dateStr)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  return matches[0] ?? null;
}

export function evaluateDailyAvailability(
  snapshot: DailyStateInput,
  now: Date = new Date(),
): DailyAvailabilitySnapshot {
  const todayDate = getDailyPuzzleDate(now);
  const session = selectLatestDailySessionForDate(snapshot.sessions, todayDate);

  if (!session) {
    return {
      todayDate,
      status: 'play',
      guessesUsed: 0,
      guessLimit: DEFAULT_DAILY_GUESS_LIMIT,
    };
  }

  return {
    todayDate,
    status: getSessionOutcome(session),
    sessionId: session.id,
    guessesUsed: getGuessesUsed(session),
    guessLimit: getGuessLimit(session),
  };
}

export function getDailyAvailability(now: Date = new Date()): DailyAvailabilitySnapshot {
  return evaluateDailyAvailability(getSnapshot(), now);
}

export function findActiveNonDailySession(
  sessions: LocalChallengeSession[] = getSnapshot().sessions,
): ActiveLocalResumeSession | null {
  const activeBot = sessions.find((session) => session.mode === 'bot' && session.status === 'active');
  if (activeBot) {
    return { id: activeBot.id, mode: 'bot' };
  }

  const activeSolo = sessions.find((session) => {
    if (!isSoloSession(session) || session.dailyDate) return false;
    const sessionState = session.state as { status?: string } | undefined;
    return sessionState?.status === 'active';
  });

  if (!activeSolo) return null;
  return { id: activeSolo.id, mode: 'solo' };
}

export function isCurrentDailySession(
  session: LocalChallengeSession | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!session || !isDailySession(session)) return false;
  return session.dailyDate === getDailyPuzzleDate(now);
}

export async function reconcileDailySessions(now: Date = new Date()): Promise<DailyAvailabilitySnapshot> {
  await ensureHydrated();

  const todayDate = getDailyPuzzleDate(now);
  const nowMs = now.getTime();
  const snapshot = getSnapshot();
  const dailySessions = snapshot.sessions.filter(isDailySession);

  const currentDaySessions = dailySessions
    .filter((session) => session.dailyDate === todayDate)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  const staleSessions = dailySessions.filter((session) => session.dailyDate < todayDate);
  const duplicateCurrentDaySessions = currentDaySessions.slice(1);

  for (const session of staleSessions) {
    const latestResults = getSnapshot().results;
    if (!hasResultForSession(latestResults, session)) {
      const status = getSessionOutcome(session);
      recordResultFromSession(session, {
        completedAtMs: nowMs,
        forceCompleted: status === 'won' ? 'win' : 'lose',
      });
    }
    deleteSession(session.id);
  }

  for (const session of duplicateCurrentDaySessions) {
    deleteSession(session.id);
  }

  return getDailyAvailability(now);
}
