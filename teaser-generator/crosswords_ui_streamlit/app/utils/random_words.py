# app/utils/random_words.py
# -----------------------------------------------------------------------------
# Random TWL wordset picker backed by the shared NASPA dictionary + placement
# rules. Builds cached buckets for lengths 4-8 so we can support new difficulty
# modes without reprocessing the file.
# -----------------------------------------------------------------------------
from __future__ import annotations

import random
from typing import Dict, List, Optional, Tuple

try:
    from ..game_logic.placement import auto_place_all_words
except ImportError:
    from game_logic.placement import auto_place_all_words

try:
    from crosswords_server.app.services import twl as server_twl  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - standalone UI fallback
    import sys
    from pathlib import Path as _Path

    server_twl = None
    current = _Path(__file__).resolve()
    repo_root = None
    for parent in current.parents:
        if (parent / 'crosswords_server').exists():
            repo_root = parent
            break
    if repo_root:
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))
        try:
            from crosswords_server.app.services import twl as server_twl  # type: ignore
        except ModuleNotFoundError:
            server_twl = None

_PRIMARY_LENGTHS: Tuple[int, ...] = (4, 5, 6)
_EXTENDED_LENGTHS: Tuple[int, ...] = (4, 5, 6, 7, 8)

_BUCKET_CACHE: Dict[int, List[str]] | None = None
_LETTER_INDEX: Dict[int, Dict[str, List[str]]] = {}
_ANCHOR_POOL: List[str] | None = None
_LAST_PLACEMENT: Optional[Tuple[Dict[tuple[int, int], str], List[dict]]] = None
_SOURCE_CACHE_TOKEN: Optional[int] = None


class RandomWordsetError(RuntimeError):
    """Raised when we cannot produce a valid random word set."""


def reset_random_word_cache() -> None:
    """Clear cached buckets and placement snapshots (used by tests)."""
    global _BUCKET_CACHE, _LETTER_INDEX, _ANCHOR_POOL, _LAST_PLACEMENT, _SOURCE_CACHE_TOKEN
    _BUCKET_CACHE = None
    _LETTER_INDEX = {}
    _ANCHOR_POOL = None
    _LAST_PLACEMENT = None
    _SOURCE_CACHE_TOKEN = None


def _ensure_sources() -> None:
    global _BUCKET_CACHE, _LETTER_INDEX, _ANCHOR_POOL, _SOURCE_CACHE_TOKEN
    token = id(server_twl)
    if _SOURCE_CACHE_TOKEN is not None and token != _SOURCE_CACHE_TOKEN:
        reset_random_word_cache()
    if _BUCKET_CACHE is not None:
        return
    if server_twl is None:
        raise RandomWordsetError(
            "TWL services module unavailable. Ensure crosswords_server is on PYTHONPATH before using random words."
        )

    buckets = server_twl.get_length_buckets(_EXTENDED_LENGTHS)
    missing = [length for length in _PRIMARY_LENGTHS if not buckets.get(length)]
    if missing:
        raise RandomWordsetError(
            "TWL dictionary missing required lengths: " + ", ".join(str(m) for m in missing)
        )

    _BUCKET_CACHE = {length: list(words) for length, words in buckets.items()}
    for words in _BUCKET_CACHE.values():
        random.shuffle(words)

    requirements = ((4, 2), (5, 2), (6, 1))
    for length, need in requirements:
        if len(_BUCKET_CACHE.get(length, ())) < need:
            raise RandomWordsetError(
                f"TWL dictionary does not contain enough {length}-letter words (need {need})."
            )

    _LETTER_INDEX = {length: {} for length in _PRIMARY_LENGTHS}
    for length in _PRIMARY_LENGTHS:
        for word in _BUCKET_CACHE[length]:
            for letter in set(word):
                bucket = _LETTER_INDEX[length].setdefault(letter, [])
                bucket.append(word)
        for candidates in _LETTER_INDEX[length].values():
            random.shuffle(candidates)

    anchor_letters: List[str] = []
    for letter, six_words in _LETTER_INDEX[6].items():
        if len(six_words) < 1:
            continue
        if len(_LETTER_INDEX[5].get(letter, ())) < 2:
            continue
        if len(_LETTER_INDEX[4].get(letter, ())) < 2:
            continue
        weight = len(six_words)
        anchor_letters.extend([letter] * max(1, weight))

    if not anchor_letters:
        anchor_letters = list(_LETTER_INDEX[6].keys())

    _ANCHOR_POOL = anchor_letters
    _SOURCE_CACHE_TOKEN = token


def _sample_with_anchor(letter: str) -> Optional[List[str]]:
    assert _BUCKET_CACHE is not None
    try:
        six_word = random.choice(_LETTER_INDEX[6][letter])
    except (KeyError, IndexError):
        return None

    candidate: List[str] = [six_word]
    used = {six_word}
    for length, need in ((5, 2), (4, 2)):
        options = _LETTER_INDEX[length].get(letter, [])
        options = [w for w in options if w not in used]
        if len(options) < need:
            return None
        picks = random.sample(options, need)
        candidate.extend(picks)
        used.update(picks)

    random.shuffle(candidate)
    return candidate


def _sample_uniform() -> List[str]:
    assert _BUCKET_CACHE is not None
    candidate: List[str] = []
    for length, need in ((4, 2), (5, 2), (6, 1)):
        candidate.extend(random.sample(_BUCKET_CACHE[length], need))
    random.shuffle(candidate)
    return candidate


def _shared_letter_score(words: List[str]) -> int:
    shared = set(words[0]) if words else set()
    for word in words[1:]:
        shared &= set(word)
    return len(shared)


def _placeable(words: List[str]) -> bool:
    global _LAST_PLACEMENT
    result = auto_place_all_words(words)
    if not result:
        return False
    letters, placed = result
    if not letters or not placed:
        return False
    _LAST_PLACEMENT = (letters, placed)
    return True


def get_last_placement() -> Optional[Tuple[Dict[tuple[int, int], str], List[dict]]]:
    """Expose the last successful placement for debugging/display."""
    return _LAST_PLACEMENT


def pick_random_wordset_from_twl(
    require_placeable: bool = True,
    max_attempts: int = 2000,
) -> List[str]:
    _ensure_sources()
    assert _BUCKET_CACHE is not None

    best_candidate: List[str] | None = None
    best_score = -1

    for _ in range(max_attempts):
        candidate: Optional[List[str]] = None
        if _ANCHOR_POOL:
            letter = random.choice(_ANCHOR_POOL)
            candidate = _sample_with_anchor(letter)
        if not candidate:
            candidate = _sample_uniform()

        if not require_placeable:
            return candidate

        score = _shared_letter_score(candidate)
        if score > best_score:
            best_candidate = candidate
            best_score = score

        if score == 0:
            continue

        if _placeable(candidate):
            return candidate

    if not require_placeable:
        return best_candidate or []

    raise RandomWordsetError(
        "Could not produce a placeable NASPA word set after "
        f"{max_attempts} attempts. Best shared-letter score: {best_score}; "
        f"best candidate: {best_candidate or []}"
    )


def pick_random_valid_wordset() -> List[str]:
    """Backward compat helper used by older UI code."""
    return pick_random_wordset_from_twl(require_placeable=True, max_attempts=2000)
