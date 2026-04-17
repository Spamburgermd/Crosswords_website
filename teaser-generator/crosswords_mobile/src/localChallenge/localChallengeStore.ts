/**
 * src/localChallenge/localChallengeStore.ts
 * ---------------------------------------------
 * In-memory store for local (serverless) challenge sessions.
 * This keeps data isolated from server mode so we don't risk altering
 * existing flows. Sessions are persisted to disk via persistence.ts.
 */

import { initGameFromChallenge } from '../gameEngine/state';
import type { ChallengePayload, GameState, Rules, ResultPayload } from '../gameEngine/types';
import { loadPersistedState, savePersistedState, summarizeSession, CURRENT_VERSION } from './persistence';
import type { PersistedSession, PersistedBotSession, PersistedSoloOrPvPSession, StoredOffer, StoredReturn, StoredResult, StoredBundle, StoredOpponentResult } from './types';
import { encodeResult } from '../gameEngine/serialize';
import { generateTargetsFromSeed } from './seededTargets';
import { DEFAULT_RULES } from '../gameEngine/types';
import { buildLocalPlacement } from '@src/lib/localPlacement';
import type { ChallengeResultPayload } from './resultComparison';

/**
 * Role of the local player in a swap-list flow.
 * - sender: I authored the initial offer and will solve the return words.
 * - receiver: I received the offer and will solve the receiverTargets from it.
 * - seed: both sides generated the same hidden list from a seed; no one pre-saw targets.
 * - legacy: legacy single-payload challenge (Phase 4B.1 compatibility).
 */
export type LocalChallengeRole = 'sender' | 'receiver' | 'seed' | 'legacy';

export type SoloOrPvPSession = {
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
  /** Private list of targets this device must solve. NEVER render the strings. */
  targets: string[];
  /** Engine state that tracks guesses/feedback for those hidden targets. */
  state: GameState;
  rules: Rules;
  createdAtMs: number;
  updatedAtMs: number;
};

/**
 * Bot challenge session: Player vs AI opponent.
 * Both player and bot have their own targets and game states.
 * Winner is determined by who solves all 5 words first.
 */
export type BotChallengeSession = {
  id: string;
  mode: 'bot';
  difficulty: 'easy' | 'normal' | 'hard';
  dictionaryId: string;
  // Gameplay feel:
  // - race: both sides can progress concurrently (existing behavior)
  // - turns: true head-to-head alternation between player and bot
  playStyle: 'race' | 'turns';
  // Only used in turns mode; indicates who can act now.
  activeTurn: 'player' | 'bot';

  // Player solves these (bot generated)
  playerTargets: string[];
  playerState: GameState;
  playerSolvedCount: number;

  // Bot solves these (player provided or random)
  botTargets: string[];
  botState: GameState;
  botSolvedCount: number;

  // Win tracking
  status: 'active' | 'player_won' | 'bot_won';
  winner: 'player' | 'bot' | null;

  rules: Rules;
  createdAtMs: number;
  updatedAtMs: number;
};

export type LocalChallengeSession = SoloOrPvPSession | BotChallengeSession;

