"""Central config flags for the CrosSwords server."""

import os

# Allow calling endpoints without Authorization header during local dev.
# When True, the auth dependency will also accept ?api_key=... in the query string.
LOCAL_ONLY_MODE: bool = os.getenv("LOCAL_ONLY_MODE", "true").lower() in ("1", "true", "yes")

# Whether the server accepts *client-reported* feedback (unsafe; only enable for trusted clients).
CLIENT_TRUSTED_FEEDBACK: bool = os.getenv("CLIENT_TRUSTED_FEEDBACK", "false").lower() in ("1", "true", "yes")

# Database URL; defaults to a local SQLite file for easy setup.
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./crosswords.db")

# Milestone 1: Lobby countdown length (seconds) after both players Ready.
COUNTDOWN_SECONDS: int = int(os.getenv("COUNTDOWN_SECONDS", "5"))

# Internal token that authorizes bot-only endpoints. Keep this secret; do not expose to players.
BOT_INTERNAL_TOKEN: str = os.getenv("BOT_INTERNAL_TOKEN", "dev-bot-token")

# Default bot word list used when auto-joining a PvE bot.
# Must satisfy validate_wordset: (two 4-letter, two 5-letter, one 6-letter)
# Keep them easy to place (diverse letters) to avoid auto-placement failures.
BOT_DEFAULT_WORDS: str = os.getenv("BOT_DEFAULT_WORDS", "LIME,BOAT,APPLE,TRAIN,ORANGE")

# Whether the server should auto-trigger a bot move immediately after a player guess
# when a bot is present in the game.
BOT_AUTO_PLAY: bool = os.getenv("BOT_AUTO_PLAY", "true").lower() in ("1", "true", "yes")

# Max number of bot moves per game to avoid runaway loops.
BOT_MAX_MOVES: int = int(os.getenv("BOT_MAX_MOVES", "50"))

# Use expert bot logic (entropy-based; dictionary candidates; no repeats). If false, falls back to simple random bot.
# NOTE: Kept for backward-compat; BOT_DIFFICULTY overrides when set.
BOT_EXPERT_MODE: bool = os.getenv("BOT_EXPERT_MODE", "true").lower() in ("1", "true", "yes")

# Difficulty levels for the bot:
#   easy   -> random valid guesses (no smart pruning)
#   normal -> current smarter flow (feedback pruning + small-pool letter frequency)
#   hard   -> full entropy-ish search with pruning
BOT_DIFFICULTY: str = os.getenv("BOT_DIFFICULTY", "normal").lower()

# Admin key for local admin UI/actions; leave blank to disable.
ADMIN_API_KEY: str = os.getenv("ADMIN_API_KEY", "")

# DEV ONLY: When True, GET /games/{id}/state includes debug_bot_words (and optionally debug_solution_words)
# for bot games so testers know what they are testing toward. Default OFF; set DEBUG_REVEAL_SOLUTIONS=1 to enable.
DEBUG_REVEAL_SOLUTIONS: bool = os.getenv("DEBUG_REVEAL_SOLUTIONS", "false").lower() in ("1", "true", "yes")
