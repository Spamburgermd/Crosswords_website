"""Server-side scoring helpers."""

from __future__ import annotations

import re
from collections import Counter
from typing import List, Iterable


def score_guess(guess: str, target: str, other_targets: Iterable[str] | None = None) -> List[str]:
    """Return feedback codes for *guess* vs *target* with cross-word awareness.

    Smart-blue rules (server-side, count-aware):
      1) GREEN and YELLOW are calculated per Wordle semantics against the target word,
         with duplicate handling via remaining letter counts.
      2) Build a GLOBAL pool = multiset of all letters across every target word
         (this target + other_targets). After GREEN/YELLOW consume counts,
         remaining positions are BLUE if the letter still exists in the global pool;
         otherwise RED. BLUE consumption also decrements the global pool so a letter
         cannot be marked blue more times than it exists globally.
      3) GREEN and YELLOW also decrement the global pool so blues shrink as letters
         get confirmed elsewhere. This keeps “smart blue” hints honest.

    Codes:
        'G' = correct letter in the correct position
        'Y' = letter exists in the target but a different position (count aware)
        'B' = letter not in this word but present elsewhere in the puzzle (global pool)
        'R' = letter not available anywhere (exhausted global pool)

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

    # Remaining counts for Wordle per-slot logic.
    target_counts = Counter(t)

    # Global pool (all targets) for smart-blue hints. Count-aware so duplicates are respected.
    global_pool = Counter(t)
    if others_clean:
        global_pool.update("".join(others_clean))

    # Pass 1: Greens
    for i, ch in enumerate(g):
        if ch == t[i]:
            result[i] = "G"
            target_counts[ch] -= 1
            global_pool[ch] -= 1  # consume from global pool too

    # Pass 2: Yellows
    for i, ch in enumerate(g):
        if result[i] != "R":  # already green
            continue
        if target_counts.get(ch, 0) > 0:
            result[i] = "Y"
            target_counts[ch] -= 1
            global_pool[ch] -= 1  # consume from global pool to shrink future blues

    # Pass 3: Blues vs Reds using the remaining GLOBAL pool
    for i, ch in enumerate(g):
        if result[i] != "R":
            continue
        if global_pool.get(ch, 0) > 0:
            result[i] = "B"
            global_pool[ch] -= 1
        else:
            result[i] = "R"

    # Post-pass: eliminate Blue+Red contradiction for same letter in one guess.
    # If a letter got Blue anywhere, upgrade remaining Reds of that letter to Blue.
    blue_letters = {g[i] for i in range(len(g)) if result[i] == "B"}
    for i, ch in enumerate(g):
        if result[i] == "R" and ch in blue_letters:
            result[i] = "B"

    return result
