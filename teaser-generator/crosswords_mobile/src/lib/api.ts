/**
 * src/lib/api.ts
 * ---------------------------------------------
 * HTTP client for the CrosSwords FastAPI backend.
 *
 * API_BASE_URL:
 * - Reads EXPO_PUBLIC_API_BASE_URL when provided.
 * - Falls back to a LAN-safe default.
 * Use LAN IP for real devices on same network, or 10.0.2.2 for Android emulator.
 */

import { isServerFunctionsEnabled } from '@src/flags';

import type { Friend, FriendRequest, GameState } from '@schemas/api';
import { gameStateSchema } from '@schemas/api';

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
export const API_BASE_URL = (rawApiBaseUrl && rawApiBaseUrl.length > 0
  ? rawApiBaseUrl
  : 'http://10.0.0.104:8000'
).replace(/\/+$/, '');

function headers(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function assertServerEnabled(fn: string): void {
  if (isServerFunctionsEnabled()) return;
  noteOfflineCall(fn);
  throw new Error('Server functions disabled by feature flag');
}

async function guardedFetch(
  fn: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  assertServerEnabled(fn);
  return fetch(input, init);
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON: ${text.slice(0, 100)}`);
  }
}

function toReadableDetail(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function handleError(res: Response, body: unknown): never {
  let detailText: string;
  if (body && typeof body === 'object' && 'detail' in body) {
    const d = (body as { detail: unknown }).detail;
    detailText = typeof d === 'string' ? d : toReadableDetail(d);
  } else if (typeof body === 'string') {
    detailText = body;
  } else if (body && typeof body === 'object') {
    detailText = toReadableDetail(body);
  } else {
    detailText = res.statusText || `HTTP ${res.status}`;
  }
  const err = new Error(detailText || `HTTP ${res.status}`) as Error & { status?: number };
  err.status = res.status;
  throw err;
}

export type PingResult = { ok: true; latencyMs: number } | { ok: false; error: string };

/** Backend AuthOut: { user_id, api_key } */
export type LoginResult = { ok: true; api_key: string } | { ok: false; error: string };

/**
 * POST /auth/register — TESTING ONLY — remove before production.
 * Creates user, returns { user_id, api_key } on success.
 */
async function registerForTesting(username: string, password: string): Promise<LoginResult> {
  if (!isServerFunctionsEnabled()) {
    noteOfflineCall('registerForTesting');
    throw new Error('Server functions disabled by feature flag');
  }
  try {
    const res = await guardedFetch('registerForTesting', `${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await parseJson<{ user_id?: number; api_key?: string; detail?: unknown }>(res);
    if (!res.ok) {
      const err = body?.detail ?? res.statusText;
      return { ok: false, error: String(err) };
    }
    const apiKey = body?.api_key;
    if (typeof apiKey !== 'string' || !apiKey) {
      return { ok: false, error: 'No api_key in response' };
    }
    return { ok: true, api_key: apiKey };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, error: errMsg };
  }
}

/**
 * POST /auth/login — TESTING ONLY — remove before production.
 * Returns { ok: true, api_key } or { ok: false, error }.
 */
