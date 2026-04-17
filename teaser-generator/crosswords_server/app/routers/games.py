from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
import json
import logging
import random
from typing import Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, Body, Depends, HTTPException, Header, Request
from typing import Any
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..config import (
    BOT_AUTO_PLAY,
    BOT_DEFAULT_WORDS,
    BOT_DIFFICULTY,
    BOT_EXPERT_MODE,
    BOT_INTERNAL_TOKEN,
    BOT_MAX_MOVES,
    COUNTDOWN_SECONDS,
    DEBUG_REVEAL_SOLUTIONS,
)
from ..db.session import get_session
from ..game_logic.scoring import score_guess
from ..models.models import Game, GamePlayer, Guess, User
from ..schemas.schemas import (
    CreateGameIn,
    CreateGameOut,
    GameStateOut,
    GuessEntryOut,
    GuessIn,
    JoinGameIn,
    MaskedSegmentOut,
    PlayerStateSummary,
    SubmitWordsIn,
    TargetMetaOut,
)
from ..services.auth_dep import require_user
from ..services.placement import auto_place_all_words
from ..services.validate import check_profanity, validate_wordset
from ..services import twl
from ..services.dictionary_slots import (
    DEFAULT_TARGET_SLOT,
    get_slot_path,
    is_known_slot,
    is_slot_enabled,
    normalize_slot_name,
)

router = APIRouter(prefix="/games", tags=["games"])
logger = logging.getLogger("croswords.games")
print(f"DEBUG_GUESS_SERVER_START: games router loaded at {datetime.utcnow().isoformat()} UTC")
_bot_expert_games: Dict[int, bool] = {}
_bot_game_difficulty: Dict[int, str] = {}

# Simple English letter frequency weights (ETAOIN) to bias guesses toward common letters.
LETTER_FREQUENCY: Dict[str, float] = {
    "E": 12.0,
    "T": 9.1,
    "A": 8.2,
    "O": 7.5,
    "I": 7.0,
    "N": 6.7,
    "S": 6.3,
    "H": 6.1,
    "R": 6.0,
    "D": 4.3,
    "L": 4.0,
    "C": 2.8,
    "U": 2.8,
    "M": 2.4,
    "W": 2.4,
    "F": 2.2,
    "G": 2.0,
    "Y": 2.0,
    "P": 1.9,
    "B": 1.5,
    "V": 1.0,
    "K": 0.8,
    "J": 0.2,
    "X": 0.2,
    "Q": 0.1,
    "Z": 0.1,
}

# ----------------------------- Helpers -----------------------------
def _ensure_participant(session: Session, game_id: int, me: User) -> tuple[Game, GamePlayer]:
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found.")
    gp = session.exec(
        select(GamePlayer).where(GamePlayer.game_id == game.id, GamePlayer.user_id == me.id)
    ).first()
    if not gp:
        raise HTTPException(403, "You are not a participant in this game.")
    return game, gp

def _summarize_player(gp: GamePlayer) -> PlayerStateSummary:
    return PlayerStateSummary(
        user_id=gp.user_id,
        words_submitted=bool(gp.words_submitted),
        ready=bool(gp.ready),
    )

def _other_player(game: Game, me_id: int) -> Optional[GamePlayer]:
    for p in game.players or []:
        if p.user_id != me_id:
            return p
    return None


def _invalid_state_detail(
    action: str,
    game: Game,
    gp_me: GamePlayer,
    gp_opp: Optional[GamePlayer],
    message: Optional[str] = None,
) -> dict:
    """
    Build a JSON-serializable detail dict for invalid game state errors.
    Uses only data already in hand; no extra queries.
    """
    me_info = {
        "words_submitted": bool(gp_me.words_submitted),
        "ready": bool(gp_me.ready),
    }
    opp_info: dict = {
        "present": gp_opp is not None,
        "words_submitted": bool(gp_opp.words_submitted) if gp_opp else False,
        "ready": bool(gp_opp.ready) if gp_opp else False,
    }
    out: dict = {
        "error": "invalid_game_state",
        "action": action,
        "game_id": game.id,
        "status": game.status,
        "me": me_info,
        "opponent": opp_info,
    }
    if message:
        out["message"] = message
    return out


def _resolve_and_validate_slot(slot_value: str | None) -> str:
    """
    Resolve dictionary slot from request. Default STANDARD.
    Raises HTTPException 400 if slot is unknown or disabled.
    """
    slot = normalize_slot_name(slot_value)
    raw = (slot_value or DEFAULT_TARGET_SLOT).strip().upper()
    if not is_known_slot(raw):
        raise HTTPException(400, f"Invalid dictionary slot: {raw}.")
    if not is_slot_enabled(slot):
        raise HTTPException(400, f"Dictionary slot {slot} is not enabled yet.")
    return slot


def _normalize_difficulty(value: Optional[str]) -> str:
    """
    Map arbitrary input to one of: easy | normal | hard.
    Defaults to "normal" for safety.
    """
    if not value:
        return "normal"
    lowered = value.strip().lower()
    if lowered in ("easy", "normal", "hard"):
        return lowered
    if lowered in ("expert", "pro"):
        return "hard"
    return "normal"


def _get_bot_difficulty(game_id: int) -> str:
    """
    Resolve the bot difficulty for this game.
    Priority:
      1) Per-game override set during bot_join_public (mode param).
      2) Legacy expert flag (BOT_EXPERT_MODE) for compatibility.
      3) Global BOT_DIFFICULTY env (default: normal).
    """
    if game_id in _bot_game_difficulty:
        return _bot_game_difficulty[game_id]
    if _bot_expert_games.get(game_id, BOT_EXPERT_MODE):
        return "hard"
    return _normalize_difficulty(BOT_DIFFICULTY)


def _player_solved_all_targets(session: Session, game_id: int, solver_id: int, target_lengths: List[int]) -> bool:
    """
    Check if a player has solved every target word (all GREEN codes per slot).
    target_lengths are the opponent's word lengths for alignment.
    """
    if not target_lengths:
        return False
    solved = [False] * len(target_lengths)
    rows = session.exec(
        select(Guess)
        .where(Guess.game_id == game_id, Guess.guesser_user_id == solver_id)
        .order_by(Guess.created_at.desc())
    ).all()
    for guess in rows:
        idx = guess.target_word_index
        if idx < 0 or idx >= len(target_lengths):
            continue
        codes = _parse_feedback_codes(guess)
        if codes and len(codes) == target_lengths[idx] and all(code == "G" for code in codes):
            solved[idx] = True
    return all(solved)


def _finish_game(game: Game, session: Session) -> None:
    """Mark the game finished and clear turn tracking."""
    game.status = "finished"
    game.current_turn_user_id = None
    game.updated_at = datetime.utcnow()
    session.add(game)

def _maybe_flip_to_active(game: Game, session: Session) -> None:
    """If status==starting and now >= start_at, flip to active."""
    if game.status == "starting" and game.start_at and datetime.utcnow() >= game.start_at:
        game.status = "active"
        game.updated_at = datetime.utcnow()
        session.add(game)
        session.commit()


