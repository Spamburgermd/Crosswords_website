import type { Rules } from '../../gameEngine/types';
import type { PersistedBotSession, PersistedSoloOrPvPSession, PersistedState, StoredResult } from '../types';

const DEFAULT_RULES: Rules = { smartBlue: true };
const DEFAULT_TARGETS = ['HOUSE', 'PUDDLE', 'ALSO', 'STONE', 'TRAIL'];

function buildGuessRows(totalGuesses: number, targetCount: number = DEFAULT_TARGETS.length): string[][] {
  const rows = Array.from({ length: targetCount }, () => [] as string[]);
  for (let i = 0; i < totalGuesses; i += 1) {
    rows[i % targetCount].push(`GUESS_${i}`);
  }
  return rows;
}

export function buildEmptyPersistedState(): PersistedState {
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

export function buildDailySession(params: {
  id?: string;
  date: string;
  updatedAtMs?: number;
  solved?: boolean;
  totalGuesses?: number;
  guessTurnLimit?: number;
}): PersistedSoloOrPvPSession {
  const targetCount = DEFAULT_TARGETS.length;
  const solved = params.solved ?? false;
  const totalGuesses = params.totalGuesses ?? (solved ? targetCount : 0);

  return {
    id: params.id ?? `daily-${params.date}`,
    mode: 'solo',
    role: 'seed',
    offerId: `seed_${params.date.replace(/-/g, '')}`,
    dictionaryId: 'core',
    dictionaryVersion: 'v1',
    difficulty: 'daily',
    timerLimitSeconds: undefined,
    dailyDate: params.date,
    guessTurnLimit: params.guessTurnLimit ?? 25,
    targets: [...DEFAULT_TARGETS],
    state: {
      targetWords: [...DEFAULT_TARGETS],
      guessesByTarget: buildGuessRows(totalGuesses, targetCount),
      solvedByTarget: Array.from({ length: targetCount }, () => solved),
      rules: DEFAULT_RULES,
      startedAtMs: 1,
    },
    rules: DEFAULT_RULES,
    createdAtMs: 1,
    updatedAtMs: params.updatedAtMs ?? 1,
  };
}

export function buildSoloSession(params: { id?: string; updatedAtMs?: number }): PersistedSoloOrPvPSession {
  return {
    id: params.id ?? 'solo-active',
    mode: 'solo',
    role: 'seed',
    offerId: 'seed_solo_active',
    dictionaryId: 'core',
    dictionaryVersion: 'v1',
    difficulty: undefined,
    timerLimitSeconds: undefined,
    targets: [...DEFAULT_TARGETS],
    state: {
      targetWords: [...DEFAULT_TARGETS],
      guessesByTarget: buildGuessRows(2),
      solvedByTarget: [false, false, false, false, false],
      rules: DEFAULT_RULES,
      startedAtMs: 1,
      status: 'active',
    } as PersistedSoloOrPvPSession['state'] & { status: 'active' },
    rules: DEFAULT_RULES,
    createdAtMs: 1,
    updatedAtMs: params.updatedAtMs ?? 1,
  };
}

export function buildBotSession(params?: { id?: string; updatedAtMs?: number }): PersistedBotSession {
  return {
    id: params?.id ?? 'bot-active',
    mode: 'bot',
    difficulty: 'normal',
    dictionaryId: 'core',
    playStyle: 'race',
    activeTurn: 'player',
    playerTargets: [...DEFAULT_TARGETS],
    playerState: {
      targetWords: [...DEFAULT_TARGETS],
      guessesByTarget: buildGuessRows(1),
      solvedByTarget: [false, false, false, false, false],
      rules: DEFAULT_RULES,
      startedAtMs: 1,
    },
    playerSolvedCount: 0,
    botTargets: [...DEFAULT_TARGETS],
    botState: {
      targetWords: [...DEFAULT_TARGETS],
      guessesByTarget: buildGuessRows(1),
      solvedByTarget: [false, false, false, false, false],
      rules: DEFAULT_RULES,
      startedAtMs: 1,
    },
    botSolvedCount: 0,
    status: 'active',
    winner: null,
    rules: DEFAULT_RULES,
    createdAtMs: 1,
    updatedAtMs: params?.updatedAtMs ?? 1,
  };
}

export function buildDailyResult(
  session: PersistedSoloOrPvPSession,
  completed: 'win' | 'lose',
): StoredResult {
  return {
    code: `result-${session.id}-${completed}`,
    createdAtMs: session.updatedAtMs + 1,
    payload: {
      v: 1,
      challengeId: session.offerId ?? session.id,
      completed,
      attempts: session.state.guessesByTarget.flat().length,
      guessesByTarget: session.state.guessesByTarget,
    },
    sessionSummary: {
      offerId: session.offerId,
      role: session.role,
      totalTargets: session.targets.length,
      solvedCount: session.state.solvedByTarget.filter(Boolean).length,
      dictionaryId: session.dictionaryId,
      dictionaryVersion: session.dictionaryVersion,
      difficulty: session.difficulty,
      updatedAtMs: session.updatedAtMs + 1,
      gameMode: 'daily',
      totalGuesses: session.state.guessesByTarget.flat().length,
      completed,
      isTutorial: false,
    },
  };
}

export function buildTutorialResult(): StoredResult {
  return {
    code: 'tutorial-result',
    createdAtMs: 1,
    payload: {
      v: 1,
      challengeId: 'tutorial_1',
      completed: 'win',
      attempts: 3,
      guessesByTarget: [[], [], []],
    },
    sessionSummary: {
      totalTargets: 3,
      solvedCount: 3,
      updatedAtMs: 1,
      gameMode: 'solo',
      totalGuesses: 3,
      completed: 'win',
      isTutorial: true,
    },
  };
}
