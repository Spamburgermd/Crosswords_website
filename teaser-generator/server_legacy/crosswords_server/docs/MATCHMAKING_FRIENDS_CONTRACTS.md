# Matchmaking & Friends Challenge API Contracts

Stable contracts for polling and navigation. All endpoints require `Authorization: Bearer <api_key>` unless noted.

---

## Matchmaking

### POST /matchmaking/enqueue

Enqueue the caller for Quick Play. If a suitable opponent is found immediately, returns `game_id`. Otherwise returns `game_id=0` — client should poll GET /matchmaking/status.

**Request**
```
POST /matchmaking/enqueue
Authorization: Bearer <api_key>
(no body)
```

Optional query: `max_skill_window=400.0`

**Response** (200 OK)
```json
{ "game_id": 42 }
```
or when waiting:
```json
{ "game_id": 0 }
```

**Polling flow:** If `game_id > 0` → matched; navigate to game. If `game_id === 0` → poll GET /matchmaking/status until matched.

---

### GET /matchmaking/status

Check if the caller has been matched. If matched, returns `game_id` and removes the caller from the queue.

**Request**
```
GET /matchmaking/status
Authorization: Bearer <api_key>
```

**Response** (200 OK)
```json
{ "game_id": 42 }
```
when matched, or
```json
{ "game_id": 0 }
```
when not yet matched.

**Stable "matched" state:** `game_id > 0` indicates matched; client should navigate to `/games/{game_id}/state` and set `activeGameId` for the Board screen.

---

### POST /matchmaking/dequeue

Remove the caller from the queue (e.g., user cancels Quick Play).

**Request**
```
POST /matchmaking/dequeue
Authorization: Bearer <api_key>
(no body)
```

**Response** (200 OK)
```json
{ "ok": true }
```

---

## Friends Challenge

### POST /friends/challenge

Create a game with a friend. Both players are added immediately; each still submits words and marks ready.

**Request**
```
POST /friends/challenge
Authorization: Bearer <api_key>
Content-Type: application/json

{ "opponent_user_id": 7 }
```

**Response** (200 OK)
```json
{ "game_id": 42 }
```

**Navigation:** Client sets `activeGameId` to `game_id` and navigates to Lobby/Board.

---

## Health Check

### GET /healthz

No auth required. Minimal health check for load balancers / readiness probes.

**Request**
```
GET /healthz
```

**Response** (200 OK)
```json
{ "ok": true }
```