def _maybe_start_countdown(game: Game, session: Session) -> None:
    """
    If both players have submitted words and marked Ready, start the countdown to active.
    This mirrors the logic in mark_ready so we can reuse it for bot flows.
    """
    players = list(game.players or [])
    if len(players) == 2 and all(p.words_submitted and p.ready for p in players):
        game.status = "starting"
        game.start_at = datetime.utcnow() + timedelta(seconds=COUNTDOWN_SECONDS)
        game.current_turn_user_id = game.created_by_id
        game.updated_at = datetime.utcnow()
        session.add(game)
        session.commit()

def _safe_target_lengths(opp: Optional[GamePlayer]) -> List[int]:
    if not opp:
        return []
    words = opp.get_words()
    return [len(w) for w in words] if words else []


def _dictionary_version(slot: str) -> str:
    """
    Lightweight dictionary version indicator for clients.
    Uses slot name + basename of the slot path if available (e.g., wordlist_modified_4_6.txt).
    """
    normalized = normalize_slot_name(slot)
    path = get_slot_path(normalized) if normalized else None
    suffix = path.name if path else "unknown"
    return f"{normalized}:{suffix}"


# Higher cap to reduce rare placement misses on valid candidate sets.
BOT_PLACEMENT_MAX_ATTEMPTS = 50


def _default_bot_words(slot: str = DEFAULT_TARGET_SLOT) -> List[str]:
    """
    Pick bot words from dictionary: 2x4-letter, 2x5-letter, 1x6-letter.
    Falls back to BOT_DEFAULT_WORDS env list if dictionary is missing, and pads with random A-words if still short.
    """
    chosen: List[str] = []
    rng = random.Random()
    try:
        pool4 = twl.get_words_by_length(4, slot)
        pool5 = twl.get_words_by_length(5, slot)
        pool6 = twl.get_words_by_length(6, slot)
    except Exception:
        pool4 = pool5 = pool6 = []

    if len(pool4) >= 2:
        chosen.extend(rng.sample(pool4, 2))
    if len(pool5) >= 2:
        chosen.extend(rng.sample(pool5, 2))
    if len(pool6) >= 1:
        chosen.extend(rng.sample(pool6, 1))

    # Fallback to env defaults if dictionary missing/short
    if len(chosen) < 5 and BOT_DEFAULT_WORDS:
        fallback = [w.strip().upper() for w in BOT_DEFAULT_WORDS.split(",") if w.strip()]
        rng.shuffle(fallback)
        for ws in fallback:
            if len(chosen) >= 5:
                break
            chosen.append(ws)

    # Pad with random letters if still short
    while len(chosen) < 5:
        size = 4 if len(chosen) < 2 else (5 if len(chosen) < 4 else 6)
        chosen.append(("A" * size))

    rng.shuffle(chosen)
    return [w.upper() for w in chosen[:5]]


def _default_bot_words_seeded(slot: str, seed: int) -> List[str]:
    """
    Pick bot words from dictionary with deterministic RNG (for reproducible retries).
    Same constraints as _default_bot_words: 2x4, 2x5, 1x6-letter.
    """
    rng = random.Random(seed)
    chosen: List[str] = []
    try:
        pool4 = twl.get_words_by_length(4, slot)
        pool5 = twl.get_words_by_length(5, slot)
        pool6 = twl.get_words_by_length(6, slot)
    except Exception:
        pool4 = pool5 = pool6 = []

    if len(pool4) >= 2:
        chosen.extend(rng.sample(pool4, 2))
    if len(pool5) >= 2:
        chosen.extend(rng.sample(pool5, 2))
    if len(pool6) >= 1:
        chosen.extend(rng.sample(pool6, 1))

    if len(chosen) < 5 and BOT_DEFAULT_WORDS:
        fallback = [w.strip().upper() for w in BOT_DEFAULT_WORDS.split(",") if w.strip()]
        rng.shuffle(fallback)
        for ws in fallback:
            if len(chosen) >= 5:
                break
            chosen.append(ws)

    while len(chosen) < 5:
        size = 4 if len(chosen) < 2 else (5 if len(chosen) < 4 else 6)
        chosen.append(("A" * size))

    rng.shuffle(chosen)
    return [w.upper() for w in chosen[:5]]


def _placement_seed(game_id: int, slot: str, mode: str, attempt: int) -> int:
    """Deterministic seed for bot placement retries. Reproducible per (game_id, slot, mode, attempt)."""
    h = hashlib.sha256(f"{game_id}:{slot}:{mode}:{attempt}".encode()).hexdigest()
    return int(h[:8], 16)


def _history_for(session: Session, game: Game, guesser_id: int) -> List[GuessEntryOut]:
    rows = session.exec(
        select(Guess).where(Guess.game_id == game.id, Guess.guesser_user_id == guesser_id).order_by(Guess.created_at)
    ).all()
    out: List[GuessEntryOut] = []
    for g in rows:
        try:
            payload = json.loads(g.feedback_json) or {}
            codes = payload.get("codes") or []
        except Exception:
            codes = []
        out.append(GuessEntryOut(
            target_index=g.target_word_index,
            guess=g.guess_text,
            codes=codes,
            created_at=g.created_at,
        ))
    return out

def _progress_unique_greens(history: List[GuessEntryOut]) -> int:
    """Count unique GREEN positions across all guessed target words."""
    seen: Set[Tuple[int, int]] = set()
    for entry in history:
        for i, code in enumerate(entry.codes or []):
            if code == "G":
                seen.add((entry.target_index, i))
    return len(seen)


def _normalize_direction(value: Optional[str]) -> str:
    """Normalize orientations to 'A' (across) or 'D' (down)."""
    if not value:
        return "A"
    char = value[0].upper()
    return "A" if char in ("A", "H") else "D"


def _normalize_coords(coords: List[List[int]], dir_value: str) -> List[List[int]]:
    """Return coordinates sorted along the word direction for stable signatures."""
    normalized = [[int(pair[0]), int(pair[1])] for pair in coords]
    if dir_value == "A":
        normalized.sort(key=lambda pair: (pair[1], pair[0]))
    else:
        normalized.sort(key=lambda pair: (pair[0], pair[1]))
    return normalized

def _build_path_signature(dir_value: str, coords: List[List[int]]) -> str:
    """
    Build a deterministic signature for a target path.
    Signature format matches the frontend: "{dir}|r,c;r,c;..."
    """
    normalized = _normalize_coords(coords, dir_value)
    coord_parts = [f"{int(r)},{int(c)}" for r, c in normalized]
    return f"{dir_value}|{';'.join(coord_parts)}"


def _canonical_targets_from_layout(layout: List[Dict]) -> List[Dict]:
    """
    Build a canonical list of target metadata shared between /state, /guess, and bot moves.
    Returns entries sorted deterministically by start cell + direction + signature.
    """
    entries: List[Dict] = []
    for idx, segment in enumerate(layout):
        coords = segment.get("coords") or []
        if not coords:
            continue
        dir_value = _normalize_direction(segment.get("orient"))
        normalized_coords = _normalize_coords(coords, dir_value)
        if not normalized_coords:
            continue
        signature = _build_path_signature(dir_value, normalized_coords)
        start_row, start_col = normalized_coords[0]
        entries.append(
            {
                "target_index": idx,
                "length": len(normalized_coords),
                "coords": normalized_coords,
                "dir": dir_value,
                "signature": signature,
                "start_row": start_row,
                "start_col": start_col,
            }
        )
    entries.sort(key=lambda entry: (entry["start_row"], entry["start_col"], entry["dir"], entry["signature"]))
    return entries

