"""Server-side scoring helpers."""

from __future__ import annotations

import re
from collections import Counter
from typing import List, Iterable


def score_guess(guess: str, target: str, other_targets: Iterable[str] | None = None) -> List[str]:
    """Return feedback codes for *guess* vs *target* with cross-word awareness.

    Codes:
        'G' = correct letter in the correct position
        'Y' = letter exists in the target but a different position (count aware)
        'R' = letter not in the target or no remaining count
        'B' = letter not in this word but present in another opponent word

    Both inputs accept arbitrary characters but only A-Z letters are considered.
    Raises ValueError when either word is missing or the cleaned lengths differ.
    """

    clean = lambda s: re.sub(r"[^A-Za-z]", "", (s or "")).upper()
    g = clean(guess)
    t = clean(target)
    others_clean = [clean(w) for w in (other_targets or []) if clean(w)]

    if not g or not t or len(g) != len(t):
        raise ValueError("Guess length must match target length; letters only.")

    result: List[str] = ["R"] * len(g)
    remaining = Counter(t)
    other_counts = Counter("".join(others_clean)) if others_clean else Counter()

    for i, ch in enumerate(g):
        if ch == t[i]:
            result[i] = "G"
            remaining[ch] -= 1

    for i, ch in enumerate(g):
        if result[i] == "G":
            continue
        if remaining.get(ch, 0) > 0:
            result[i] = "Y"
            remaining[ch] -= 1
            continue
        if other_counts.get(ch, 0) > 0:
            # Mark BLUE to show the letter lives in a different opponent word.
            result[i] = "B"
            other_counts[ch] -= 1
            continue
        result[i] = "R"

    return result