// Simple in-memory store, but now hydrated from disk and saved after each change.
const sessions = new Map<string, LocalChallengeSession>();
const offers: StoredOffer[] = [];
const returnsList: StoredReturn[] = [];
const bundles: StoredBundle[] = [];
const results: StoredResult[] = [];
const opponentResults: StoredOpponentResult[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();

let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

function notify() {
  listeners.forEach((l) => l());
}

function now() {
  return Date.now();
}

// ─── Daily Puzzle helpers ─────────────────────────────────────────────────────

/** Constant used to obfuscate the date-derived seed. */
const DAILY_SEED_SALT = 0x4a3f2b1c;

/** Guess budget per difficulty level (total across all 5 target words). */
export const DAILY_TURN_LIMITS: Record<string, number> = {
  easy: 40,
  moderate: 30,
  expert: 20,
};

/** Returns 'YYYY-MM-DD' for a given Date (defaults to today in local time). */
export function getDailyPuzzleDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converts 'YYYY-MM-DD' → an obfuscated integer seed.
 * The raw date integer is hashed so it cannot be trivially entered into
 * regular solo mode to preview the daily puzzle.
 */
export function getDailyPuzzleSeed(dateStr: string): number {
  const raw = parseInt(dateStr.replace(/-/g, ''), 10); // e.g. 20260227
  return ((raw * 1664525 + DAILY_SEED_SALT) >>> 0) % 1_000_000;
}

/** Returns the existing daily session for a given date string, or null. */
export function getDailySessionForDate(dateStr: string): SoloOrPvPSession | null {
  let latest: SoloOrPvPSession | null = null;
  for (const s of sessions.values()) {
    if (s.mode !== 'bot' && (s as SoloOrPvPSession).dailyDate === dateStr) {
      const dailySession = s as SoloOrPvPSession;
      if (!latest || dailySession.updatedAtMs > latest.updatedAtMs) {
        latest = dailySession;
      }
    }
  }
  return latest;
}

/**
 * Finds or creates the daily session for a given date.
 * If a session already exists for that date, its id is returned directly
 * without creating a duplicate.
 */
export function getOrCreateDailySession(params: {
  date: string;
  dictionaryId: string;
  difficulty: string;
  guessTurnLimit: number;
}): string {
  const existing = getDailySessionForDate(params.date);
  if (existing) return existing.id;
  const seed = getDailyPuzzleSeed(params.date);
  return createSeedSession({
    seed,
    dictionaryId: params.dictionaryId,
    difficulty: params.difficulty,
    dailyDate: params.date,
    guessTurnLimit: params.guessTurnLimit,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

async function hydrateOnce() {
  if (hydrated) return;
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    const persisted = await loadPersistedState();
    const currentSessions = new Map(sessions);
    const currentOffers = [...offers];
    const currentReturns = [...returnsList];
    const currentBundles = [...bundles];
    const currentResults = [...results];
    const currentOpponentResults = [...opponentResults];

    const mergedSessions = new Map<string, LocalChallengeSession>();
    persisted.sessions.forEach((s) => {
      if ((s as PersistedBotSession).mode === 'bot') {
        const bot = s as PersistedBotSession;
        mergedSessions.set(bot.id, {
          ...bot,
          playStyle: bot.playStyle ?? 'race',
          activeTurn: bot.activeTurn ?? 'player',
        } as LocalChallengeSession);
        return;
      }
      mergedSessions.set(s.id, { ...s } as LocalChallengeSession);
    });
    currentSessions.forEach((session, id) => {
      mergedSessions.set(id, session);
    });

    sessions.clear();
    mergedSessions.forEach((session, id) => {
      sessions.set(id, session);
    });

    offers.splice(0, offers.length, ...mergeRecords(persisted.offers, currentOffers, (item) => item.code));
    returnsList.splice(0, returnsList.length, ...mergeRecords(persisted.returns, currentReturns, (item) => item.code));
    bundles.splice(0, bundles.length, ...mergeRecords(persisted.bundles ?? [], currentBundles, (item) => item.code));
    results.splice(0, results.length, ...mergeRecords(persisted.results, currentResults, (item) => item.code));
    opponentResults.splice(
      0,
      opponentResults.length,
      ...mergeRecords(persisted.opponentResults ?? [], currentOpponentResults, (item) => item.challengeId),
    );

    hydrated = true;
    notify();
  })();

  return hydrationPromise;
}

async function persist() {
  const snapshot: PersistedSession[] = Array.from(sessions.values()).map((s): PersistedSession => {
    if (s.mode === 'bot') {
      return {
        id: s.id,
        mode: s.mode,
        difficulty: s.difficulty,
        dictionaryId: s.dictionaryId,
        playStyle: s.playStyle,
        activeTurn: s.activeTurn,
        playerTargets: s.playerTargets,
        playerState: s.playerState,
        playerSolvedCount: s.playerSolvedCount,
        botTargets: s.botTargets,
        botState: s.botState,
        botSolvedCount: s.botSolvedCount,
        status: s.status,
        winner: s.winner,
        rules: s.rules,
        createdAtMs: s.createdAtMs,
        updatedAtMs: s.updatedAtMs,
      } satisfies PersistedBotSession;
    }
    return {
      id: s.id,
      mode: s.mode,
      role: s.role,
      offerId: s.offerId,
      dictionaryId: s.dictionaryId,
      dictionaryVersion: s.dictionaryVersion,
      difficulty: s.difficulty,
      timerLimitSeconds: s.timerLimitSeconds,
      dailyDate: s.dailyDate,
      guessTurnLimit: s.guessTurnLimit,
      targets: s.targets,
      state: s.state,
      rules: s.rules,
      createdAtMs: s.createdAtMs,
      updatedAtMs: s.updatedAtMs,
    } satisfies PersistedSoloOrPvPSession;
  });
  await savePersistedState({
    version: CURRENT_VERSION,
    sessions: snapshot,
    offers: [...offers],
    returns: [...returnsList],
    bundles: [...bundles],
    results: [...results],
    opponentResults: [...opponentResults],
    hydratedAtMs: now(),
  });
}

function mergeRecords<T>(
  persistedItems: T[],
  currentItems: T[],
  getKey: (item: T) => string,
): T[] {
  const merged = [...currentItems];
  const seen = new Set(currentItems.map(getKey));
  for (const item of persistedItems) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    merged.push(item);
    seen.add(key);
  }
  return merged;
}

function schedulePersist(): void {
  persistQueue = persistQueue
    .catch(() => undefined)
    .then(async () => {
      await hydrateOnce();
      await persist();
    });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return {
    hydrated,
    sessions: Array.from(sessions.values()),
    offers,
    returns: returnsList,
    bundles,
    results,
    opponentResults,
  };
}

// Kick off hydration immediately (fire-and-forget).
void hydrateOnce();

/**
 * Ensure the local challenge store has finished hydrating from disk before
 * callers make lifecycle decisions based on persisted sessions/results.
 */
export function ensureHydrated(): Promise<void> {
  return hydrateOnce() ?? Promise.resolve();
}

/** Await any pending persist writes. Useful for ensuring data is flushed before app close. */
export function flushPersist(): Promise<void> {
  return persistQueue;
}

// Flush pending writes when app backgrounds so data isn't lost on close.
try {
  // Lazy require to avoid breaking Jest (react-native isn't transformed in isolateModules).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppState } = require('react-native') as { AppState: { addEventListener: (type: string, cb: (s: string) => void) => void } };
  AppState.addEventListener('change', (nextState: string) => {
    if (nextState === 'background' || nextState === 'inactive') {
      void persistQueue.then(() => persist());
    }
  });
} catch {
  // Not in a React Native environment (e.g. Jest).
}

/** Deterministically build a fresh GameState for the provided hidden targets. */
function buildStateFromTargets(targets: string[], rules: Rules): GameState {
  // Reuse the existing initGameFromChallenge helper to keep logic identical.
  const payload: ChallengePayload = {
    v: 1,
    words: targets,
    rules,
    createdAtMs: Date.now(),
  };
  return initGameFromChallenge(payload);
}

/**
 * Create a session when we already have the exact targets this device must solve.
 * This is used by swap-list flow when we know which side we are (sender/receiver/seed).
 */
export function createSessionFromTargets(params: {
  targets: string[];
  role: LocalChallengeRole;
  offerId?: string;
  dictionaryId?: string;
  dictionaryVersion?: string;
  difficulty?: string;
  timerLimitSeconds?: number;
  dailyDate?: string;
  guessTurnLimit?: number;
  rules: Rules;
}): string {
  const id = `lc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const placement = buildLocalPlacement(params.targets);
  if (!placement.ok) {
    throw new Error(placement.error);
  }
  const state = buildStateFromTargets(placement.words, params.rules);
  sessions.set(id, {
    id,
    role: params.role,
    offerId: params.offerId,
    dictionaryId: params.dictionaryId,
    dictionaryVersion: params.dictionaryVersion,
    difficulty: params.difficulty,
    timerLimitSeconds: params.timerLimitSeconds,
    dailyDate: params.dailyDate,
    guessTurnLimit: params.guessTurnLimit,
    targets: params.targets,
    state: {
      ...state,
      opponent_masked: placement.opponent_masked,
      targets_meta: placement.targets_meta,
      revealed_coords: placement.revealed_coords,
      target_lengths: placement.target_lengths,
      status: 'active',
    } as typeof state,
    rules: params.rules,
    createdAtMs: now(),
    updatedAtMs: now(),
  });
  schedulePersist();
  notify();
  return id;
}

/**
 * Convenience helper for one-tap local play: derives targets from a seed so
 * neither player sees them. The seed is not shown unless explicitly shared.
 */
export function createSeedSession(params: {
  seed: number;
  dictionaryId: string;
  difficulty?: string;
  timerLimitSeconds?: number;
  dailyDate?: string;
  guessTurnLimit?: number;
  rules?: Rules;
}): string {
  try {
    const targets = generateTargetsFromSeed(params.seed, params.dictionaryId as any, 5);
    return createSessionFromTargets({
      targets,
      role: 'seed',
      offerId: `seed_${params.seed}`,
      dictionaryId: params.dictionaryId,
      dictionaryVersion: undefined,
      difficulty: params.difficulty,
      timerLimitSeconds: params.timerLimitSeconds,
      dailyDate: params.dailyDate,
      guessTurnLimit: params.guessTurnLimit,
      rules: params.rules ?? { ...DEFAULT_RULES },
    });
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(`Could not generate a playable word set right now. Please try again.${detail}`);
  }
}

/**
 * Backwards-compatible helper for legacy single-payload challenges.
 * Keeps API identical to Phase 4B.1 callers.
 */
export function createSessionFromPayload(payload: ChallengePayload, state: GameState): string {
  const id = `lc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  sessions.set(id, {
    id,
    role: 'legacy',
    offerId: undefined,
    dictionaryId: undefined,
    dictionaryVersion: undefined,
    difficulty: undefined,
    timerLimitSeconds: undefined,
    targets: payload.words,
    state,
    rules: payload.rules,
    createdAtMs: now(),
    updatedAtMs: now(),
  });
  schedulePersist();
  notify();
  return id;
}

/** Fetch an existing session or null if missing. */
export function getSession(sessionId: string | null | undefined): LocalChallengeSession | null {
  if (!sessionId) return null;
  return sessions.get(sessionId) ?? null;
}

/**
 * Append a guess result into a local session so Solo/PvP boards can render feedback
 * without any server calls. Keeps the shape aligned with BoardScreen expectations.
 * Note: Bot sessions use updateBotSession() instead.
 */
export function appendLocalGuessResult(args: {
  sessionId: string;
  targetIndex: number;
  guess: string;
  codes: string[];
}): void {
  const existing = sessions.get(args.sessionId);
  if (!existing || existing.mode === 'bot') return; // Skip bot sessions

  const nextState = { ...existing.state };
  const byTarget: any = Array.isArray(nextState.guessesByTarget)
    ? [...nextState.guessesByTarget]
    : [];
  const guessesForTarget: Array<{ guess: string; codes: string[]; submittedAtMs?: number }> = [...(byTarget[args.targetIndex] ?? [])];
  guessesForTarget.push({
    guess: args.guess,
    codes: args.codes,
    submittedAtMs: Date.now(),
  });
  byTarget[args.targetIndex] = guessesForTarget;
  nextState.guessesByTarget = byTarget as any;

  // Mark solved flag internally (never shown to user) to keep overlays correct.
  if (Array.isArray(nextState.targetWords) && nextState.targetWords[args.targetIndex]) {
    if (args.codes.every((c) => (c ?? '').toUpperCase() === 'G')) {
      const solved = Array.isArray(nextState.solvedByTarget)
        ? [...nextState.solvedByTarget]
        : [];
      solved[args.targetIndex] = true;
      nextState.solvedByTarget = solved;
    }
  }

  const updated: SoloOrPvPSession = { ...existing, state: nextState, updatedAtMs: now() };
  sessions.set(args.sessionId, updated);
  schedulePersist();
  notify();
}

/** Replace the stored state for a session (no mutation of existing object).
 * Note: Bot sessions use updateBotSession() instead. */
export function updateSession(sessionId: string, nextState: GameState): void {
  const existing = sessions.get(sessionId);
  if (!existing || existing.mode === 'bot') return; // Skip bot sessions

  const updated: SoloOrPvPSession = { ...existing, state: nextState, updatedAtMs: now() };
  sessions.set(sessionId, updated);
  schedulePersist();
  notify();
}

/** Remove a session when finished. */
export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
  schedulePersist();
  notify();
}