export async function loginForTesting(username: string, password: string): Promise<LoginResult> {
  if (!isServerFunctionsEnabled()) {
    noteOfflineCall('loginForTesting');
    throw new Error('Server functions disabled by feature flag');
  }
  try {
    const res = await guardedFetch('loginForTesting', `${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await parseJson<{ user_id?: number; api_key?: string; detail?: unknown }>(res);
    if (!res.ok) {
      const err = body?.detail ?? res.statusText;
      return { ok: false, error: String(err) };
    }
    const apiKey = body?.api_key;
    if (typeof apiKey !== 'string' || !apiKey) {
      return { ok: false, error: 'No api_key in response' };
    }
    return { ok: true, api_key: apiKey };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, error: errMsg };
  }
}

/**
 * Try login; if 401 Invalid credentials, register then retry login.
 * TESTING ONLY — remove before production.
 */
export async function loginOrRegisterForTesting(
  username: string,
  password: string,
): Promise<LoginResult> {
  const loginResult = await loginForTesting(username, password);
  if (loginResult.ok) return loginResult;
  if (loginResult.error !== 'Invalid credentials.') return loginResult;
  const registerResult = await registerForTesting(username, password);
  if (!registerResult.ok) return registerResult;
  return loginForTesting(username, password);
}

/**
 * GET /healthz - Server connectivity check (no auth).
 * Treat { ok: true } as connected; any failure = not connected.
 * Returns { ok: true, latencyMs } on success, { ok: false, error } on failure.
 */
export async function pingServer(): Promise<PingResult> {
  if (!isServerFunctionsEnabled()) {
    noteOfflineCall('pingServer');
    return { ok: false, error: 'Server functions disabled by feature flag' };
  }
  const start = Date.now();
  try {
    const res = await guardedFetch('pingServer', `${API_BASE_URL}/healthz`, { method: 'GET' });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const body = await parseJson<{ ok?: boolean }>(res);
    if (body?.ok !== true) {
      return { ok: false, error: 'Invalid health response' };
    }
    return { ok: true, latencyMs };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, error: errMsg };
  }
}

/**
 * GET /games/{game_id}/state
 * On schema parse failure, throws an Error that includes HTTP status and truncated raw JSON
 * so the UI can show what the backend actually returned (no console.log).
 */
export async function fetchGameState(apiKey: string, gameId: number): Promise<GameState> {
  const res = await guardedFetch('fetchGameState', `${API_BASE_URL}/games/${gameId}/state`, {
    method: 'GET',
    headers: headers(apiKey),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    const err = new Error(
      `Invalid game state response (HTTP ${res.status}): ${text.slice(0, 1000)}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (!res.ok) {
    handleError(res, body);
  }
  const parsed = gameStateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const pathMsg = first
      ? ` path=${(first.path as unknown[]).join('.')} message=${first.message}`
      : '';
    const trunc = text.length > 1000 ? `${text.slice(0, 1000)}…` : text;
    const err = new Error(
      `Invalid game state response (HTTP ${res.status}):${pathMsg} ${trunc}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return parsed.data;
}

/**
 * DEV-only: fetch raw /games/{id}/state body as text (for Copy /state panel).
 * Returns { status, text } so caller can format "HTTP {status}\n{text}".
 */
export async function fetchRawGameState(
  apiKey: string,
  gameId: number,
): Promise<{ status: number; text: string }> {
  const res = await guardedFetch('fetchRawGameState', `${API_BASE_URL}/games/${gameId}/state`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const text = await res.text();
  return { status: res.status, text };
}

/**
 * POST /games/create
 */
export async function createGame(apiKey: string): Promise<{ game_id: number }> {
  const res = await guardedFetch('createGame', `${API_BASE_URL}/games/create`, {
    method: 'POST',
    headers: headers(apiKey),
    body: '{}',
  });
  const body = await parseJson<{ game_id?: number }>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  const gameId = body?.game_id;
  if (typeof gameId !== 'number') {
    throw new Error('Invalid create game response');
  }
  return { game_id: gameId };
}

/**
 * POST /games/join
 */
export async function joinGame(apiKey: string, gameId: number): Promise<{ ok: true }> {
  const res = await guardedFetch('joinGame', `${API_BASE_URL}/games/join`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ game_id: gameId }),
  });
  const body = await parseJson<unknown>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  return { ok: true };
}

/**
 * POST /games/{game_id}/bot_join_public — attach bot as opponent (dev/testing).
 * Optional query: mode=easy|normal|hard (defaults to normal).
 */
export async function botJoinPublic(
  apiKey: string,
  gameId: number,
  mode?: 'easy' | 'normal' | 'hard',
): Promise<{ ok: true; bot_user_id: number }> {
  const qs = mode ? `?mode=${mode}` : '';
  const res = await guardedFetch('botJoinPublic', `${API_BASE_URL}/games/${gameId}/bot_join_public${qs}`, {
    method: 'POST',
    headers: headers(apiKey),
    body: '{}',
  });
  const body = await parseJson<{ ok?: boolean; bot_user_id?: number }>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  if (body?.ok !== true || typeof body?.bot_user_id !== 'number') {
    const err = new Error('Invalid bot_join_public response') as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return { ok: true, bot_user_id: body.bot_user_id };
}

/** Error with optional HTTP status for retry logic (e.g. 400/404). */
export type ApiError = Error & { status?: number };

/**
 * POST /games/{game_id}/submit_words
 */
export async function submitWords(
  apiKey: string,
  gameId: number,
  words: string[],
): Promise<{ ok: true }> {
  const res = await guardedFetch('submitWords', `${API_BASE_URL}/games/${gameId}/submit_words`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ words }),
  });
  const body = await parseJson<unknown>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  return { ok: true };
}

/**
 * POST /games/{game_id}/ready
 */
export async function markReady(apiKey: string, gameId: number): Promise<{ ok: true }> {
  const res = await guardedFetch('markReady', `${API_BASE_URL}/games/${gameId}/ready`, {
    method: 'POST',
    headers: headers(apiKey),
    body: '{}',
  });
  const body = await parseJson<unknown>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  return { ok: true };
}

/**
 * POST /games/{game_id}/guess
 */
export async function submitGuess(
  apiKey: string,
  gameId: number,
  body: { target_index: number; guess: string; target_signature?: string },
): Promise<{ ok: true; codes?: string[] }> {
  const payload = {
    target_index: Number(body.target_index),
    guess: body.guess,
    target_signature: body.target_signature,
  };
  const url = `${API_BASE_URL}/games/${gameId}/guess`;
  const res = await guardedFetch('submitGuess', url, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      target_word_index: payload.target_index,
      guess_word: payload.guess,
      target_signature: payload.target_signature,
    }),
  });
  const rawText = await res.text();
  let data: { ok?: boolean; codes?: string[] } = {};
  try {
    data = rawText ? (JSON.parse(rawText) as { ok?: boolean; codes?: string[] }) : {};
  } catch {
    // leave data as empty object if parsing fails
  }
  if (!res.ok) {
    handleError(res, data);
  }
  return { ok: true, codes: data?.codes };
}

/**
 * GET /friends/requests?direction=in|out|all
 */
export async function fetchFriendRequests(apiKey: string, scope?: string): Promise<FriendRequest[]> {
  const dir = scope === 'in' ? 'in' : scope === 'out' ? 'out' : 'all';
  const res = await guardedFetch('fetchFriendRequests', `${API_BASE_URL}/friends/requests?direction=${dir}`, {
    method: 'GET',
    headers: headers(apiKey),
  });
  const body = await parseJson<unknown>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  return Array.isArray(body) ? (body as FriendRequest[]) : [];
}

/**
 * GET /friends/
 */
export async function fetchFriends(apiKey: string): Promise<Friend[]> {
  const res = await guardedFetch('fetchFriends', `${API_BASE_URL}/friends/`, {
    method: 'GET',
    headers: headers(apiKey),
  });
  const body = await parseJson<unknown>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  return Array.isArray(body) ? (body as Friend[]) : [];
}

/**
 * POST /friends/requests - Send friend request to to_user_id
 */
export async function createFriendRequest(apiKey: string, userId: number): Promise<unknown> {
  const res = await guardedFetch('createFriendRequest', `${API_BASE_URL}/friends/requests`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ to_user_id: userId }),
  });
  const body = await parseJson<unknown>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  return body;
}

/**
 * POST /friends/requests/{id}/accept | decline | cancel
 */
export async function respondFriendRequest(
  apiKey: string,
  requestId: number,
  action: 'accept' | 'decline' | 'cancel',
): Promise<unknown> {
  const path =
    action === 'accept'
      ? `/friends/requests/${requestId}/accept`
      : action === 'decline'
        ? `/friends/requests/${requestId}/decline`
        : `/friends/requests/${requestId}/cancel`;
  const res = await guardedFetch('respondFriendRequest', `${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: headers(apiKey),
    body: '{}',
  });
  const body = await parseJson<unknown>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  return body;
}

/**
 * DELETE /friends/{friend_user_id}
 */
export async function removeFriend(apiKey: string, userId: number): Promise<unknown> {
  const res = await guardedFetch('removeFriend', `${API_BASE_URL}/friends/${userId}`, {
    method: 'DELETE',
    headers: headers(apiKey),
  });
  const body = await parseJson<unknown>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  return body;
}

/**
 * POST /friends/challenge - Create game with friend
 */
export async function challengeFriend(apiKey: string, userId: number): Promise<number> {
  const res = await guardedFetch('challengeFriend', `${API_BASE_URL}/friends/challenge`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ opponent_user_id: userId }),
  });
  const body = await parseJson<{ game_id?: number }>(res);
  if (!res.ok) {
    handleError(res, body);
  }
  const gameId = body?.game_id;
  if (typeof gameId !== 'number') {
    throw new Error('Invalid challenge response');
  }
  return gameId;
}
const apiCallTrapCounts: Record<string, number> = {};
function noteOfflineCall(fn: string): void {
  if (isServerFunctionsEnabled()) return;
  apiCallTrapCounts[fn] = (apiCallTrapCounts[fn] || 0) + 1;
  if (__DEV__) {
    console.warn(`[server-disabled] API call attempted while server disabled: ${fn}`);
  }
}

export function logOfflineApiCallSummary(): void {
  if (isServerFunctionsEnabled() || !__DEV__) return;
  console.log('[server-disabled] API call counts', { ...apiCallTrapCounts });
}
