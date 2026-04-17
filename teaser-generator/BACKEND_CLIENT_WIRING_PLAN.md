# Backend/Client Wiring Plan

## Task A — Frontend API Surface Inventory

| Frontend File | Functions Used | Request Args | Response Fields Used in UI |
|---------------|----------------|--------------|----------------------------|
| TitleScreen.tsx | `pingServer` | — | `ok`, `latencyMs` / `error` |
| WelcomeScreen.tsx | `pingServer` | — | `ok`, `latencyMs` / `error` |
| LobbyScreen.tsx | `createGame`, `joinGame`, `markReady`, `submitWords` | apiKey; (gameId) for join; (gameId, words) for submit | `game_id` (createGame); `ok` (others) |
| BoardScreen.tsx | `submitGuess` | apiKey, gameId, `{ target_index, guess }` | `codes` |
| FriendsScreen.tsx | `challengeFriend`, `createFriendRequest`, `fetchFriendRequests`, `fetchFriends`, `removeFriend`, `respondFriendRequest` | apiKey; userId/requestId; scope for requests | `game_id` (challenge); arrays for requests/friends |
| useGameState.ts | `fetchGameState` | apiKey, gameId | Full `GameState` |
| sessionStore.ts | `loginOrRegisterForTesting` (TESTING) | username, password | `api_key` |
| src/lib/api.ts | (defines all) | — | — |

**Direct fetch/axios:** No direct fetch in screens; all go through `@lib/api`. Only `api.ts` uses `fetch`.

---

## Task B — Backend Endpoint Inventory

### Auth (prefix `/auth`)
| Method | Path | Auth | Response |
|--------|------|------|----------|
| POST | /auth/register | No | `{ user_id, api_key }` |
| POST | /auth/login | No | `{ user_id, api_key }` |
| GET | /auth/me | Bearer | `{ user_id, username }` |

### Games (prefix `/games`)
| Method | Path | Auth | Response |
|--------|------|------|----------|
| POST | /games/create | Bearer | `{ game_id }` |
| POST | /games/join | Bearer | `{ ok: true }` |
| POST | /games/{id}/submit_words | Bearer | `{ ok: true }` |
| POST | /games/{id}/ready | Bearer | `{ ok: true }` |
| POST | /games/{id}/guess | Bearer | `{ ok: true, codes? }` |
| GET | /games/{id}/state | Bearer | `GameStateOut` (game_id, status, me, opponent, your_history_grouped, your_solved, opponent_masked, etc.) |

### Friends (prefix `/friends`)
| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | /friends/ | Bearer | `List[FriendOut]` |
| GET | /friends/requests?direction= | Bearer | `List[FriendRequestOut]` |
| POST | /friends/requests | Bearer | `FriendRequestOut` |
| POST | /friends/requests/{id}/accept | Bearer | `FriendRequestOut` |
| POST | /friends/requests/{id}/decline | Bearer | `FriendRequestOut` |
| POST | /friends/requests/{id}/cancel | Bearer | `FriendRequestOut` |
| DELETE | /friends/{friend_user_id} | Bearer | `{ ok: true }` |
| POST | /friends/challenge | Bearer | `{ game_id }` |

### Matchmaking (prefix `/matchmaking`)
| Method | Path | Auth | Response |
|--------|------|------|----------|
| POST | /matchmaking/enqueue | Bearer | `{ game_id }` |
| GET | /matchmaking/status | Bearer | `{ game_id }` |
| POST | /matchmaking/dequeue | Bearer | `dict` |

---

## Task C — Gap Report

| Frontend Need | Backend | Status | Fix |
|---------------|---------|--------|-----|
| pingServer | GET /openapi.json | Exists | None |
| loginForTesting | POST /auth/login | Exists | None |
| createGame | POST /games/create | Exists | None |
| joinGame | POST /games/join | Exists | None |
| submitWords | POST /games/{id}/submit_words | Exists | None |
| markReady | POST /games/{id}/ready | Exists | None |
| fetchGameState | GET /games/{id}/state | Exists | None |
| submitGuess | POST /games/{id}/guess | Exists | None |
| fetchFriendRequests | GET /friends/requests | Exists | None |
| fetchFriends | GET /friends/ | Exists | None |
| createFriendRequest | POST /friends/requests | Exists | None |
| respondFriendRequest | POST /friends/requests/{id}/accept|decline|cancel | Exists | None |
| removeFriend | DELETE /friends/{id} | Exists | None |
| challengeFriend | POST /friends/challenge | Exists | None |
| **Matchmaking** | POST /matchmaking/enqueue, etc. | Exists on backend | **Client missing** — add enqueueMatchmaking, getMatchmakingStatus, dequeueMatchmaking to api.ts |

**Response shape:** `GameStateOut` matches client `gameStateSchema`. Backend uses `me` (not `your_user_id`); client schema aligned. No mismatch found.

---

## Task D — Recovery Check (Git)

- `crosswords_mobile/src/lib/api.ts` has no prior commits in current branch history for that path.
- `src/lib/` may have been added in recent work; `git log` returned empty.
- **Recommendation:** No prior version to restore. Current `api.ts` (354 lines) implements all required game/friends functions. The only missing client wiring is **matchmaking**, which was never in the client.

---

## Deliverable: Backend/Client Wiring Plan (by dependency)

### (1) Must-have for create/join game
| Item | Status |
|------|--------|
| POST /auth/login (or register) | Wired (loginOrRegisterForTesting) |
| POST /games/create | Wired (createGame) |
| POST /games/join | Wired (joinGame) |
| setActiveGameId(data.game_id) in LobbyScreen | Fixed |

**No gaps.** Create/join flow is complete.

---

### (2) Must-have for submit words/ready/start
| Item | Status |
|------|--------|
| POST /games/{id}/submit_words | Wired (submitWords) |
| POST /games/{id}/ready | Wired (markReady) |
| GET /games/{id}/state | Wired (fetchGameState via useGameState) |

**No gaps.** Submit words, mark ready, and state polling are complete.

---

### (3) Must-have for board state + guessing
| Item | Status |
|------|--------|
| GET /games/{id}/state | Wired (fetchGameState) |
| POST /games/{id}/guess | Wired (submitGuess) |
| GameState schema | Aligned (me, opponent_masked, your_history_grouped, your_solved) |

**No gaps.** Board and guessing flow are complete.

---

### (4) Nice-to-have (friends/matchmaking/admin)
| Item | Status | Fix |
|------|--------|-----|
| Friends CRUD + challenge | Wired | None |
| Matchmaking (Quick Play) | **Client missing** | Add to api.ts: `enqueueMatchmaking(apiKey)`, `getMatchmakingStatus(apiKey)`, `dequeueMatchmaking(apiKey)` |
| Admin UI | Backend only | No client; optional |

**Single gap:** Matchmaking endpoints exist but have no client functions. Add three functions to `api.ts` when implementing Quick Play.

---

## Summary

- **Core flow (create → join → submit words → ready → board → guess):** Fully wired. No backend or client gaps.
- **Friends:** Fully wired.
- **Matchmaking:** Backend ready; client needs `enqueueMatchmaking`, `getMatchmakingStatus`, `dequeueMatchmaking` when adding Quick Play.
- **Recovery:** No recoverable prior api.ts; current implementation is complete for game and friends flows.
