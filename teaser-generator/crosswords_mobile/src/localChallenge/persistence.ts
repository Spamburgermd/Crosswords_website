/**
 * src/localChallenge/persistence.ts
 * -----------------------------------------------------------
 * Tiny persistence layer for local challenges (offers/returns/sessions/results).
 * Uses Expo FileSystem when available; falls back to in-memory for tests/metro.
 * No new dependencies are introduced.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  StoredResult,
  PersistedState,
} from './types';
import type { SoloOrPvPSession } from './localChallengeStore';

const FILENAME = 'local_challenges.json';
export const CURRENT_VERSION = 4;

function emptyPersistedState(): PersistedState {
  return {
    version: CURRENT_VERSION,
    sessions: [],
    offers: [],
    returns: [],
    bundles: [],
    results: [],
    opponentResults: [],
    hydratedAtMs: Date.now(),
  };
}

function normalizePersistedState(state: PersistedState): PersistedState {
  return {
    ...state,
    opponentResults: state.opponentResults ?? [],
    results: (state.results ?? []).map((result) => {
      if (!result.sessionSummary) return result;
      return {
        ...result,
        sessionSummary: {
          ...result.sessionSummary,
          isTutorial:
            result.sessionSummary.isTutorial ??
            result.payload.challengeId.startsWith('tutorial_'),
        },
      };
    }),
  };
}

/** Migrate persisted data from older versions to current. */
function migrateState(parsed: any): PersistedState {
  const v = parsed?.version ?? 0;
  if (v === 1) {
    // v1 → v2: sessions array only had solo/pvp (no bot sessions).
    // The shape is compatible — old sessions lack `mode` field (undefined = solo/pvp).
    return migrateState({ ...parsed, version: 2 });
  }
  if (v === 2) {
    // v2 → v3: added optional stats fields to StoredResult.sessionSummary
    // (gameMode, totalGuesses, solveTimeMs, completed). No data transformation needed.
    return migrateState({ ...parsed, version: 3 });
  }
  if (v === 3) {
    // v3 → v4: tag tutorial results explicitly for aggregate filtering.
    return normalizePersistedState({ ...parsed, version: CURRENT_VERSION } as PersistedState);
  }
  if (v === CURRENT_VERSION) {
    return normalizePersistedState(parsed as PersistedState);
  }
  // Unknown version: reset.
  console.warn?.('localChallenge persistence version mismatch; resetting store.');
  return emptyPersistedState();
}

/** Memory fallback used when FileSystem is unavailable (e.g., Jest). */
let memoryStore: PersistedState | null = null;

type ExpoFileSystemLike = {
  documentDirectory?: string | null;
  getInfoAsync: (uri: string) => Promise<{ exists: boolean }>;
  readAsStringAsync: (uri: string) => Promise<string>;
  writeAsStringAsync: (uri: string, contents: string) => Promise<void>;
  deleteAsync: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
};

function getFS(): ExpoFileSystemLike | null {
  try {
    // Lazy require so Jest/node paths that lack the module won't crash.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-file-system/legacy') as ExpoFileSystemLike;
  } catch (err) {
    console.warn('localChallenge/persistence: expo-file-system/legacy unavailable, using in-memory fallback', err);
    return null;
  }
}

function fileUri(): string | null {
  const fs = getFS();
  if (!fs || !fs.documentDirectory) return null;
  return `${fs.documentDirectory}${FILENAME}`;
}

export async function loadPersistedState(): Promise<PersistedState> {
  // Tests / unsupported environments: return memory or empty.
  const uri = fileUri();
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('localChallenge/persistence: fileUri =', uri);
  if (!uri) {
    if (memoryStore) return memoryStore;
    memoryStore = emptyPersistedState();
    return memoryStore;
  }

  const fs = getFS();
  if (!fs) {
    return emptyPersistedState();
  }

  try {
    const info = await fs.getInfoAsync(uri);
    if (!info.exists) {
      return {
        version: CURRENT_VERSION,
        sessions: [],
        offers: [],
        returns: [],
        bundles: [],
        results: [],
        hydratedAtMs: Date.now(),
      };
    }
    const raw = await fs.readAsStringAsync(uri);
    const parsed = JSON.parse(raw);
    const migrated = migrateState(parsed);
    return { ...migrated, hydratedAtMs: Date.now() };
  } catch (err) {
    console.error('localChallenge/persistence: failed to load state, resetting', err);
    return emptyPersistedState();
  }
}

export async function savePersistedState(state: PersistedState): Promise<void> {
  const uri = fileUri();
  if (!uri) {
    memoryStore = state;
    return;
  }
  const fs = getFS();
  if (!fs) return;
  try {
    await fs.writeAsStringAsync(uri, JSON.stringify(state));
  } catch (err) {
    console.error('localChallenge/persistence: failed to save state', err);
  }
}

/** Utility to clear persisted data (dev only). */
export async function clearPersistedState(): Promise<void> {
  const uri = fileUri();
  if (!uri) {
    memoryStore = null;
    return;
  }
  const fs = getFS();
  if (!fs) return;
  try {
    await fs.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}

/** Build a lightweight summary for history UI without exposing targets. */
export function summarizeSession(
  session: SoloOrPvPSession,
  opts?: { completedAtMs?: number; forceCompleted?: 'win' | 'lose' | 'forfeit' },
): StoredResult['sessionSummary'] {
  const solved = session.state.solvedByTarget.filter(Boolean).length;
  const totalTargets = session.targets.length;
  const totalGuesses = session.state.guessesByTarget.flat().length;
  const endMs = opts?.completedAtMs ?? Date.now();
  const startMs = session.state.startedAtMs;
  const solveTimeMs = startMs ? endMs - startMs : undefined;
  const gameMode: 'daily' | 'solo' | 'pvp' =
    session.dailyDate ? 'daily'
    : session.mode === 'pvp' ? 'pvp'
    : 'solo';
  const completed = opts?.forceCompleted ?? (solved === totalTargets ? 'win' : 'lose');
  return {
    offerId: session.offerId,
    role: session.role,
    totalTargets,
    solvedCount: solved,
    timerLimitSeconds: session.timerLimitSeconds,
    dictionaryId: session.dictionaryId,
    dictionaryVersion: session.dictionaryVersion,
    difficulty: session.difficulty,
    updatedAtMs: endMs,
    gameMode,
    totalGuesses,
    solveTimeMs,
    completed,
    isTutorial: false,
  };
}