// Offer/return/result tracking ------------------------------------------------

export function recordOffer(code: string, payload: any): void {
  const existing = offers.find((o) => o.code === code);
  if (existing) {
    existing.payload = payload;
    existing.updatedAtMs = now();
  } else {
    offers.unshift({ code, payload, createdAtMs: now(), updatedAtMs: now() });
  }
  schedulePersist();
  notify();
}

export function recordReturn(code: string, payload: any): void {
  const existing = returnsList.find((o) => o.code === code);
  if (existing) {
    existing.payload = payload;
    existing.updatedAtMs = now();
  } else {
    returnsList.unshift({ code, payload, createdAtMs: now(), updatedAtMs: now() });
  }
  schedulePersist();
  notify();
}

export function recordBundle(code: string, offerId: string): void {
  const existing = bundles.find((b) => b.code === code);
  if (existing) {
    existing.updatedAtMs = now();
  } else {
    bundles.unshift({ code, offerId, createdAtMs: now(), updatedAtMs: now() });
  }
  schedulePersist();
  notify();
}

export function recordResultFromSession(
  session: SoloOrPvPSession,
  opts?: { completedAtMs?: number; forceCompleted?: 'win' | 'lose' | 'forfeit' },
): void {
  const ts = opts?.completedAtMs ?? now();
  const allSolved = session.state.solvedByTarget?.every(Boolean);
  const completed = opts?.forceCompleted ?? (allSolved ? 'win' : 'lose');
  const payload: ResultPayload = {
    v: 1,
    challengeId: session.offerId ?? session.id,
    completed,
    attempts: session.state.guessesByTarget.flat().length,
    guessesByTarget: session.state.guessesByTarget,
  };
  const code = encodeResult(payload);
  const summary = summarizeSession(session, { completedAtMs: ts, forceCompleted: completed });
  results.unshift({ code, payload, createdAtMs: ts, sessionSummary: summary });
  schedulePersist();
  notify();
}

