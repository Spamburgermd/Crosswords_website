import type { ChallengeOfferPayload, ChallengeReturnPayload, ResultPayload } from '../gameEngine/types';
import type { GameState, Rules } from '../gameEngine/types';
import type { LocalChallengeRole } from './localChallengeStore';

export type StoredOffer = {
  code: string;
  payload: ChallengeOfferPayload;
  createdAtMs: number;
  updatedAtMs: number;
};

export type StoredReturn = {
  code: string;
  payload: ChallengeReturnPayload;
  createdAtMs: number;
  updatedAtMs: number;
};

export type StoredBundle = {
  code: string;
  offerId: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type StoredResult = {
  code: string;
  payload: ResultPayload;
  createdAtMs: number;
  sessionSummary?: {
    offerId?: string;
    role?: LocalChallengeRole;
    totalTargets: number;
    solvedCount: number;
    timerLimitSeconds?: number;
    dictionaryId?: string;
    dictionaryVersion?: string;
    difficulty?: string;
    updatedAtMs: number;
    /** Which game mode produced this result. */
    gameMode?: 'bot' | 'daily' | 'solo' | 'pvp';
    /** Total guesses across all targets. */
    totalGuesses?: number;
    /** Wall-clock solve time in milliseconds. */
    solveTimeMs?: number;
    /** Outcome of the game. */
    completed?: 'win' | 'lose' | 'forfeit';
    /** Tutorial entries are shown separately and excluded from aggregate stats. */
    isTutorial?: boolean;
  };
};

export type StoredOpponentResult = {
  challengeId: string;
  payload: {
    v: 1;
    type: 'result';
    challengeId: string;
    totalGuesses: number;
    solvedCount: number;
    guessesByTarget: Array<Array<{ guess: string; codes: string[] }>>;
    submittedAtMs: number;
  };
  receivedAtMs: number;
};

export type PersistedSoloOrPvPSession = {
  id: string;
  mode?: 'solo' | 'pvp';
  role: LocalChallengeRole;
  offerId?: string;
  dictionaryId?: string;
  dictionaryVersion?: string;
  difficulty?: string;
  timerLimitSeconds?: number;
  /** ISO date 'YYYY-MM-DD' — present only on daily puzzle sessions. */
  dailyDate?: string;
  /** Total guess budget across all targets (daily puzzles only). */
  guessTurnLimit?: number;
  targets: string[];
  state: GameState;
  rules: Rules;
  createdAtMs: number;
  updatedAtMs: number;
};

export type PersistedBotSession = {
  id: string;
  mode: 'bot';
  difficulty: 'easy' | 'normal' | 'hard';
  dictionaryId: string;
  playStyle: 'race' | 'turns';
  activeTurn: 'player' | 'bot';
  playerTargets: string[];
  playerState: GameState;
  playerSolvedCount: number;
  botTargets: string[];
  botState: GameState;
  botSolvedCount: number;
  status: 'active' | 'player_won' | 'bot_won';
  winner: 'player' | 'bot' | null;
  rules: Rules;
  createdAtMs: number;
  updatedAtMs: number;
};

export type PersistedSession = PersistedSoloOrPvPSession | PersistedBotSession;

export type PersistedState = {
  version: number;
  sessions: PersistedSession[];
  offers: StoredOffer[];
  returns: StoredReturn[];
  bundles: StoredBundle[];
  results: StoredResult[];
  opponentResults?: StoredOpponentResult[];
  hydratedAtMs: number;
};
