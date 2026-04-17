# CrosSwords Server — Architecture Notes

## Overview

The server follows a simple, beginner-friendly layered layout:

```
app/
  main.py                # FastAPI app wiring (routers + startup)
  db/session.py          # DB engine + session dependency
  models/models.py       # SQLModel table classes
  schemas/schemas.py     # Pydantic request/response models
  services/
    security.py          # password hashing + dev API key
    auth_dep.py          # FastAPI dependency to require a user
    twl.py               # tiered word list loader; target tier + canon guess validation
    validate.py          # wordset validation + guess feedback
  routers/
    auth.py              # /auth endpoints
    games.py             # /games endpoints
data/
  tier_core_4_6.json         # Core target pool
  tier_standard_4_6.json     # Standard target pool
  tier_advanced_4_6.json     # Advanced target pool
  tier_canon_4_6.json        # Canon target + guess validation pool
  dictionary_manifest.json   # Generated counts and aliases
docs/
  API.md                 # human-readable API ref (also see /docs in the app)
```

## Turn Logic

- When both players submit words, the game moves to `in_progress` and `current_turn_user_id` is set to Player 1's user id.
- After a valid guess, we switch `current_turn_user_id` to the opponent.
- Every guess updates the guesser's `letters_solved_count` by the number of **green** letters hit.
- First to reach **24** total greens wins (4+4+5+5+6).

## Guess Feedback Rules

- **green**: right letter, right place (counts toward your total solved letters)
- **yellow**: letter exists in the **target word** but different position
- **blue**: letter is not in the target word, but appears in any **other** word in the opponent's set
- **grey**: letter is not present in any of the opponent's five words

This is implemented in `services/validate.py::compute_feedback`.

## Extending to RN + Expo Client

- Use `/auth/register` and `/auth/login` to obtain the `api_key`.
- Include the header `Authorization: Bearer <api_key>` in all calls.
- Poll `/games/{id}/state` or subscribe via a realtime layer (e.g., Supabase Realtime) later.
- Maintain a local store of your last seen `letters_solved_count` to render progress bars.

## Security (Dev vs Prod)

This skeleton uses a simple per-user API key (derived from username + secret) for **development**.
For production, replace with JWT access/refresh tokens and use HTTPS + proper password policies.