/** Record a completed bot duel as a StoredResult for stats tracking. */
export function recordBotResult(session: BotChallengeSession): void {
  const isPlayerWin = session.winner === 'player';
  const totalGuesses = session.playerState.guessesByTarget.reduce(
    (sum, arr) => sum + (arr?.length ?? 0),
    0,
  );
  const solvedCount = session.playerState.solvedByTarget.filter(Boolean).length;
  const completed = isPlayerWin ? ('win' as const) : ('lose' as const);
  const payload: ResultPayload = {
    v: 1,
    challengeId: session.id,
    completed,
    attempts: totalGuesses,
    guessesByTarget: session.playerState.guessesByTarget,
  };
  const code = encodeResult(payload);
  const startMs = session.playerState.startedAtMs;
  const endMs = now();
  const summary: StoredResult['sessionSummary'] = {
    totalTargets: session.playerTargets.length,
    solvedCount,
    dictionaryId: session.dictionaryId,
    difficulty: session.difficulty,
    updatedAtMs: endMs,
    gameMode: 'bot',
    totalGuesses,
    solveTimeMs: startMs ? endMs - startMs : undefined,
    completed,
    isTutorial: false,
  };
  results.unshift({ code, payload, createdAtMs: endMs, sessionSummary: summary });
  schedulePersist();
  notify();
}