def _masked_layout_for(opp: Optional[GamePlayer], layout: Optional[List[Dict]] = None) -> List[Dict]:
    """
    Return coords-only segments for opponent words.
    Example: [{"coords": [[r,c],...], "orient":"H"}, ...]
    """
    if not opp:
        return []
    actual_layout = layout if layout is not None else opp.get_layout() or []
    segs = []
    for seg in actual_layout:
        coords = seg.get("coords") or []
        orient = seg.get("orient") or "H"
        # force int pairs
        coords2 = [[int(r), int(c)] for (r, c) in coords]
        segs.append({"coords": coords2, "orient": str(orient)})
    return segs

def _revealed_coords_from_history(history: List[GuessEntryOut], opp: Optional[GamePlayer]) -> List[List[int]]:
    """
    Map GREEN codes from my history onto the opponent's board coordinates.
    Uses the opponent's placed layout to turn (target_index, pos) into (r,c).
    """
    if not opp:
        return []
    layout = opp.get_layout() or []
    coords: Set[Tuple[int, int]] = set()
    for entry in history:
        # sanity: ensure target_index exists and coords list is same length as target word
        if entry.target_index < 0 or entry.target_index >= len(layout):
            continue
        seg = layout[entry.target_index] or {}
        seg_coords = seg.get("coords") or []
        for pos, code in enumerate(entry.codes or []):
            if code == "G" and pos < len(seg_coords):
                r, c = seg_coords[pos]
                coords.add((int(r), int(c)))
    return [[r, c] for (r, c) in sorted(coords)]


def _require_bot_token(bot_token: str | None = Header(None, alias="X-Bot-Token")) -> None:
    """
    Guard bot-only endpoints. Caller must provide X-Bot-Token matching BOT_INTERNAL_TOKEN.
    """
    if not bot_token or bot_token != BOT_INTERNAL_TOKEN:
        raise HTTPException(403, "Bot token invalid.")


def _resolve_signature_and_index(
    target_signature_raw: Optional[str],
    parsed_target_index: Optional[int],
    canonical_targets: List[Dict],
    request_id: Optional[str] = None,
) -> tuple[Dict, int, str]:
    """
    Resolve the target entry from signature (preferred) or index.
    If both are provided and disagree, raise 400 so guesses cannot be misrouted.
    """
    signature_to_entry = {entry["signature"]: entry for entry in canonical_targets}
    index_to_entry = {entry["target_index"]: entry for entry in canonical_targets}

    if target_signature_raw:
        entry = signature_to_entry.get(target_signature_raw)
        if not entry:
            raise HTTPException(400, detail=f"Unknown target_signature {target_signature_raw}.")
        resolved_index = entry["target_index"]
        if parsed_target_index is not None and resolved_index != parsed_target_index:
            print(
                "DEBUG_SIGNATURE_INDEX_MISMATCH",
                {
                    "resolved_index": resolved_index,
                    "parsed_target_index": parsed_target_index,
                    "target_signature": target_signature_raw,
                    "request_id": request_id,
                },
            )
            raise HTTPException(
                400,
                detail=(
                    f"target_signature maps to target_index {resolved_index} "
                    f"but request provided {parsed_target_index}."
                ),
            )
        return entry, resolved_index, target_signature_raw

    if parsed_target_index is None:
        raise HTTPException(400, "target_index must be provided when target_signature is missing.")

    entry = index_to_entry.get(parsed_target_index)
    if not entry:
        raise HTTPException(400, detail=f"Unknown target_index {parsed_target_index}.")
    return entry, parsed_target_index, entry["signature"]


def _get_or_create_bot_user(session: Session) -> User:
    """Return the singleton bot user (api_key == BOT_INTERNAL_TOKEN), creating it if missing."""
    bot = session.exec(select(User).where(User.api_key == BOT_INTERNAL_TOKEN)).first()
    if bot:
        return bot
    bot = User(username="CROS_BOT", password_hash="!", api_key=BOT_INTERNAL_TOKEN)
    session.add(bot)
    session.commit()
    session.refresh(bot)
    return bot


def _choose_bot_guess(target_len: int, word_list: List[str]) -> str:
    """Pick a bot guess matching the target length; fallback to padded A's."""
    filtered = [w for w in word_list if len(w) == target_len]
    if not filtered:
        return ("A" * max(target_len, 1)) or "A"
    return random.choice(filtered)


def _filter_candidates_with_feedback(candidates: List[str], guess: str, codes: List[str]) -> List[str]:
    """
    Very simple eliminator: keep only candidates that would yield the same codes for the given guess.
    This lets the bot get a bit smarter across turns.
    """
    guess = guess.upper()
    # Interpret BLUE the same as RED for the current target (letter belongs to other word).
    mapped_codes = [(c or "").upper() for c in codes]
    mapped_codes = ["R" if c == "B" else c for c in mapped_codes]
    out: List[str] = []
    for cand in candidates:
        if len(cand) != len(guess):
            continue
        try:
            feedback = score_guess(guess, cand)
        except ValueError:
            continue
        if feedback == mapped_codes:
            out.append(cand)
    return out or candidates


def _exclude_guessed(candidates: List[str], prior_guesses: List[str]) -> List[str]:
    """Remove words the bot already guessed for this target to avoid repeats."""
    prior_set = {g.upper() for g in prior_guesses}
    remaining = [c for c in candidates if c.upper() not in prior_set]
    return remaining or candidates


def _candidate_pool_for_length(length_value: int, slot: str = DEFAULT_TARGET_SLOT) -> List[str]:
    """
    Return a dictionary-based candidate pool for a given length (4-6). If dictionary missing or empty,
    fall back to BOT_DEFAULT_WORDS filtered by length, or padded A's.
    """
    if length_value not in (4, 5, 6):
        return []
    try:
        twl_words = twl.get_words_by_length(length_value, slot)
    except Exception:
        twl_words = []
    pool = [w.upper() for w in twl_words if w] or [w.strip().upper() for w in BOT_DEFAULT_WORDS.split(",") if len(w.strip()) == length_value]
    if not pool:
        pool = [("A" * length_value)]
    return pool


def _parse_feedback_codes(guess: Guess) -> List[str]:
    """Pull uppercase feedback codes from a Guess row; safe against bad JSON."""
    try:
        payload = json.loads(guess.feedback_json) or {}
        codes = payload.get("codes") or []
        return [str(c or "").upper() for c in codes]
    except Exception:
        return []


def _is_target_solved(guess: Guess, opp_words: List[str]) -> bool:
    """
    True if this guess hit all GREEN for its target word.
    We compare code length to the real target length so partial rows don't count.
    """
    if guess.target_word_index < 0 or guess.target_word_index >= len(opp_words):
        return False
    target_len = len(opp_words[guess.target_word_index])
    codes = _parse_feedback_codes(guess)
    return bool(codes) and len(codes) == target_len and all(code == "G" for code in codes)


