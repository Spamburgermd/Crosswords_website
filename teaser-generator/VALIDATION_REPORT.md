# Pre-UI-Migration Validation Report

## 1. game_id Contract Confirmation

### Backend (all endpoints validated)

| Endpoint | Response | game_id type | Waiting (0) | Matched/Created (>0) |
|----------|----------|--------------|-------------|----------------------|
| POST /games/create | `CreateGameOut` | `int` | N/A | Always `game.id` |
| POST /games/join | `{ "ok": true }` | N/A (no game_id) | — | Client uses join input |
| POST /friends/challenge | `CreateGameOut` | `int` | N/A | Always `game.id` |
| POST /matchmaking/enqueue | `CreateGameOut` | `int` | `game_id=0` when waiting | `game_id>0` when matched |
| GET /matchmaking/status | `CreateGameOut` | `int` | `game_id=0` when not matched | `game_id>0` when matched |

- All `game_id` values are `int` (Pydantic `CreateGameOut.game_id: int`).
- No endpoint returns `null`, a string, or an object for `game_id`.
- **No backend changes required.**

### Frontend (validated + one guard added)

| Location | Status |
|----------|--------|
| `sessionStore.activeGameId` | Typed `number \| null` ✓ |
| `createGame` onSuccess | `setActiveGameId(data.game_id)` — extracts number ✓ |
| `joinGame` onSuccess | `setActiveGameId(variables)` — variables is number ✓ |
| JSX rendering | `{activeGameId ?? 'None yet'}` — number or string, no object ✓ |
| useGameState | `enabled: Boolean(apiKey && gameId)` — 0 is falsy, no fetch ✓ |

**Fix applied:** LobbyScreen navigation now explicitly checks `activeGameId > 0` before navigating to Board (future-proof for matchmaking where `game_id=0` means waiting).

- **File:** `crosswords_mobile/src/screens/LobbyScreen.tsx`
- **Change:** Added `activeGameId != null && activeGameId > 0` to the navigation `useEffect` guard.

---

## 2. /healthz Ping Update

**Replaced:** GET /openapi.json → GET /healthz  
**Requirements:** No auth; `{ ok: true }` = connected; any failure = not connected.

### Diff for api.ts

```diff
--- a/crosswords_mobile/src/lib/api.ts
+++ b/crosswords_mobile/src/lib/api.ts
@@ -110,22 +110,23 @@ export async function loginOrRegisterForTesting(
 }

 /**
- * GET /openapi.json - Real network check (no throw).
- * Returns { ok: true, latencyMs } on success, { ok: false, error } on failure.
+ * GET /healthz - Server connectivity check (no auth).
+ * Treat { ok: true } as connected; any failure = not connected.
+ * Returns { ok: true, latencyMs } on success, { ok: false, error } on failure.
  */
 export async function pingServer(): Promise<PingResult> {
-  const instanceId = `mobile-${Date.now()}`;
-  const pingHeaders: HeadersInit = {
-    'X-Client': 'mobile',
-    'X-Client-Instance': instanceId,
-  };
   const start = Date.now();
   try {
-    const res = await fetch(`${API_BASE_URL}/openapi.json`, {
-      method: 'GET',
-      headers: pingHeaders,
-    });
+    const res = await fetch(`${API_BASE_URL}/healthz`, { method: 'GET' });
     const latencyMs = Date.now() - start;
     if (!res.ok) {
       return { ok: false, error: `HTTP ${res.status}` };
     }
-    return { ok: true, latencyMs };
+    const body = await parseJson<{ ok?: boolean }>(res);
+    if (body?.ok !== true) {
+      return { ok: false, error: 'Invalid health response' };
+    }
+    return { ok: true, latencyMs };
   } catch (e) {
     const errMsg = e instanceof Error ? e.message : 'Network error';
     return { ok: false, error: errMsg };
```

**UI:** TitleScreen and WelcomeScreen keep existing copy ("Online (xx ms)" / "Offline: …"). No retries, polling, or other UX changes.

---

## 3. Constraint Verification

- ✓ Expo SDK 55 unchanged
- ✓ React / React Native versions unchanged
- ✓ Gradle, Android, iOS config untouched
- ✓ No edits under `src/screens/preview/*`
- ✓ No UI redesign or stubs
- ✓ No backend behavior changes (validation only)
- ✓ No scope beyond Tasks 1 and 2

---

## Stop

Validation complete. No further refactoring, UI migration, or Atlantic preview changes until instructed.