/**
 * Record a completed tutorial game in the stats ledger.
 * Stored as 'solo' mode so it appears in both Overall and Solo sections.
 * Guard externally with a ref — each call creates a new entry.
 */
export function recordTutorialResult(opts: {
  totalGuesses: number;
  solveTimeMs: number;
  guessesByTarget: Array<Array<{ guess: string; codes: string[] }>>;
}): void {
  const ts = now();
  const payload: ResultPayload = {
    v: 1,
    challengeId: `tutorial_${ts}`,
    completed: 'win',
    attempts: opts.totalGuesses,
    guessesByTarget: opts.guessesByTarget,
  };
  const code = encodeResult(payload);
  const tutorialTargetCount = opts.guessesByTarget.length;
  const summary: StoredResult['sessionSummary'] = {
    totalTargets: tutorialTargetCount,
    solvedCount: tutorialTargetCount,
    dictionaryId: 'standard',
    updatedAtMs: ts,
    gameMode: 'solo',
    totalGuesses: opts.totalGuesses,
    solveTimeMs: opts.solveTimeMs > 0 ? opts.solveTimeMs : undefined,
    completed: 'win',
    isTutorial: true,
  };
  results.unshift({ code, payload, createdAtMs: ts, sessionSummary: summary });
  schedulePersist();
  notify();
}