def _choose_target_index_for_bot(opp_words: List[str], prior_bot_guesses: List[Guess]) -> int:
    """
    Stay on the last unsolved target until it is fully greened out.
    After a solve, pick another unsolved slot (or 0 as a safe fallback).
    """
    if not opp_words:
        return 0

    solved_indices = {
        g.target_word_index for g in prior_bot_guesses if _is_target_solved(g, opp_words)
    }

    # Prior list is newest-first (we order by created_at DESC when we fetch it).
    if prior_bot_guesses:
        last_target = prior_bot_guesses[0].target_word_index
        if last_target not in solved_indices and 0 <= last_target < len(opp_words):
            return last_target

    unsolved = [idx for idx in range(len(opp_words)) if idx not in solved_indices]
    return random.choice(unsolved) if unsolved else 0


def _score_pattern(guess: str, target: str) -> str:
    """Return a compact feedback string for entropy bucketing."""
    return "".join(score_guess(guess, target))


def _choose_best_guess(candidates: List[str], prior_guesses: List[str], difficulty: str) -> str:
    """
    Select a guess tuned to difficulty:
      - easy   : random valid guess (avoids repeats)
      - normal : feedback pruning + small-pool letter frequency (current default)
      - hard   : entropy-ish search over the pool (prunes + samples when large)
    """
    if not candidates:
        return "A"
    difficulty = _normalize_difficulty(difficulty)
    # Avoid repeats
    pool = _exclude_guessed(candidates, prior_guesses)
    if difficulty == "easy":
        return _choose_bot_guess(len(pool[0]), pool)

    # If the pool is small, pick the most likely completion based on positional letter frequency.
    if len(pool) <= 30:
        pos_counts: List[Dict[str, int]] = [dict() for _ in range(len(pool[0]))]
        for word in pool:
            for idx, ch in enumerate(word):
                pos_counts[idx][ch] = pos_counts[idx].get(ch, 0) + 1
        best_word = pool[0]
        best_weight = -1.0
        for word in pool:
            positional_score = sum(pos_counts[idx].get(ch, 0) for idx, ch in enumerate(word))
            letter_bonus = sum(LETTER_FREQUENCY.get(ch.upper(), 0.0) for ch in set(word))
            # Bias toward common letters while still honoring positional frequency.
            weight = (positional_score * 2.0) + letter_bonus
            if weight > best_weight:
                best_weight = weight
                best_word = word
        return best_word

    sample = pool
    if len(pool) > 400:
        sample_size = 200 if difficulty == "hard" else 120
        sample = random.sample(pool, k=sample_size)

    best_guess = sample[0]
    best_score = float("inf")
    total = len(pool)
    for guess in sample:
        buckets: Dict[str, int] = {}
        for cand in pool:
            pattern = _score_pattern(guess, cand)
            buckets[pattern] = buckets.get(pattern, 0) + 1
        expected_remaining = sum(size * size for size in buckets.values()) / total
        if expected_remaining < best_score:
            best_score = expected_remaining
            best_guess = guess
    return best_guess

# ----------------------------- Routes -----------------------------

@router.post("/create", response_model=CreateGameOut)
def create_game(
    data: CreateGameIn | None = Body(default=None),
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    slot_raw = None
    if data is not None and hasattr(data, "dictionary_slot") and data.dictionary_slot is not None:
        slot_raw = str(data.dictionary_slot)
    dictionary_slot = _resolve_and_validate_slot(slot_raw)
    try:
        game = Game(
            status="waiting",
            created_by_id=me.id,
            current_turn_user_id=None,
            start_at=None,
            dictionary_slot=dictionary_slot,
        )
        session.add(game)
        session.flush()
        gp = GamePlayer(
            game_id=game.id,
            user_id=me.id,
            is_player1=True,
            words_submitted=False,
            ready=False,
            letters_solved_count=0,
        )
        session.add(gp)
        session.commit()
        session.refresh(game)
        return CreateGameOut(game_id=game.id)
    except IntegrityError as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"DB error creating game: {getattr(e, 'orig', e)}")

@router.post("/join")
def join_game(data: JoinGameIn, session: Session = Depends(get_session), me: User = Depends(require_user)):
    game = session.get(Game, data.game_id)
    if not game:
        raise HTTPException(404, "Game not found.")
    if len(game.players) >= 2:
        raise HTTPException(400, "Game already has two players.")

    existing = session.exec(
        select(GamePlayer).where(GamePlayer.game_id == game.id, GamePlayer.user_id == me.id)
    ).first()
    if existing:
        raise HTTPException(400, "You are already in this game.")

    gp = GamePlayer(game_id=game.id, user_id=me.id, is_player1=False)
    session.add(gp)
    session.commit()
    return {"ok": True}

@router.post("/{game_id}/bot_join")
def bot_join(
    game_id: int,
    session: Session = Depends(get_session),
    _auth: None = Depends(_require_bot_token),
    mode: str | None = None,
):
    """
    Internal-only: attach a bot as a participant, submit its words, and mark it ready.
    Protected via X-Bot-Token header so players cannot call it.
    Uses bounded retry loop: resample words and retry placement up to BOT_PLACEMENT_MAX_ATTEMPTS.
    """
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found.")
    players = list(game.players or [])
    if len(players) >= 2:
        raise HTTPException(400, "Game already has two players.")

    bot_user = _get_or_create_bot_user(session)
    existing = session.exec(
        select(GamePlayer).where(GamePlayer.game_id == game.id, GamePlayer.user_id == bot_user.id)
    ).first()
    if existing:
        return {"ok": True, "bot_user_id": bot_user.id}

    slot = getattr(game, "dictionary_slot", None) or DEFAULT_TARGET_SLOT
    mode_norm = _normalize_difficulty(mode)

    # Bounded retry: resample words each attempt; placement is pure (no game mutation until success).
    letters = None
    placed = None
    words_upper = None
    for attempt in range(BOT_PLACEMENT_MAX_ATTEMPTS):
        seed = _placement_seed(game.id, slot, mode_norm, attempt)
        words_upper = _default_bot_words_seeded(slot, seed)
        ok, errors = validate_wordset(words_upper)
        if not ok:
            continue
        words_try = list(words_upper)
        rng = random.Random(seed + 1)
        rng.shuffle(words_try)
        letters, placed = auto_place_all_words(words_try)
        if letters and placed:
            break

    if not letters or not placed or not words_upper:
        raise HTTPException(
            400,
            detail={
                "errors": [f"Bot could not place words after {BOT_PLACEMENT_MAX_ATTEMPTS} attempts."],
                "dictionary_slot": slot,
                "mode": mode_norm,
                "attempts": BOT_PLACEMENT_MAX_ATTEMPTS,
            },
        )

    gp = GamePlayer(
        game_id=game.id,
        user_id=bot_user.id,
        is_player1=len(players) == 0,
        words_json=json.dumps({"words": words_upper}),
        words_layout_json=json.dumps({"placed": placed}),
        revealed_coords_json=json.dumps([]),
        words_submitted=True,
        ready=True,
        updated_at=datetime.utcnow(),
    )
    session.add(gp)
    session.commit()

    print(
        "DEBUG_BOT_SUBMITTED_WORDS",
        {
            "game_id": game.id,
            "bot_user_id": bot_user.id,
            "words": words_upper,
            "mode": mode_norm,
            "context": "bot_join",
        },
    )  # TEMP DEBUG: confirm bot wordset sent to server

    game = session.get(Game, game.id)
    _maybe_start_countdown(game, session)
    return {"ok": True, "bot_user_id": bot_user.id}


