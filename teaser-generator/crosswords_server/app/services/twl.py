"""Dictionary loader and helpers.

Module name `twl` is kept for backward compatibility with older imports.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from .dictionary_slots import (
    DEFAULT_TARGET_SLOT,
    GUESS_VALIDATION_SLOT,
    get_slot_path,
    normalize_slot_name,
)

ALLOW_ANY_WORD = False  # set to True to bypass dictionary check during early dev
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_PATH = REPO_ROOT / "data" / "tier_standard_4_6.json"
DATA_PATH = DEFAULT_DATA_PATH
DEFAULT_BUCKET_LENGTHS: Tuple[int, ...] = (4, 5, 6, 7, 8)


def _normalize_lengths(lengths: Sequence[int]) -> Tuple[int, ...]:
    """Return a sorted, de-duplicated tuple of positive lengths."""
    unique = {int(length) for length in lengths if int(length) > 0}
    return tuple(sorted(unique))


def _path_for_slot(slot: str) -> Optional[Path]:
    """Resolve the dictionary path for a slot or alias."""
    canonical = normalize_slot_name(slot)
    p = get_slot_path(canonical)
    return p if p and p.exists() else None


@lru_cache(maxsize=4)
def _load_word_set_for_slot(slot: str):
    """Load the word set for a given slot. Cached per slot."""
    if ALLOW_ANY_WORD:
        return set()
    canonical = normalize_slot_name(slot)
    path = _path_for_slot(canonical)
    if path is None or not path.exists():
        if canonical == DEFAULT_TARGET_SLOT:
            print(
                f"[Dictionary] Missing {path or DATA_PATH}. Temporarily allowing any 4-6 letter word. "
                "Set ALLOW_ANY_WORD=True or provide wordlist file to remove this warning."
            )
        return None
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise ValueError(f"Dictionary JSON must be a word array: {path}")
        return {str(item).strip().upper() for item in payload if str(item).strip().isalpha()}
    with path.open("r", encoding="utf-8") as fh:
        return {s.upper() for line in fh if (s := line.strip()) and s.isalpha()}


@lru_cache(maxsize=1)
def _load_word_set():
    """Legacy: load STANDARD word set. Kept for backward compat."""
    return _load_word_set_for_slot(DEFAULT_TARGET_SLOT)


def _ensure_word_set(strict: bool = True) -> set[str]:
    """Return the loaded word set, raising when strict and unavailable."""
    word_set = _load_word_set()
    if word_set is None:
        if strict:
            raise RuntimeError(
                "Word list is unavailable. Provide wordlist file or set ALLOW_ANY_WORD=True "
                "to continue (dev mode only)."
            )
        return set()
    return word_set


@lru_cache(maxsize=1)
def get_word_set():
    """Return the cached word set or None when soft-allow is active."""
    return _load_word_set()


def iter_words() -> Iterable[str]:
    """Yield all words from the word set (empty iterator if none)."""
    word_set = get_word_set()
    if word_set is None:
        return iter(())
    return iter(word_set.copy())


def is_twl_word(word: str, slot: str = DEFAULT_TARGET_SLOT) -> bool:
    """Check whether *word* is present in the selected target dictionary."""
    word = (word or '').strip().upper()
    if not word or not (4 <= len(word) <= 15):
        return False
    word_set = _load_word_set_for_slot(slot)
    if word_set is None:
        return True
    return word in word_set


def is_guess_word(word: str) -> bool:
    """Check guess validity against the canon dictionary regardless of target tier."""
    return is_twl_word(word, GUESS_VALIDATION_SLOT)


def _ensure_word_set_for_slot(slot: str, strict: bool = True) -> set:
    """Return the word set for slot, raising when strict and unavailable."""
    word_set = _load_word_set_for_slot(slot)
    if word_set is None:
        if strict:
            raise RuntimeError(
                "Word list is unavailable. Provide wordlist file or set ALLOW_ANY_WORD=True "
                "to continue (dev mode only)."
            )
        return set()
    return word_set


@lru_cache(maxsize=None)
def _cached_length_buckets(
    lengths: Tuple[int, ...],
    slot: str = DEFAULT_TARGET_SLOT,
) -> Tuple[Tuple[int, Tuple[str, ...]], ...]:
    """Internal cached builder that returns hashable bucket data per slot."""
    word_set = _ensure_word_set_for_slot(slot, strict=True)
    buckets: Dict[int, List[str]] = {length: [] for length in lengths}
    for word in word_set:
        if not word.isalpha():
            continue
        L = len(word)
        if L in buckets:
            buckets[L].append(word)
    for length in lengths:
        buckets[length].sort()
    return tuple((length, tuple(buckets[length])) for length in lengths)


def get_length_buckets(
    lengths: Sequence[int] = DEFAULT_BUCKET_LENGTHS,
    slot: str = DEFAULT_TARGET_SLOT,
) -> Dict[int, List[str]]:
    """Return a mapping of word length -> dictionary words of that length for the slot."""
    normalized = _normalize_lengths(lengths)
    if not normalized:
        return {}
    cached = dict(_cached_length_buckets(normalized, slot))
    return {length: list(cached.get(length, ())) for length in normalized}


def get_words_by_length(length_value: int, slot: str = DEFAULT_TARGET_SLOT) -> List[str]:
    """Convenience helper returning the dictionary words of a single length for the slot."""
    length_tuple = _normalize_lengths([length_value])
    if not length_tuple:
        return []
    buckets = dict(_cached_length_buckets(length_tuple, slot))
    return list(buckets.get(length_tuple[0], ()))


def export_length_buckets(
    dest_dir: str | Path | None = None,
    lengths: Sequence[int] = DEFAULT_BUCKET_LENGTHS,
    slot: str = DEFAULT_TARGET_SLOT,
) -> Dict[int, Path]:
    """Write length bucket JSON files to *dest_dir* and return their paths."""
    normalized = _normalize_lengths(lengths)
    if not normalized:
        return {}
    buckets = dict(_cached_length_buckets(normalized, slot))
    destination = Path(dest_dir) if dest_dir is not None else DATA_PATH.parent
    destination.mkdir(parents=True, exist_ok=True)
    written: Dict[int, Path] = {}
    for length in normalized:
        data = {
            "length": length,
            "word_count": len(buckets.get(length, ())),
            "words": list(buckets.get(length, ())),
        }
        out_path = destination / f"wordlist_len{length}.json"
        out_path.write_text(json.dumps(data), encoding='utf-8')
        written[length] = out_path
    return written


# Convenience: eagerly build default buckets when the module is imported in strict mode.
try:
    _cached_length_buckets(DEFAULT_BUCKET_LENGTHS, DEFAULT_TARGET_SLOT)
except RuntimeError:
    # Keep lazy behaviour when the dictionary is absent; callers can handle it explicitly.
    pass