/**
 * Given an offerId, try to infer whether this device is the original sender.
 * Returns 'sender' when we have a locally created offer with that id, else 'receiver'.
 */
export function inferRoleFromOffers(
  offerId: string | undefined | null,
  offerList: { payload: { offerId?: string } }[],
): LocalChallengeRole | null {
  if (!offerId) return null;
  const exists = offerList.some((o) => o.payload.offerId === offerId);
  if (exists) return 'sender';
  return 'receiver';
}

export function inferRoleForOfferId(offerId: string | undefined | null): LocalChallengeRole | null {
  return inferRoleFromOffers(offerId, offers);
}

export function deleteHistoryItem(type: 'offer' | 'return' | 'result' | 'session', idOrCode: string): void {
  if (type === 'session') {
    sessions.delete(idOrCode);
  } else if (type === 'offer') {
    const idx = offers.findIndex((o) => o.code === idOrCode);
    if (idx >= 0) offers.splice(idx, 1);
  } else if (type === 'return') {
    const idx = returnsList.findIndex((o) => o.code === idOrCode);
    if (idx >= 0) returnsList.splice(idx, 1);
  } else if (type === 'result') {
    const idx = results.findIndex((o) => o.code === idOrCode);
    if (idx >= 0) results.splice(idx, 1);
  }
  schedulePersist();
  notify();
}

// ============================= BOT MODE ======================================

/**
 * Create a new bot challenge session.
 * @param params.difficulty Bot AI difficulty (easy/normal/hard)
 * @param params.playerTargets Words for bot to solve (player provides or random)
 * @param params.botTargets Words for player to solve (bot generated)
 * @param params.dictionaryId Dictionary used for validation
 * @returns Session ID
 */
