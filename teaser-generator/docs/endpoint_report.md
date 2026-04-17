# CrosSWords Mobile -> Server Endpoint Report (2026-02-09)

## 1) Repo overview (server-related)
- `crosswords_server/` - FastAPI backend. Entry point `app/main.py`; launched via `uvicorn app.main:app --reload` (see `start_crosswords.bat`). Handles auth, games, bots, friends, matchmaking endpoints consumed by the mobile app.
- `crosswords_ui_streamlit/` - Streamlit desktop/web UI acting as an alternative client; invokes the same FastAPI endpoints (run with `streamlit run client_streamlit_lobby_board_v1.py`). Not used by the mobile app but server-facing.
- `crosswords_mobile/src/lib/api.ts` - Mobile API wrapper around the FastAPI endpoints. Centralizes `fetch` calls and headers; uses hardcoded `API_BASE_URL` (`http://10.0.0.104:8000`) instead of the `.env.example` value.
- Supporting launch script: `start_crosswords.bat` - starts FastAPI (port 8000) and Streamlit previews (ports 8501/8502).

## 2) Client -> Server call sites (mobile app)
_For each call: path, method, body/response, and where it is used._

- `pingServer` - GET `/healthz`; no body; expects `{ ok: true }`; purpose: connectivity test. Used in `src/screens/TitleScreen.tsx` (Test Connection button) and `src/screens/WelcomeScreen.tsx`.
- `loginForTesting` / `registerForTesting` / `loginOrRegisterForTesting` - POST `/auth/login` or `/auth/register`; body `{ username, password }`; response `{ user_id, api_key }`; purpose: dev-only auto-login. Called from `src/stores/sessionStore.ts` inside `ensureApiKey()`.
- `fetchGameState` - GET `/games/{game_id}/state`; headers: `Authorization: Bearer <apiKey>`; response parsed to `GameState` (fields listed in Section 3); purpose: poll live game state. Called via `useGameState` hook (`src/hooks/useGameState.ts`), used by `LobbyScreen`, `PreGameScreen`, `BoardScreen`.
- `fetchRawGameState` - GET `/games/{game_id}/state`; returns raw `{ status, text }`; purpose: developer copy panel. Used in `src/screens/PreGameScreen.tsx` (DEV panel Copy /state button).
- `createGame` - POST `/games/create`; body `{}`; response `{ game_id }`; purpose: start new game. Used in `LobbyScreen` create flow.
- `joinGame` - POST `/games/join`; body `{ game_id }`; response `{ ok:true }`; purpose: join existing game. Used in `LobbyScreen` join flow and immediately after `createGame` to attach creator.
- `botJoinPublic` - POST `/games/{id}/bot_join_public[?mode=easy|normal|hard]`; body `{}`; response `{ ok:true, bot_user_id }`; purpose: attach bot opponent. Called from `LobbyScreen` when Play vs Bot toggle on.
- `submitWords` - POST `/games/{id}/submit_words`; body `{ words: string[] }`; response `{ ok:true }`; purpose: send player word list. Used in `LobbyScreen` and `PreGameScreen` submit actions.
- `markReady` - POST `/games/{id}/ready`; body `{}`; response `{ ok:true }`; purpose: mark player ready after word submission. Used in `LobbyScreen` and `PreGameScreen`.
- `submitGuess` - POST `/games/{id}/guess`; body `{ target_word_index, guess_word, target_signature? }`; response `{ ok:true, codes?: string[] }`; purpose: submit turn guess. Used in `src/screens/BoardScreen.tsx` (guessMutation) and legacy variant.
- Friends API:
  - `fetchFriendRequests` - GET `/friends/requests?direction=in|out|all`; response `FriendRequest[]` ({ id, from_user_id, to_user_id, status, created_at, responded_at?, from_display_name?, to_display_name? }); used in `FriendsScreen`.
  - `fetchFriends` - GET `/friends/`; response `Friend[]` ({ user_id, display_name?, since }); used in `FriendsScreen`.
  - `createFriendRequest` - POST `/friends/requests`; body `{ to_user_id }`; response: UNKNOWN (passed through); purpose: send request. Used in `FriendsScreen`.
  - `respondFriendRequest` - POST `/friends/requests/{id}/(accept|decline|cancel)`; body `{}`; response: UNKNOWN; purpose: act on requests. Used in `FriendsScreen`.
  - `removeFriend` - DELETE `/friends/{friend_user_id}`; response: UNKNOWN; purpose: remove friend. Used in `FriendsScreen`.
  - `challengeFriend` - POST `/friends/challenge`; body `{ opponent_user_id }`; response `{ game_id }`; purpose: create game vs friend. Used in `FriendsScreen`.