@router.post("/{game_id}/bot_join_public")
def bot_join_public(
    game_id: int,
    mode: str | None = None,
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    """
    Player-facing helper: when a single player wants a bot opponent.
    Requirements: caller is in the game, game has <2 players.
    """
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found.")

    # Ensure caller is a participant
    _ensure_participant(session, game_id, me)

    players = list(game.players or [])
    if len(players) >= 2:
        raise HTTPException(400, "Game already has two players.")

    bot_user = _get_or_create_bot_user(session)
    existing = session.exec(
        select(GamePlayer).where(GamePlayer.game_id == game.id, GamePlayer.user_id == bot_user.id)
    ).first()
    if existing:
        difficulty = _normalize_difficulty(mode)
        _bot_game_difficulty[game.id] = difficulty
        _bot_expert_games[game.id] = difficulty == "hard"
        return {"ok": True, "bot_user_id": bot_user.id}

    # Reuse the internal join logic (same defaults and placement retry loop)
    result = bot_join(game_id, session=session, _auth=None, mode=mode)
    difficulty = _normalize_difficulty(mode)
    _bot_game_difficulty[game.id] = difficulty
    _bot_expert_games[game.id] = difficulty == "hard"
    return result

@router.post("/{game_id}/submit_words")
def submit_words(
    game_id: int,
    data: SubmitWordsIn,
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    game, gp = _ensure_participant(session, game_id, me)
    gp_opp = _other_player(game, me.id)
    if game.status not in ("waiting",):
        detail = _invalid_state_detail("submit_words", game, gp, gp_opp)
        detail["message"] = f"Cannot submit words when game status is {game.status!r}."
        raise HTTPException(400, detail=detail)
    ok, errors = validate_wordset(data.words)
    if not ok:
        detail = _invalid_state_detail("submit_words", game, gp, gp_opp)
        detail["errors"] = errors
        detail["message"] = "Word validation failed."
        raise HTTPException(400, detail=detail)
    ok_prof, prof_errors = check_profanity(data.words)
    if not ok_prof:
        detail = _invalid_state_detail("submit_words", game, gp, gp_opp)
        detail["errors"] = prof_errors
        detail["message"] = "One or more words are not allowed."
        raise HTTPException(400, detail=detail)

    words_upper = [str(w).strip().upper() for w in data.words]
    gp.words_json = json.dumps({"words": words_upper})

    # Try a few shuffles to reduce placement failures.
    attempts = 0
    letters = placed = None
    words_try = list(words_upper)
    while attempts < 5:
        letters, placed = auto_place_all_words(words_try)
        if letters and placed:
            break
        random.shuffle(words_try)
        attempts += 1
    if not letters or not placed:
        detail = _invalid_state_detail("submit_words", game, gp, gp_opp)
        detail["errors"] = ["Could not auto-place your words on the board. Try different words."]
        detail["message"] = "Placement failed."
        raise HTTPException(400, detail=detail)

    gp.words_layout_json = json.dumps({"placed": placed})
    gp.revealed_coords_json = json.dumps([])
    gp.words_submitted = True
    gp.updated_at = datetime.utcnow()
    session.add(gp)
    session.commit()
    return {"ok": True}

@router.post("/{game_id}/ready")
def mark_ready(game_id: int, session: Session = Depends(get_session), me: User = Depends(require_user)):
    game, gp = _ensure_participant(session, game_id, me)
    gp_opp = _other_player(game, me.id)
    if game.status not in ("waiting", "starting"):
        detail = _invalid_state_detail("ready", game, gp, gp_opp)
        detail["message"] = f"Cannot mark ready when game status is {game.status!r}."
        raise HTTPException(400, detail=detail)
    if not gp.words_submitted:
        detail = _invalid_state_detail("ready", game, gp, gp_opp)
        detail["message"] = "Submit your words before marking Ready."
        raise HTTPException(400, detail=detail)
    if gp.ready:
        return {"ok": True}

    gp.ready = True
    gp.updated_at = datetime.utcnow()
    session.add(gp)
    session.commit()

    # If both players submitted + ready -> start countdown
    game = session.get(Game, game.id)
    players = list(game.players or [])
    if len(players) == 2 and all(p.words_submitted and p.ready for p in players):
        game.status = "starting"
        game.start_at = datetime.utcnow() + timedelta(seconds=COUNTDOWN_SECONDS)
        game.current_turn_user_id = game.created_by_id
        game.updated_at = datetime.utcnow()
        session.add(game)
        session.commit()
    return {"ok": True}

@router.post("/{game_id}/guess")
def make_guess(
    game_id: int,
    data: GuessIn,
    request: Request,
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    """
    Accept a single guess when it's the caller's turn.
    Strictly enforces word length and letters via score_guess, then
    persists Guess row and switches turn to the opponent.
    """
    game, gp_me = _ensure_participant(session, game_id, me)
    if game.status != "active":
        raise HTTPException(400, f"Game not active (status={game.status}).")
    if game.current_turn_user_id != me.id:
        raise HTTPException(403, "Not your turn.")

    gp_opp = _other_player(game, me.id)
    if not gp_opp or not gp_opp.words_submitted:
        raise HTTPException(400, "Opponent words are not ready yet.")

    opp_words = gp_opp.get_words()
    if not opp_words or len(opp_words) != 5:
        raise HTTPException(500, "Opponent words unavailable.")

    layout = gp_opp.get_layout() or []
    canonical_targets = _canonical_targets_from_layout(layout)
    target_lengths = [len(w) for w in opp_words]
    print(
        "DEBUG_GUESS_GAME_IDENTITY",
        {
            "game_id": game.id,
            "object_id": id(game),
            "updated_at": game.updated_at.isoformat() if hasattr(game, "updated_at") else None,
            "turn": game.current_turn_user_id,
            "target_lengths": target_lengths,
            "targets_meta_count": len(canonical_targets),
            "game_version": getattr(game, "version", None),
        },
    )  # TEMP DEBUG: verify guess/state use same game instance

    # ------------------- Field-name robustness -------------------
    # Support both schemas:
    #   - NEW: GuessIn(target_index: int, guess: str)
    #   - OLD: GuessIn(target_word_index: int, guess_word: str)
    try:
        target_index_raw = getattr(data, "target_index")
        guess_text = getattr(data, "guess")
    except Exception:
        target_index_raw = getattr(data, "target_word_index")
        guess_text = getattr(data, "guess_word")
    target_signature_raw = getattr(data, "target_signature", None)

    print(
        "DEBUG_GUESS_REQUEST_RAW",
        {
            "game_id": game_id,
            "target_index": target_index_raw,
            "target_signature": target_signature_raw,
            "target_index_type": str(type(target_index_raw)),
            "guess_repr": repr(guess_text),
            "guess_len_before": len(guess_text) if guess_text else None,
            "request_id": getattr(request.state, "request_id", None),
        },
        flush=True,
    )

    try:
        target_index = int(target_index_raw)
    except Exception:
        print("DEBUG_BAD_TARGET_INDEX", {"target_index": target_index_raw})
        raise HTTPException(400, "target_index must be 0..4.")

    if target_index < 0 or target_index >= 5:
        raise HTTPException(400, "target_index must be 0..4.")

    parsed_target_index = target_index
    resolved_entry, resolved_index, resolved_signature = _resolve_signature_and_index(
        target_signature_raw,
        parsed_target_index,
        canonical_targets,
        request_id=getattr(request.state, "request_id", None),
    )
    target_index = resolved_index

    print(
        "DEBUG_GUESS_RESOLVE",
        {
            "game_id": game_id,
            "user_id": me.id,
            "target_index_raw": target_index_raw,
            "target_index_in": parsed_target_index,
            "target_signature_in": target_signature_raw,
            "resolved_index": resolved_index,
            "resolved_signature": resolved_signature,
            "canonical_target_count": len(canonical_targets),
        },
    )  # TEMP DEBUG: ensure signature -> index mapping stays stable

    # Build layout_words before targeting so we never hit UnboundLocalError when layout is missing.
    layout_words: List[str] = []
    if layout:
        for seg in layout:
            text = (seg.get("text") or "").strip().upper()
            layout_words.append(text)

    target = (
        layout_words[target_index]
        if layout_words and target_index < len(layout_words) and layout_words[target_index]
        else opp_words[target_index]
    )
    other_targets = [
        layout_words[idx] if layout_words and idx < len(layout_words) and layout_words[idx] else w
        for idx, w in enumerate(opp_words)
        if idx != target_index
    ]

    guess = (guess_text or "").strip().upper()

    print(
        "DEBUG_GUESS_HANDLER_PARSED",
        {
            "request_id": getattr(request.state, "request_id", None),
            "game_id": game_id,
            "target_index": target_index,
            "target_index_type": str(type(target_index)),
            "guess_repr": repr(guess_text),
            "guess_len": len(guess_text) if guess_text else None,
        },
        flush=True,
    )

    print(
        "DEBUG_GUESS_HANDLER_NORMALIZED",
        {
            "request_id": getattr(request.state, "request_id", None),
            "game_id": game_id,
            "target_index": target_index,
            "target_index_type": str(type(target_index)),
            "guess_repr": repr(guess),
            "guess_len": len(guess),
        },
        flush=True,
    )

    if not guess.isalpha():
        print(
            "DEBUG_GUESS_VALIDATE_FAIL",
            {
                "request_id": getattr(request.state, "request_id", None),
                "reason": "letters",
                "target_index": target_index,
                "guess_repr": repr(guess),
                "guess_len": len(guess),
                "expected_from_lengths_list": None,
                "expected_from_lengths_by_index": None,
                "expected_from_meta": None,
            },
            flush=True,
        )
        raise HTTPException(
            400,
            detail=f"Letters only. guess_repr={repr(guess)} target_index={target_index} request_id={getattr(request.state, 'request_id', None)}",
        )
    target_lengths = [len(w) for w in layout_words] if layout_words else [len(w) for w in opp_words]
    target_lengths_by_index = {entry["target_index"]: entry["length"] for entry in canonical_targets}
    meta_lengths = {entry["target_index"]: entry["length"] for entry in canonical_targets}
    game_state_summary = {
        "game_id": game_id,
        "target_lengths": target_lengths,
        "targets_meta_count": len(canonical_targets),
        "game_updated_at": game.updated_at.isoformat() if hasattr(game, "updated_at") else None,
    }
    print("DEBUG_GAME_STATE_SUMMARY", game_state_summary)
    expected_from_lengths_list = target_lengths[target_index] if target_index < len(target_lengths) else None
    expected_from_meta = meta_lengths.get(target_index)
    expected_from_lengths_by_index = target_lengths_by_index.get(target_index)
    expected_len = (
        expected_from_meta
        if expected_from_meta is not None
        else expected_from_lengths_by_index
        if expected_from_lengths_by_index is not None
        else expected_from_lengths_list
    )
    expected_from_internal = len(target) if target else None
    if expected_from_lengths_list is not None and expected_from_internal is not None and expected_from_lengths_list != expected_from_internal:
        print(
            "DEBUG_LENGTH_WORD_MISMATCH",
            {
                "target_index": target_index,
                "list_len": expected_from_lengths_list,
                "layout_word_len": expected_from_internal,
                "request_id": getattr(request.state, "request_id", None),
            },
            flush=True,
        )
    print(
        "DEBUG_GUESS_EXPECTED",
        {
            "game_id": game_id,
            "target_index": target_index,
            "expected_from_lengths_list": expected_from_lengths_list,
            "expected_from_meta": expected_from_meta,
            "expected_from_lengths_by_index": expected_from_lengths_by_index,
            "expected_from_internal": expected_from_internal,
            "target_lengths": target_lengths,
            "meta_lengths": meta_lengths,
            "target_lengths_type": str(type(target_lengths)),
            "targets_meta_type": str(type(getattr(game, "targets_meta", None))),
            "request_id": getattr(request.state, "request_id", None),
        },
        flush=True,
    )
    if (
        expected_from_lengths_list is not None
        and expected_from_lengths_by_index is not None
        and expected_from_lengths_list != expected_from_lengths_by_index
    ):
        print(
            "DEBUG_LENGTH_ORDER_MISMATCH",
            {
                "game_id": game_id,
                "target_index": target_index,
                "list_value": expected_from_lengths_list,
                "map_value": expected_from_lengths_by_index,
            },
        )

    if expected_len is None:
        raise HTTPException(400, detail=f"Unknown expected length for target_index {target_index}.")
    if len(guess) != expected_len:
        print(
            "DEBUG_GUESS_VALIDATE_FAIL",
            {
                "request_id": getattr(request.state, "request_id", None),
                "reason": "length",
                "target_index": target_index,
                "expected": expected_len,
                "got": len(guess),
                "guess_repr": repr(guess),
                "expected_from_lengths_list": expected_from_lengths_list,
                "expected_from_lengths_by_index": expected_from_lengths_by_index,
                "expected_from_meta": expected_from_meta,
            },
            flush=True,
        )
        raise HTTPException(
            400,
            detail=(
                f"Length mismatch. target_index={target_index} expected={expected_len} got={len(guess)} "
                f"guess_repr={repr(guess)} request_id={getattr(request.state, 'request_id', None)}"
            ),
        )

    # Enforce dictionary membership so random strings don't count.
    slot = getattr(game, "dictionary_slot", None) or DEFAULT_TARGET_SLOT
    if not twl.is_guess_word(guess):
        raise HTTPException(400, "Guess must be a valid dictionary word from the word list.")

    try:
        codes = score_guess(guess, target, other_targets)  # strict G/Y/R/B
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    logger.info(
        "Guess: game=%s user=%s target_index=%s guess=%s codes=%s",
        game.id,
        me.id,
        target_index,
        guess,
        "".join(codes),
    )

    # Persist the guess + feedback
    g = Guess(
        game_id=game.id,
        guesser_user_id=me.id,
        target_word_index=int(target_index),
        guess_text=guess,
        feedback_json=json.dumps({"codes": codes}),
    )
    session.add(g)
    session.flush()  # make sure the guess is visible for win checks

    # Check win condition: did the player solve all opponent words?
    target_lengths = [len(w) for w in opp_words]
    if _player_solved_all_targets(session, game.id, me.id, target_lengths):
        _finish_game(game, session)
        session.commit()
        return {"ok": True, "codes": codes, "game_status": game.status}

    # Switch turn to opponent
    game.current_turn_user_id = gp_opp.user_id
    game.updated_at = datetime.utcnow()
    session.add(game)
    session.commit()

    # If opponent is the bot and auto-play is enabled, trigger bot move immediately.
    bot_played = _auto_bot_move_if_applicable(game, gp_opp, gp_me, session)
    if not bot_played and gp_opp.user_id == _get_or_create_bot_user(session).id:
        # Safety: if bot could not move, give turn back to the human so play can continue.
        game.current_turn_user_id = gp_me.user_id
        game.updated_at = datetime.utcnow()
        session.add(game)
        session.commit()

    return {"ok": True, "codes": codes}

@router.post("/{game_id}/bot_move")
def bot_move(
    game_id: int,
    session: Session = Depends(get_session),
    _auth: None = Depends(_require_bot_token),
):
    """
    Internal-only: perform a bot guess when it's the bot's turn.
    Strategy: pick a random target slot and a random word from the default list with matching length.
    """
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found.")
    if game.status != "active":
        raise HTTPException(400, f"Game not active (status={game.status}).")

    bot_user = _get_or_create_bot_user(session)
    gp_bot = session.exec(
        select(GamePlayer).where(GamePlayer.game_id == game.id, GamePlayer.user_id == bot_user.id)
    ).first()
    if not gp_bot:
        raise HTTPException(400, "Bot is not a participant in this game. Call /bot_join first.")
    if game.current_turn_user_id != bot_user.id:
        raise HTTPException(400, "Not bot's turn.")

    gp_opp = _other_player(game, bot_user.id)
    if not gp_opp or not gp_opp.words_submitted:
        raise HTTPException(400, "Opponent words are not ready yet.")

    opp_words = gp_opp.get_words()
    if not opp_words or len(opp_words) != 5:
        raise HTTPException(500, "Opponent words unavailable.")

    # Fetch history newest-first so we can stick to the last unsolved slot.
    prior_bot_guesses = session.exec(
        select(Guess)
        .where(Guess.game_id == game.id, Guess.guesser_user_id == bot_user.id)
        .order_by(Guess.created_at.desc())
    ).all()

    target_index = _choose_target_index_for_bot(opp_words, prior_bot_guesses)
    target_word = opp_words[target_index]
    human_layout = opp_player.get_layout() or []
    human_targets = _canonical_targets_from_layout(human_layout)
    human_entry = next((entry for entry in human_targets if entry["target_index"] == target_index), None)
    human_signature = human_entry["signature"] if human_entry else None
    human_length = human_entry["length"] if human_entry else len(target_word)
    print(
        "BOT_TARGET_CHOICE",
        {
            "game_id": game.id,
            "target_index": target_index,
            "signature": human_signature,
            "length": human_length,
            "context": "auto_move",
        },
    )  # TEMP DEBUG: ensure auto bot move targets same slot signature
    layout = gp_opp.get_layout() or []
    canonical_targets = _canonical_targets_from_layout(layout)
    target_entry = next((entry for entry in canonical_targets if entry["target_index"] == target_index), None)
    target_signature = target_entry["signature"] if target_entry else None
    target_length = target_entry["length"] if target_entry else len(target_word)
    print(
        "BOT_TARGET_CHOICE",
        {
            "game_id": game.id,
            "target_index": target_index,
            "signature": target_signature,
            "length": target_length,
            "context": "bot_move",
        },
    )  # TEMP DEBUG: tie bot target_index back to canonical signature
    slot = getattr(game, "dictionary_slot", None) or DEFAULT_TARGET_SLOT
    bot_word_list = _candidate_pool_for_length(len(target_word), slot)
    prior_for_target = [p for p in prior_bot_guesses if p.target_word_index == target_index]
    prior_guessed_words = [p.guess_text for p in prior_for_target]
    candidates = [w for w in bot_word_list if len(w) == len(target_word)] or [target_word]
    for past in prior_for_target:
        try:
            payload = json.loads(past.feedback_json) or {}
            codes = payload.get("codes") or []
        except Exception:
            codes = []
        if codes:
            candidates = _filter_candidates_with_feedback(candidates, past.guess_text, codes)
    candidates = _exclude_guessed(candidates, prior_guessed_words)
    difficulty = _get_bot_difficulty(game.id)
    guess_word = _choose_best_guess(candidates, prior_guessed_words, difficulty)

    try:
        codes = score_guess(guess_word, target_word, [w for idx, w in enumerate(opp_words) if idx != target_index])
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    g = Guess(
        game_id=game.id,
        guesser_user_id=bot_user.id,
        target_word_index=int(target_index),
        guess_text=guess_word,
        feedback_json=json.dumps({"codes": codes}),
    )
    session.add(g)
    session.flush()

    # If bot just solved all targets, finish game and stop handing back the turn.
    target_lengths = [len(w) for w in opp_words]
    if _player_solved_all_targets(session, game.id, bot_user.id, target_lengths):
        _finish_game(game, session)
        session.commit()
        return {"ok": True, "codes": codes, "guess": guess_word, "target_index": target_index, "game_status": game.status}

    game.current_turn_user_id = gp_opp.user_id
    game.updated_at = datetime.utcnow()
    session.add(game)
    session.commit()

    return {"ok": True, "codes": codes, "guess": guess_word, "target_index": target_index}

def _auto_bot_move_if_applicable(game: Game, gp_opp: GamePlayer, gp_me: GamePlayer, session: Session) -> bool:
    """
    Internal helper: if the opponent is the bot and auto-play is enabled, take a bot turn immediately.
    gp_opp here is the opponent of the player who just guessed; if that opponent is the bot, we trigger.
    Returns True when a bot move was made; False otherwise.
    """
    if not BOT_AUTO_PLAY:
        return False
    bot_user = _get_or_create_bot_user(session)
    if not gp_opp or gp_opp.user_id != bot_user.id:
        return False

    # Cap total bot moves to avoid runaway loops
    bot_move_count = len(
        session.exec(select(Guess).where(Guess.game_id == game.id, Guess.guesser_user_id == bot_user.id)).all()
    )
    if bot_move_count >= BOT_MAX_MOVES:
        logger.info("Bot auto-play halted: move cap reached for game %s", game.id)
        return False

    # Prepare inputs to mirror bot_move endpoint
    opp_player = _other_player(game, bot_user.id)
    if not opp_player or not opp_player.words_submitted:
        return False

    opp_words = opp_player.get_words()
    if not opp_words or len(opp_words) != 5:
        return False

    prior_bot_guesses = session.exec(
        select(Guess)
        .where(Guess.game_id == game.id, Guess.guesser_user_id == bot_user.id)
        .order_by(Guess.created_at.desc())
    ).all()

    target_index = _choose_target_index_for_bot(opp_words, prior_bot_guesses)
    target_word = opp_words[target_index]
    slot = getattr(game, "dictionary_slot", None) or DEFAULT_TARGET_SLOT
    bot_word_list = _candidate_pool_for_length(len(target_word), slot)

    # basic feedback-aware pruning: use opponent history (bot vs human words) to filter bot candidates
    prior_for_target = [p for p in prior_bot_guesses if p.target_word_index == target_index]
    prior_guessed_words = [p.guess_text for p in prior_for_target]
    candidates = [w for w in bot_word_list if len(w) == len(target_word)] or [target_word]
    for past in prior_for_target:
        try:
            payload = json.loads(past.feedback_json) or {}
            codes = payload.get("codes") or []
        except Exception:
            codes = []
        if codes:
            candidates = _filter_candidates_with_feedback(candidates, past.guess_text, codes)
    candidates = _exclude_guessed(candidates, prior_guessed_words)

    difficulty = _get_bot_difficulty(game.id)
    guess_word = _choose_best_guess(candidates, prior_guessed_words, difficulty)
    logger.info(
        "Bot auto-move: game=%s target=%s guess=%s candidates=%s",
        game.id,
        target_index,
        guess_word,
        len(candidates),
    )

    try:
        codes = score_guess(guess_word, target_word, [w for idx, w in enumerate(opp_words) if idx != target_index])
    except Exception:
        return False

    g = Guess(
        game_id=game.id,
        guesser_user_id=bot_user.id,
        target_word_index=int(target_index),
        guess_text=guess_word,
        feedback_json=json.dumps({"codes": codes}),
    )
    session.add(g)
    session.flush()

    # If bot solved all targets, finish game and keep status final.
    target_lengths = [len(w) for w in opp_words]
    if _player_solved_all_targets(session, game.id, bot_user.id, target_lengths):
        try:
            _finish_game(game, session)
            session.commit()
            return True
        except Exception:
            session.rollback()
            return False

    # hand turn back to human
    try:
        game.current_turn_user_id = opp_player.user_id
        game.updated_at = datetime.utcnow()
        session.add(game)
        session.commit()
        return True
    except Exception:
        session.rollback()
        return False

@router.get("/{game_id}/state", response_model=GameStateOut)
def game_state(game_id: int, session: Session = Depends(get_session), me: User = Depends(require_user)):
    """
    Safe, per-caller state:
      - current status / countdown / whose turn
      - masked opponent board + your revealed (green) coords
      - your clue history (flat + grouped)
      - progress counters (you vs opponent)
      - solved flags (per target word)
    """
    game, gp_me = _ensure_participant(session, game_id, me)
    _maybe_flip_to_active(game, session)

    gp_opp = _other_player(game, me.id)
    bot_user = _get_or_create_bot_user(session)
    opponent_is_bot = bool(gp_opp and gp_opp.user_id == bot_user.id)

    # My history and progress
    my_hist = _history_for(session, game, me.id)
    your_progress = _progress_unique_greens(my_hist)

    # Opponent history and progress (against my words)
    opp_hist = _history_for(session, game, gp_opp.user_id) if gp_opp else []
    opp_progress = _progress_unique_greens(opp_hist)

    # Target lengths + total letters (opponent's words only)
    target_lengths = _safe_target_lengths(gp_opp)
    total_letters = sum(target_lengths) if target_lengths else 0

    if gp_opp:
        layout = gp_opp.get_layout() or []
    else:
        layout = []
        print(
            "DEBUG_STATE_NO_OPPONENT_PLAYER",
            {"game_id": game_id},
        )  # TEMP DEBUG: opponent missing before match ready
    canonical_targets = _canonical_targets_from_layout(layout)
    # Masked board + revealed greens for me
    masked = _masked_layout_for(gp_opp, layout)
    revealed = _revealed_coords_from_history(my_hist, gp_opp)
    targets_meta = [
        TargetMetaOut(
            target_index=entry["target_index"],
            length=entry["length"],
            start=[entry["start_row"], entry["start_col"]],
            dir=entry["dir"],
            coords=entry["coords"],
        )
        for entry in canonical_targets
    ]
    print(
        "DEBUG_TARGET_LIST",
        {
            "game_id": game_id,
            "requester_user_id": me.id,
            "requester_role": "bot" if me.id == bot_user.id else "player",
            "target_count": len(canonical_targets),
            "targets": [
                {
                    "target_index": entry["target_index"],
                    "dir": entry["dir"],
                    "signature": entry["signature"],
                    "length": entry["length"],
                    "coords": entry["coords"],
                }
                for entry in canonical_targets
            ],
        },
    )  # TEMP DEBUG: canonical target ordering for UI / bot alignment

    # Build me and opponent as top-level only (no nested me.opponent).
    me_summary = PlayerStateSummary(
        user_id=gp_me.user_id,
        words_submitted=bool(gp_me.words_submitted),
        ready=bool(gp_me.ready),
    )
    opp_summary = (
        PlayerStateSummary(
            user_id=gp_opp.user_id,
            words_submitted=bool(gp_opp.words_submitted),
            ready=bool(gp_opp.ready),
        )
        if gp_opp
        else None
    )

    # -------- NEW: Grouped history + solved flags ----------
    your_history_grouped: Dict[int, List[GuessEntryOut]] = {}
    for entry in my_hist:
        your_history_grouped.setdefault(entry.target_index, []).append(entry)

    your_solved = [False, False, False, False, False]
    for idx in range(min(5, len(target_lengths or []))):
        entries = your_history_grouped.get(idx, [])
        # Safety: ensure "all green" means codes length equals target length and all are 'G'
        tlen = target_lengths[idx] if idx < len(target_lengths) else None
        solved = any(
            (len(e.codes) == (tlen or len(e.codes))) and all(code == "G" for code in e.codes)
            for e in entries
        )
        your_solved[idx] = bool(solved)

    debug_bot_words: List[str] | None = None
    debug_solution_words: List[str] | None = None
    target_words: List[str] | None = None
    if gp_opp and gp_opp.words_submitted:
        opp_words = gp_opp.get_words()
        if opp_words:
            target_words = opp_words
    if DEBUG_REVEAL_SOLUTIONS and opponent_is_bot and gp_opp and gp_opp.words_submitted:
        words = gp_opp.get_words()
        if words:
            debug_bot_words = words
            debug_solution_words = words

    print(
        "DEBUG_STATE_GAME_IDENTITY",
        {
            "game_id": game.id,
            "object_id": id(game),
            "updated_at": game.updated_at.isoformat() if hasattr(game, "updated_at") else None,
            "turn": game.current_turn_user_id,
            "target_lengths": target_lengths,
            "targets_meta_count": len(targets_meta),
            "game_version": getattr(game, "version", None),
        },
    )  # TEMP DEBUG: confirm /state and /guess see same Game object
    return GameStateOut(
        game_id=game.id,
        status=game.status,
        start_at=game.start_at,
        current_turn_user_id=game.current_turn_user_id,
        me=me_summary,
        opponent=opp_summary,
        your_progress_letters=your_progress,
        opponent_progress_letters=opp_progress,
        total_letters=total_letters,
        your_history=my_hist,
        opponent_history=opp_hist,
        opponent_is_bot=opponent_is_bot,
        target_lengths=target_lengths,
        opponent_masked=[MaskedSegmentOut(**m) for m in masked],
        revealed_coords=revealed,
        # NEW polish fields:
        your_history_grouped=your_history_grouped,
        your_solved=your_solved,
        dictionary_slot=getattr(game, "dictionary_slot", None) or DEFAULT_TARGET_SLOT,
        debug_bot_words=debug_bot_words,
        debug_solution_words=debug_solution_words,
        targets_meta=targets_meta,
        target_words=target_words,
        dictionary_version=_dictionary_version(getattr(game, "dictionary_slot", None) or DEFAULT_TARGET_SLOT),
        target_seed=None,
    )
# ===================== END OF FILE =====================
