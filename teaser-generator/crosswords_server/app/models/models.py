"""SQLModel database models for CrosSwords."""

import json
from datetime import datetime
from typing import Optional, List

from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field, Relationship


# -------------------------
# User
# -------------------------
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    api_key: str = Field(index=True, unique=True)  # simple dev token
    created_at: datetime = Field(default_factory=datetime.utcnow)

    games: List["GamePlayer"] = Relationship(back_populates="user")


# -------------------------
# Game
# -------------------------
class Game(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # Milestone 1 lifecycle:
    # "waiting"  : waiting for second player and/or word submissions
    # "starting" : both players validated + readied; countdown running until start_at
    # "active"   : countdown elapsed; board view allowed
    # "finished" : end-of-game (future milestones)
    status: str = Field(default="waiting", index=True)

    # creator (used by router on create) - MUST be set (NOT NULL)
    created_by_id: int = Field(foreign_key="user.id", index=True)

    # whose turn during play (None until game goes active; set later milestones)
    current_turn_user_id: Optional[int] = Field(
        default=None, foreign_key="user.id"
    )

    # When the server flipped to "starting", it sets start_at = now() + countdown
    start_at: Optional[datetime] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Dictionary slot: STANDARD (EOWL), A/B/C (disabled for now). Used for validation and bot words.
    dictionary_slot: str = Field(default="STANDARD")

    players: List["GamePlayer"] = Relationship(back_populates="game")
    guesses: List["Guess"] = Relationship(back_populates="game")  # defined later


# -------------------------
# GamePlayer (one row per user per game)
# -------------------------
class GamePlayer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    game_id: int = Field(foreign_key="game.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)

    # whether this player is P1 (helps determine turn order)
    is_player1: bool = Field(default=False)

    # raw words (5 strings) as JSON: {"words": ["TREE", "..."]}
    words_json: Optional[str] = Field(default=None)

    # authoritative autoplacement result:
    # {"placed": [{"text":"APPLE","orient":"H","coords":[[r,c],...],"solved":false}, ...]}
    words_layout_json: Optional[str] = Field(default=None)

    # coordinates that the OPPONENT has revealed by guessing this board
    # stored as JSON list of pairs: [[r,c],[r,c],...]
    revealed_coords_json: Optional[str] = Field(default=None)

    # running total of GREEN letters solved by THIS player on opponent's board (later milestones)
    letters_solved_count: int = Field(default=0)

    # flags to coordinate lobby flow
    words_submitted: bool = Field(default=False)  # player uploaded/validated their 5 words
    ready: bool = Field(default=False)            # player clicked "Ready"

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    game: "Game" = Relationship(back_populates="players")
    user: "User" = Relationship(back_populates="games")

    # ---- helpers for routers (keep the router code clean) ----
    def get_words(self) -> List[str]:
        if not self.words_json:
            return []
        try:
            payload = json.loads(self.words_json) or {}
            words = payload.get("words") or []
            return [str(w).strip().upper() for w in words]
        except Exception:
            return []

    def get_layout(self) -> List[dict]:
        if not self.words_layout_json:
            return []
        try:
            payload = json.loads(self.words_layout_json) or {}
            return payload.get("placed") or []
        except Exception:
            return []


# -------------------------
# Guess (placeholder for later milestones)
# -------------------------
class Guess(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    game_id: int = Field(foreign_key="game.id", index=True)
    guesser_user_id: int = Field(foreign_key="user.id", index=True)
    target_word_index: int = Field(default=0)  # 0..4
    guess_text: str
    feedback_json: str  # e.g., {"codes":["G","Y","R","R","G"]}

    created_at: datetime = Field(default_factory=datetime.utcnow)

    game: "Game" = Relationship(back_populates="guesses")


# -------------------------
# Profiles & Social
# -------------------------
class Profile(SQLModel, table=True):
    """Public profile fields attached 1:1 to a user."""

    user_id: int = Field(primary_key=True, foreign_key="user.id")
    display_name: str = Field(index=True)
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    last_active_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    skill_rating: float = Field(default=1000.0, index=True)  # simple Elo-style rating for matchmaking


class FriendRequest(SQLModel, table=True):
    """Tracks a single friend request between two users."""

    id: Optional[int] = Field(default=None, primary_key=True)
    from_user_id: int = Field(foreign_key="user.id", index=True)
    to_user_id: int = Field(foreign_key="user.id", index=True)
    status: str = Field(default="pending", index=True)  # pending|accepted|declined|cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)
    responded_at: Optional[datetime] = None


class Friendship(SQLModel, table=True):
    """Represents a confirmed friendship; we store one row per direction for fast lookup."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    friend_user_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "friend_user_id", name="uq_friend_pair"),)


# -------------------------
# Matchmaking queue
# -------------------------
class MatchmakingEntry(SQLModel, table=True):
    """Row per waiting user for Quick Play."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True, index=True)
    enqueued_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    skill_rating: float = Field(default=1000.0, index=True)
    matched_game_id: Optional[int] = Field(default=None, index=True)
    matched_with_user_id: Optional[int] = Field(default=None, index=True)
# ===================== END OF FILE =====================