## 3) Endpoint inventory table
_Method | Path | Used by (file:function) | Request fields | Response fields | Notes_
- GET | `/healthz` | `TitleScreen:handleTestConnection`, `WelcomeScreen:onTestConnection` | none | `{ ok: boolean }` | Connectivity check; no auth.
- POST | `/auth/login` | `sessionStore:ensureApiKey?loginForTesting` | `username`, `password` | `{ user_id, api_key }` | Dev-only auto login.
- POST | `/auth/register` | `sessionStore:ensureApiKey?registerForTesting` | `username`, `password` | `{ user_id, api_key }` | Called after 401 to auto-create dev user.
- GET | `/games/{id}/state` | `useGameState?fetchGameState`; `PreGameScreen:handleCopyState` | headers `Authorization` | `GameState` fields: `game_id`, `status`, `start_at?`, `current_turn_user_id?`, `me{user_id,words_submitted,ready}`, `opponent?` same shape, `opponent_is_bot?`, `opponent_history[]`, `your_progress_letters`, `opponent_progress_letters`, `total_letters`, `your_history[]`, `target_lengths[]`, `opponent_masked[]`, `revealed_coords[][]`, `your_history_grouped{}`, `your_solved[]`, `dictionary_slot`, `debug_bot_words?`, `debug_solution_words?`, `targets_meta[]` | Polling every 1s (active) or 5s (idle).
- POST | `/games/create` | `LobbyScreen:createGameMutation` | body `{}` + auth | `{ game_id }` | Immediately followed by `/games/join` by creator.
- POST | `/games/join` | `LobbyScreen:joinGameMutation` | `{ game_id }` + auth | `{ ok:true }` | Alerts on error.
- POST | `/games/{id}/bot_join_public` | `LobbyScreen:botJoinWithRetry` | body `{}`; query `mode?` | `{ ok:true, bot_user_id }` | Dev/testing bot attach.
- POST | `/games/{id}/submit_words` | `LobbyScreen:submitWordsMutation`, `PreGameScreen:submitWordsMutation` | `{ words:string[] }` | `{ ok:true }` | Validates lengths server-side.
- POST | `/games/{id}/ready` | `LobbyScreen:markReadyMutation`, `PreGameScreen:markReadyMutation` | `{}` | `{ ok:true }` | Marks player ready.
- POST | `/games/{id}/guess` | `BoardScreen:guessMutation` | `{ target_word_index, guess_word, target_signature? }` | `{ ok:true, codes?: string[] }` | Logging includes request/response IDs.
- GET | `/friends/requests` | `FriendsScreen:requestsQuery` | query `direction=in|out|all` | `FriendRequest[]` | Requires auth.
- GET | `/friends/` | `FriendsScreen:friendsQuery` | none (auth) | `Friend[]` | List friends.
- POST | `/friends/requests` | `FriendsScreen:mutateCreate` | `{ to_user_id }` | UNKNOWN (server returns detail) | Sends friend request.
- POST | `/friends/requests/{id}/accept|decline|cancel` | `FriendsScreen:mutateAccept/Decline/Cancel` | `{}` | UNKNOWN | Acts on request.
- DELETE | `/friends/{friend_user_id}` | `FriendsScreen:mutateRemove` | none | UNKNOWN | Remove friend.
- POST | `/friends/challenge` | `FriendsScreen:mutateChallenge` | `{ opponent_user_id }` | `{ game_id }` | Starts game vs friend.

## 4) Realtime / sockets
- No websockets/socket.io/SSE found. Live updates use polling via React Query in `useGameState.ts` against `GET /games/{id}/state` every 1s (active) or 5s (idle). No server push channel identified.

## 5) Auth / identity handling
- Identity: API key from FastAPI (`api_key` string). Stored in-memory in Zustand `sessionStore` (`apiKey`), optionally preloaded from `EXPO_PUBLIC_API_KEY`. Not persisted to AsyncStorage.
- Dev auto-login: `ensureApiKey()` (sessionStore) calls `/auth/login`; on `Invalid credentials.` it calls `/auth/register` then retries login. Credentials hardcoded to `testuser` / `testpass123`.
- Display name: stored separately in `userStore.username` (local only; not linked to server `user_id` yet).
- Requests include `Authorization: Bearer <apiKey>` via `headers()` helper in `src/lib/api.ts`.

## 6) Game state ownership (today)
- Create game: server via `POST /games/create` (called from `LobbyScreen`).
- Join game: server via `POST /games/join` (LobbyScreen).
- Submit words: server validates and stores via `POST /games/{id}/submit_words` (LobbyScreen/PreGameScreen).
- Mark ready: server records readiness via `POST /games/{id}/ready` (LobbyScreen/PreGameScreen).
- Compute turn/feedback: server via `POST /games/{id}/guess`; client only sends cleaned guess string and target index (BoardScreen). Feedback codes come from server.
- Game state / turn ownership: server provides via `GET /games/{id}/state`; client only renders/polls. Finish game inferred from server `status` (e.g., `finished`); no client-side completion logic.

## 7) Serverless migration mapping (first-pass)
- `/games/create` -> serverless function `encodeChallenge` returning game token.
- `/games/join` -> `decodeChallenge` to attach/join via token.
- `/games/{id}/submit_words` -> `applyWords` (serverless validate/store word lists).
- `/games/{id}/ready` -> `markReady` serverless toggle on shared state document.
- `/games/{id}/guess` -> `applyGuess` that updates shared GameState and returns codes.
- `/games/{id}/state` -> direct read of `GameState` document (cached in KV/DB); polling continues.
- `/friends/*` -> serverless collection for `friend_requests`, `friends`, `challenge` mapping to game token creation.
- `/auth/login|register` -> lightweight identity provider or key-issuing function; could be replaced by device-bound token issuer.
- `/healthz` -> trivial serverless "ping".
- `/games/{id}/bot_join_public` -> serverless bot move enqueuer (invoke bot worker) or inline bot attach function.

## Open Questions / Unknowns
- Actual response bodies for friend-related POST/DELETE endpoints are not documented in the code (marked UNKNOWN above).
- Server `GameState.status` canonical values (`pre_game`, `starting`, `active`, `finished`?) come from backend; only observed via schema typing, not enumerated.
- Whether `API_BASE_URL` should read from `EXPO_PUBLIC_API_BASE_URL` env (currently hardcoded) before migration.
- Any matchmaking/leaderboard endpoints planned but not yet wired on the client?