export function createBotSession(params: {
  difficulty: 'easy' | 'normal' | 'hard';
  playerTargets: string[];
  botTargets: string[];
  dictionaryId: string;
  playStyle?: 'race' | 'turns';
}): string {
  const id = `bot_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  // Build board placement for player's targets (what player solves)
  const playerPlacement = buildLocalPlacement(params.botTargets);
  if (!playerPlacement.ok) {
    throw new Error(`Player board placement failed: ${playerPlacement.error}`);
  }

  // Build board placement for bot's targets (what bot solves)
  const botPlacement = buildLocalPlacement(params.playerTargets);
  if (!botPlacement.ok) {
    throw new Error(`Bot board placement failed: ${botPlacement.error}`);
  }

  // Build initial game states with geometry
  const playerStateBase = buildStateFromTargets(playerPlacement.words, DEFAULT_RULES);
  const botStateBase = buildStateFromTargets(botPlacement.words, DEFAULT_RULES);

  const playerState = {
    ...playerStateBase,
    opponent_masked: playerPlacement.opponent_masked,
    targets_meta: playerPlacement.targets_meta,
    revealed_coords: playerPlacement.revealed_coords,
    target_lengths: playerPlacement.target_lengths,
    status: 'active',
  } as typeof playerStateBase;

  const botState = {
    ...botStateBase,
    opponent_masked: botPlacement.opponent_masked,
    targets_meta: botPlacement.targets_meta,
    revealed_coords: botPlacement.revealed_coords,
    target_lengths: botPlacement.target_lengths,
    status: 'active',
  } as typeof botStateBase;

  const session: BotChallengeSession = {
    id,
    mode: 'bot',
    difficulty: params.difficulty,
    dictionaryId: params.dictionaryId,
    playStyle: params.playStyle ?? 'race',
    activeTurn: 'player',

    playerTargets: playerPlacement.words,
    playerState,
    playerSolvedCount: 0,

    botTargets: botPlacement.words,
    botState,
    botSolvedCount: 0,

    status: 'active',
    winner: null,

    rules: DEFAULT_RULES,
    createdAtMs: now(),
    updatedAtMs: now(),
  };

  sessions.set(id, session);
  schedulePersist();
  notify();
  return id;
}

/**
 * Update a bot session with a new guess from player or bot.
 * @param sessionId Session ID
 * @param player Who made the guess ('player' | 'bot')
 * @param targetIndex Index of target word being guessed
 * @param guess The guess string
 * @returns Feedback codes, correctness, and game-over status
 */
export function updateBotSession(
  sessionId: string,
  player: 'player' | 'bot',
  targetIndex: number,
  guess: string,
): { codes: string[]; isCorrect: boolean; gameOver: boolean; winner: 'player' | 'bot' | null } {
  const session = sessions.get(sessionId);
  if (!session || session.mode !== 'bot') {
    throw new Error(`Bot session not found: ${sessionId}`);
  }
  if (session.status !== 'active') {
    throw new Error('Bot session is finished.');
  }
  if (session.playStyle === 'turns' && session.activeTurn !== player) {
    throw new Error(`It is not ${player}'s turn.`);
  }

  // Import locally to avoid circular deps
  const { computeFeedback } = require('../gameEngine/feedback');
  const { isSolved } = require('../gameEngine/state');

  // Determine which state to update
  const currentState = player === 'player' ? session.playerState : session.botState;
  const targetWords = currentState.targetWords ?? [];
  const targetWord = targetWords[targetIndex];

  if (!targetWord) {
    throw new Error(`No target word at index ${targetIndex}`);
  }

  // Compute feedback
  const bluePoolLetters: string[] = targetWords
    .filter((_, idx) => idx !== targetIndex)
    .join('')
    .split('');
  const rulesWithPool = { ...DEFAULT_RULES, bluePoolLetters };
  const result = computeFeedback(targetWord, guess, rulesWithPool);

  const isCorrect = result.codes.every((c: string) => c === 'green');

  // Normalize codes to uppercase single chars (G/Y/R/B) for consistency
  const normalizedCodes = result.codes.map((c: string) => {
    const upper = c.toUpperCase();
    if (upper === 'GREEN' || upper === 'G') return 'G';
    if (upper === 'YELLOW' || upper === 'Y') return 'Y';
    if (upper === 'BLUE' || upper === 'B') return 'B';
    return 'R'; // red or unknown
  });

  // Update guessesByTarget with full object (guess + codes + timestamp)
  const nextState = { ...currentState };
  const byTarget: any = Array.isArray(nextState.guessesByTarget)
    ? [...nextState.guessesByTarget]
    : [];
  const guessesForTarget: Array<{ guess: string; codes: string[]; submittedAtMs?: number }> = [...(byTarget[targetIndex] ?? [])];
  const guessObject = {
    guess: guess.toUpperCase(),
    codes: normalizedCodes,
    submittedAtMs: now(),
  };
  guessesForTarget.push(guessObject);
  byTarget[targetIndex] = guessesForTarget;
  nextState.guessesByTarget = byTarget as any;

  // Update solved flags
  if (isCorrect) {
    const solved = Array.isArray(nextState.solvedByTarget)
      ? [...nextState.solvedByTarget]
      : [];
    solved[targetIndex] = true;
    nextState.solvedByTarget = solved;
  }

  const allSolved = isSolved(nextState);

  // Create NEW session object (don't mutate) so React detects the change
  const updatedSession: BotChallengeSession = {
    ...session,
    updatedAtMs: now(),
  };

  if (player === 'player') {
    updatedSession.playerState = nextState;
    if (isCorrect) {
      updatedSession.playerSolvedCount = session.playerSolvedCount + 1;
    }

    if (session.playStyle === 'turns') {
      // Turn-based duel: first to clear all five wins immediately.
      if (allSolved) {
        updatedSession.status = 'player_won';
        updatedSession.winner = 'player';
      } else {
        updatedSession.activeTurn = 'bot';
      }
    } else {
      // Race mode: preserve existing "fewest guesses once player finishes" winner logic.
      if (allSolved) {
        const playerTotalGuesses = updatedSession.playerState.guessesByTarget.reduce(
          (sum, arr) => sum + (arr?.length ?? 0),
          0
        );
        const botTotalGuesses = updatedSession.botState.guessesByTarget.reduce(
          (sum, arr) => sum + (arr?.length ?? 0),
          0
        );

        if (playerTotalGuesses < botTotalGuesses) {
          updatedSession.status = 'player_won';
          updatedSession.winner = 'player';
        } else if (botTotalGuesses < playerTotalGuesses) {
          updatedSession.status = 'bot_won';
          updatedSession.winner = 'bot';
        } else {
          // Tie fallback (kept as prior behavior).
          updatedSession.status = 'player_won';
          updatedSession.winner = 'player';
        }
      }
    }
  } else {
    // Bot finished a word
    updatedSession.botState = nextState;
    if (isCorrect) {
      updatedSession.botSolvedCount = session.botSolvedCount + 1;
    }
    if (session.playStyle === 'turns') {
      if (allSolved) {
        updatedSession.status = 'bot_won';
        updatedSession.winner = 'bot';
      } else {
        updatedSession.activeTurn = 'player';
      }
    }
    // Race mode: don't end game when bot finishes (existing behavior).
  }

  sessions.set(sessionId, updatedSession);
  schedulePersist();

  notify();

  return {
    codes: normalizedCodes,
    isCorrect,
    gameOver: updatedSession.status !== 'active',
    winner: updatedSession.winner,
  };
}

