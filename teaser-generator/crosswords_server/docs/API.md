# CrosSwords FastAPI Server — API Reference (v0.1.0)

This server powers the turn-based CrosSwords gameplay. It handles users, games,
word submission/validation, turns, guesses, and progress summaries.

> Run the server:
>
> ```bash
> uvicorn app.main:app --reload
> ```
>
> Interactive docs available at `/docs`.

## Auth

### `POST /auth/register`
Register a new user.

**Body**
```json
{ "username": "alice", "password": "password123" }
```

**Response**
```json
{ "user_id": 1, "api_key": "hex..." }
```

### `POST /auth/login`
Login and retrieve the API key.

**Body**
```json
{ "username": "alice", "password": "password123" }
```

**Response**
```json
{ "user_id": 1, "api_key": "hex..." }
```

> Use this in the `Authorization` header for all game endpoints:
> `Authorization: Bearer <api_key>`

## Games

### `POST /games/create`
Create a new game as the calling user (becomes Player 1).

**Response**
```json
{ "game_id": 42 }
```

### `POST /games/join`
Join an existing game as Player 2.

**Body**
```json
{ "game_id": 42 }
```

**Response**
```json
{ "ok": true }
```

### `POST /games/{game_id}/submit_words`
Submit your five-word set. Must be exactly: 2×4-letter, 2×5-letter, 1×6-letter.
All **uppercase**, unique, and present in the EOWL-based dictionary (unless dev fallback is active).

**Body**
```json
{ "words": ["TREE","BIRD","APPLE","TABLE","PLANET"] }
```

**Response**
```json
{ "ok": true }
```

When both players have submitted, the game status becomes `in_progress` and Player 1 starts.

### `GET /games/{game_id}/state`
Returns your view of the game (turn, status, progress).

**Response**
```json
{
  "game_id": 42,
  "status": "in_progress",
  "your_user_id": 1,
  "your_letters_solved": 3,
  "opponent_letters_solved": 1,
  "your_words_submitted": true,
  "opponent_words_submitted": true,
  "your_turn": true
}
```

### `POST /games/{game_id}/guess`
Make a whole-word guess at **one** of your opponent's words (by index 0..4).

**Body**
```json
{ "target_word_index": 0, "guess_word": "SAND" }
```

**Response**
```json
{
  "per_letter": ["grey","green","blue","grey"],
  "greens": 1,
  "yellows": 0,
  "blues": 1,
  "total_correct_letters_so_far": 4
}
```

- **green**: right letter in the right place (counts toward your total letters solved)
- **yellow**: letter is in the target word but a different position (Wordle-style)
- **blue**: letter not in the target word, but appears in **another** of the opponent's five words
- **grey**: letter is not in any of the opponent's five words

The server accumulates your **greens** across guesses as your
`letters_solved_count`. Reaching 24 marks the game `complete`.

## Data Model (simplified ER)

```
User (id, username, password_hash, api_key)
  └── GamePlayer (id, game_id, user_id, is_player1, words_json, words_submitted, letters_solved_count)
        └── Game (id, status, current_turn_user_id)
               └── Guess (id, game_id, guesser_user_id, target_player_user_id, target_word_index, guess_word, feedback_json)
```

## Dictionary

The server now uses tiered dictionary files in `data/`:
- target words come from the game's selected tier
- guess validation always checks against `data/tier_canon_4_6.json`
- supported target tiers are `CORE`, `STANDARD`, `ADVANCED`, and `CANON`
- legacy aliases still normalize: `COMMON -> CORE`, `MODIFIED -> STANDARD`, `TWL -> CANON`

If the selected target file is absent, the server temporarily soft-allows A–Z words and prints a console warning.

## Roadmap / TODO

- Proper JWT authentication & refresh tokens
- Word **grid placement** legality check (server-side) before starting a match
- Rate limiting & abuse protection
- Spectator / replay endpoints
- E2E tests + CI
```



---

## Optional (UNSAFE) — `POST /games/{game_id}/report_feedback`

> Enable with env `CLIENT_TRUSTED_FEEDBACK=true`. Do **not** use for public/ranked matches.

Client reports its own colors/greens. The server will accept the report without recomputation.

**Body**
```json
{
  "target_word_index": 0,
  "guess_word": "SAND",
  "per_letter": ["grey","green","blue","grey"],
  "greens": 1,
  "yellows": 0,
  "blues": 1
}
```

**Response**
```json
{ "ok": true }
```

**Flags**
- `CLIENT_TRUSTED_FEEDBACK=false` (default) — endpoint disabled
- `LOCAL_ONLY_MODE=true` — quieter logs; pair with `uvicorn ... --log-level warning`
