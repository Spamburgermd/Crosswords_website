# app/schemas/schemas.py
# Pydantic request/response models for the API.

from __future__ import annotations
from enum import Enum
from typing import List, Optional, Dict
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator

# -------- Auth --------
class RegisterIn(BaseModel):
    username: str
    password: str

class LoginIn(BaseModel):
    username: str
    password: str

class AuthOut(BaseModel):
    user_id: int
    api_key: str

# -------- Games: create/join --------
class DictionarySlotEnum(str, Enum):
    """Dictionary slot for game word list. Only STANDARD is enabled; A/B/C return 400."""
    STANDARD = "STANDARD"
    A = "A"
    B = "B"
    C = "C"


class CreateGameIn(BaseModel):
    dictionary_slot: Optional[DictionarySlotEnum] = None  # defaults to STANDARD when omitted


class CreateGameOut(BaseModel):
    game_id: int

class JoinGameIn(BaseModel):
    game_id: int

# -------- Submit words --------
class SubmitWordsIn(BaseModel):
    words: List[str] = Field(min_items=5, max_items=5)

# -------- Player summary (safe; no words leak) --------
class PlayerStateSummary(BaseModel):
    user_id: int
    words_submitted: bool
    ready: bool

# -------- Guessing --------
class GuessIn(BaseModel):
    target_word_index: int  # which of opponent's 5 words (0..4)
    guess_word: str         # letters only; server enforces exact length
    target_signature: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    def _legacy_aliases(cls, values):
        """Coerce legacy field names used by older clients."""
        if not isinstance(values, dict):
            return values
        data = dict(values)
        if "target_word_index" not in data and "target_index" in data:
            data["target_word_index"] = data.pop("target_index")
        if "guess_word" not in data and "guess" in data:
            data["guess_word"] = data.pop("guess")
        if "target_signature" not in data and "signature" in data:
            data["target_signature"] = data["signature"]
        return data

class GuessEntryOut(BaseModel):
    target_index: int
    guess: str
    codes: List[str]              # e.g. ["G","Y","R","R","G"]
    created_at: datetime

# -------- Masked board payloads --------
class MaskedSegmentOut(BaseModel):
    # This mirrors one placed word, WITHOUT letters (coords only).
    # Example: {"coords": [[4,3],[4,4],[4,5],[4,6]], "orient": "H"}
    coords: List[List[int]]
    orient: str


class TargetMetaOut(BaseModel):
    target_index: int
    length: int
    start: List[int]
    dir: str
    coords: List[List[int]]

# -------- Game state (full, safe) --------
class GameStateOut(BaseModel):
    """Contract: me and opponent are top-level siblings only; no me.opponent."""

    model_config = ConfigDict(extra="forbid")

    game_id: int
    status: str                          # "waiting" | "starting" | "active" | "finished"
    start_at: Optional[datetime] = None  # present when status == "starting"
    current_turn_user_id: Optional[int] = None

    me: PlayerStateSummary
    opponent: Optional[PlayerStateSummary] = None
    opponent_is_bot: bool = False
    opponent_history: List[GuessEntryOut] = []

    # Milestone 2/3 basics
    your_progress_letters: int = 0
    opponent_progress_letters: int = 0
    total_letters: int = 0
    your_history: List[GuessEntryOut] = []   # flat list with target_index + codes
    target_lengths: List[int] = []

    # Board masking
    opponent_masked: List[MaskedSegmentOut] = []
    revealed_coords: List[List[int]] = []

    # --------- NEW (polish) ---------
    # Grouped history: { 0: [GuessEntryOut,...], 1: [...], ... }
    your_history_grouped: Dict[int, List[GuessEntryOut]] = {}

    # Solved flags for your view of opponent's 5 words.
    # True at index i if you have made at least one all-GREEN guess for word i.
    your_solved: List[bool] = [False, False, False, False, False]

    # Dictionary slot for this game (STANDARD by default; backward compatible).
    dictionary_slot: str = "STANDARD"

    # DEV ONLY: Populated when DEBUG_REVEAL_SOLUTIONS=1 and opponent is a bot. Backward compatible (default None).
    debug_bot_words: Optional[List[str]] = None
    debug_solution_words: Optional[List[str]] = None
    # Metadata tying canonical slots to backend target_index.
    targets_meta: List[TargetMetaOut] = []

# -------- Profiles --------
class ProfileOut(BaseModel):
    user_id: int
    display_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    last_active_at: datetime
    created_at: datetime


class ProfileUpdateIn(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None


# -------- Friends --------
class FriendRequestCreateIn(BaseModel):
    to_user_id: int


class FriendRequestOut(BaseModel):
    id: int
    from_user_id: int
    to_user_id: int
    status: str
    created_at: datetime
    responded_at: Optional[datetime] = None
    from_display_name: Optional[str] = None
    to_display_name: Optional[str] = None


class FriendOut(BaseModel):
    user_id: int
    display_name: Optional[str] = None
    since: datetime


class FriendChallengeCreateIn(BaseModel):
    opponent_user_id: int
# ===================== END OF FILE =====================