/**
 * Get a bot session by ID.
 * @param sessionId Session ID
 * @returns Bot session or null
 */
export function getBotSession(sessionId: string | null | undefined): BotChallengeSession | null {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session || session.mode !== 'bot') return null;
  return session;
}

/**
 * Get all sessions (both solo/pvp and bot).
 * @returns Array of all sessions
 */
export function getAllSessions(): LocalChallengeSession[] {
  return Array.from(sessions.values());
}

// ============================= PVP RESULT COMPARISON =========================

/**
 * Record an opponent's result for a challenge.
 * Used in PvP async mode to compare results after both players finish.
 * @param result The opponent's result payload
 */
export function recordOpponentResult(result: ChallengeResultPayload): void {
  const existing = opponentResults.find((r) => r.challengeId === result.challengeId);
  if (existing) {
    existing.payload = result;
    existing.receivedAtMs = now();
  } else {
    opponentResults.unshift({
      challengeId: result.challengeId,
      payload: result,
      receivedAtMs: now(),
    });
  }
  schedulePersist();
  notify();
}

/**
 * Get an opponent's result for a specific challenge.
 * @param challengeId The challenge/offer ID
 * @returns The opponent's result or null if not found
 */
export function getOpponentResult(challengeId: string): ChallengeResultPayload | null {
  const stored = opponentResults.find((r) => r.challengeId === challengeId);
  return stored?.payload ?? null;
}
