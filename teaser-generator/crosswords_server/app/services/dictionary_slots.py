"""Dictionary slot definitions and path mapping for server gameplay.

Server policy:
- target selection uses the game's selected tier
- guess validation always uses canon
- legacy names remain accepted as aliases
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = REPO_ROOT / "data"


class DictionarySlot(str, Enum):
    """Accepted dictionary ids for server requests and persisted games."""

    CORE = "CORE"
    STANDARD = "STANDARD"
    ADVANCED = "ADVANCED"
    CANON = "CANON"
    COMMON = "COMMON"
    MODIFIED = "MODIFIED"
    TWL = "TWL"
    A = "A"
    B = "B"
    C = "C"


CANONICAL_SLOT_PATHS: dict[str, Path] = {
    "CORE": DATA_ROOT / "tier_core_4_6.json",
    "STANDARD": DATA_ROOT / "tier_standard_4_6.json",
    "ADVANCED": DATA_ROOT / "tier_advanced_4_6.json",
    "CANON": DATA_ROOT / "tier_canon_4_6.json",
}

SLOT_ALIASES: dict[str, str] = {
    "COMMON": "CORE",
    "MODIFIED": "STANDARD",
    "TWL": "CANON",
}

DISABLED_SLOTS: set[str] = {"A", "B", "C"}
DEFAULT_TARGET_SLOT = "STANDARD"
GUESS_VALIDATION_SLOT = "CANON"


def normalize_slot_name(slot_value: str | None) -> str:
    """Normalize a raw slot/id value to a canonical enabled slot name."""
    raw = (slot_value or DEFAULT_TARGET_SLOT).strip().upper()
    if raw in SLOT_ALIASES:
        return SLOT_ALIASES[raw]
    return raw


def is_known_slot(slot_value: str | None) -> bool:
    """Return True when the value is a known canonical, alias, or legacy slot."""
    raw = (slot_value or DEFAULT_TARGET_SLOT).strip().upper()
    return raw in {slot.value for slot in DictionarySlot}


def is_slot_enabled(slot_value: DictionarySlot | str) -> bool:
    """Return True when the slot resolves to an enabled canonical path."""
    raw = slot_value.value if isinstance(slot_value, DictionarySlot) else str(slot_value)
    canonical = normalize_slot_name(raw)
    if canonical in DISABLED_SLOTS:
        return False
    path = CANONICAL_SLOT_PATHS.get(canonical)
    return path is not None and path.exists()


def get_slot_path(slot_value: DictionarySlot | str) -> Path | None:
    """Return the canonical path for the given slot or alias."""
    raw = slot_value.value if isinstance(slot_value, DictionarySlot) else str(slot_value)
    canonical = normalize_slot_name(raw)
    return CANONICAL_SLOT_PATHS.get(canonical)
