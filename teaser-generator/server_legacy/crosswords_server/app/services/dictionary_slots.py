"""Dictionary slot definitions and path mapping. STANDARD enabled; A/B/C disabled."""

from __future__ import annotations

from enum import Enum
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EOWL_PATH = REPO_ROOT / "data" / "wordlist_EOWL_mod.txt"


class DictionarySlot(str, Enum):
    STANDARD = "STANDARD"
    A = "A"
    B = "B"
    C = "C"


# Slot -> path mapping. Only STANDARD is enabled; A/B/C are placeholders.
SLOT_PATHS: dict[DictionarySlot, Path | None] = {
    DictionarySlot.STANDARD: EOWL_PATH,
    DictionarySlot.A: None,  # disabled
    DictionarySlot.B: None,  # disabled
    DictionarySlot.C: None,  # disabled
}


def is_slot_enabled(slot: DictionarySlot) -> bool:
    """Return True if the slot has a valid path and file exists."""
    path = SLOT_PATHS.get(slot)
    return path is not None and path.exists()


def get_slot_path(slot: DictionarySlot) -> Path | None:
    """Return the wordlist path for the slot, or None if disabled."""
    return SLOT_PATHS.get(slot)
