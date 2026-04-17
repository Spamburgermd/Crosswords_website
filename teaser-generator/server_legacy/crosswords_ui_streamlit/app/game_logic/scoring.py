# app/game_logic/scoring.py
# ---------------------------------------------------------------------------
# Purpose
#   - Compute per-letter feedback codes for your Wordle-like game with an extra
#     BLUE state that means: "letter not in this target word, but is present
#     in some OTHER word on the board."
#   - Render those codes as colored squares next to the guessed letters.
#
# Why this version?
#   - COMPLETES your unfinished wordle_feedback_with_board_blue() function.
#   - Adds DEFENSIVE behavior so UI won't crash if lengths differ, inputs
#     are None/empty, or upstream logic passes weird values.
#   - Keeps your BLUE ('B') logic based on letters from other placed words.
#
# Novice notes:
#   - The flow is:
#       1) feedback_for_guess(...) figures out which letters are Green/Yellow
#          using standard Wordle logic, then assigns Blue/White for the rest
#          based on "other words on the board".
#       2) render_feedback_row(...) turns codes into emoji squares + letters.
#   - If guess length doesn't match target length, we DO NOT throw; we return
#     a neutral list ('W') for each guessed character so the UI can still
#     render without crashing.
# ---------------------------------------------------------------------------

from __future__ import annotations
from typing import Dict, Tuple, List, Set, Optional
import collections

# === NEW: pure Wordle-style G/Y/R scoring for server-side /guess ===
import re
from collections import Counter

def score_guess(guess: str, target: str) -> List[str]:
    """
    Strict Wordle scoring used by the /games/{id}/guess endpoint.

    Returns per-letter codes:
      'G' = correct letter at correct position
      'Y' = letter exists in target but different position (respects counts)
      'R' = letter not in target (or no remaining count)

    This function is STRICT:
      - Only letters are allowed; other chars removed
      - Raises ValueError if lengths don't match or inputs invalid
    """
    clean = lambda s: re.sub(r"[^A-Za-z]", "", (s or "")).upper()
    g = clean(guess)
    t = clean(target)

    if not g or not t or len(g) != len(t):
        raise ValueError("Guess length must match target length; letters only.")

    result: List[str] = ["R"] * len(g)
    remaining = Counter(t)

    # First pass: Greens
    for i, ch in enumerate(g):
        if ch == t[i]:
            result[i] = "G"
            remaining[ch] -= 1

    # Second pass: Yellows
    for i, ch in enumerate(g):
        if result[i] == "G":
            continue
        if remaining.get(ch, 0) > 0:
            result[i] = "Y"
            remaining[ch] -= 1
        else:
            result[i] = "R"

    return result
# === END NEW ===


# If these imports exist in your project, keep them. They aren't used here,
# but leaving them won't hurt. Remove if you prefer.
# from app.utils.constants import ROW_LABELS, COL_LABELS
# from app.utils.types import Coord, LettersMap


# ----------------------------------------------------------
# Helper: collect letters that appear in OTHER words on board
# ----------------------------------------------------------
def letters_in_other_words(placed_words: List[dict], exclude_index: int) -> Set[str]:
    """
    Build a set of UPPERCASE letters that appear in ANY OTHER placed word
    (excluding the currently-targeted word by index).

    placed_words: list of dicts like:
      { "text": "APPLE", "coords": [(r,c), ...], ... }
    exclude_index: which entry in placed_words is the word we're guessing
    """
    pool: Set[str] = set()
    for i, seg in enumerate(placed_words or []):
        if i == exclude_index:
            continue
        for ch in (seg or {}).get("text", ""):
            if isinstance(ch, str) and ch:
                pool.add(ch.upper())
    return pool


# ----------------------------------------------------------
# CORE: Wordle feedback with "Blue" (board-wide letter pool)
# ----------------------------------------------------------
def wordle_feedback_with_board_blue(guess: str, target: str, other_letters_set: Set[str]) -> List[str]:
    """
    Compute per-letter feedback codes for a single guess vs target, with 4 states:

      'G' (green) : correct letter in the correct position
      'Y' (yellow): letter exists in the target but at a different position
      'B' (blue)  : letter is NOT in target, but DOES appear in other words on board
      'W' (white) : letter doesn't exist anywhere on the board (target OR others)

    Implementation details:
      - Standard Wordle is a "two-pass" algorithm:
          Pass 1: mark all Greens and decrement a letter count map
          Pass 2: for non-Greens, if count>0 then mark Yellow and decrement
      - For all remaining letters not in target, we mark Blue if found in
        other_letters_set, otherwise White.
    """
    # --- input normalization (defensive) ---
    guess  = (guess  or "").strip().upper()
    target = (target or "").strip().upper()

    # If one is empty, return all White (UI remains stable)
    if not guess or not target:
        return ["W"] * len(guess)

    # If lengths mismatch, don't crash. We'll compare up to min length for G/Y,
    # then mark any leftover guess letters as White.
    n_guess = len(guess)
    n_tgt = len(target)
    n = min(n_guess, n_tgt)

    # Count target letters for Yellow logic (after Greens are handled).
    counts = collections.Counter(target)

    # First pass: Greens
    result = ["W"] * n_guess  # start with all White; we'll upgrade as needed
    for i in range(n):
        gch = guess[i]
        tch = target[i]
        if gch == tch:
            result[i] = "G"
            counts[gch] -= 1

    # Second pass: Yellows and then Blues/Whites
    for i in range(n):
        if result[i] == "G":
            continue  # already handled
        gch = guess[i]
        # If the letter is still available in target counts, it's Yellow
        if counts.get(gch, 0) > 0:
            result[i] = "Y"
            counts[gch] -= 1
        else:
            # Not in target (or exhausted counts). Is it on the board elsewhere?
            result[i] = "B" if gch in (other_letters_set or set()) else "W"

    # If guess is LONGER than target (length mismatch), mark trailing letters.
    # We can't compare them against target positions, but we can still apply Blue/White.
    for i in range(n, n_guess):
        gch = guess[i]
        result[i] = "B" if gch in (other_letters_set or set()) else "W"

    return result


# ----------------------------------------------------------
# PUBLIC: main entry used by UI code
# ----------------------------------------------------------
def feedback_for_guess(
    guess: str,
    target_text: str,
    placed_words: List[dict],
    target_index: int
) -> List[str]:
    """
    Return per-letter feedback codes for a guess against one target word.

    Codes:
      'G' = green  = correct letter in the correct spot
      'Y' = yellow = letter exists in the target but at a different position
      'B' = blue   = letter is NOT in this target word, but DOES appear in
                     other words on the board
      'W' = white  = letter isn't anywhere on the board

    DEFENSIVE BEHAVIOR:
      - Never raises for length mismatches; returns a list of codes for however
        many chars are in 'guess'. (UI stays stable.)
      - Tolerates None/empty inputs.
    """
    guess = (guess or "")
    target_text = (target_text or "")
    # Build the "board-wide" letter pool from all other words
    other_pool = letters_in_other_words(placed_words or [], exclude_index=target_index)
    # Delegate to the core routine
    return wordle_feedback_with_board_blue(guess, target_text, other_pool)


# ----------------------------------------------------------
# UI RENDERING HELPERS
# ----------------------------------------------------------
def render_feedback_row(feedback_codes: Optional[List[str]], guess: Optional[str]) -> str:
    """
    Render colored squares + letters for a single guess row.

    DEFENSIVE:
      - Accepts feedback_codes = None.
      - Handles length mismatches (shows a square for each guessed character).
    """
    from itertools import zip_longest

    color_square = {'G': '🟩', 'Y': '🟨', 'B': '🟦', 'W': '⬜'}

    # If no codes provided, show "white" squares for each guess char
    guess = (guess or "")
    if not feedback_codes:
        return "  ".join(f"{color_square['W']} {ch}" for ch in guess)

    # zip_longest prevents crashes if lengths differ; unknown codes -> 'W'
    return "  ".join(
        f"{color_square.get(code or 'W', '⬜')} {ch or ''}"
        for code, ch in zip_longest(feedback_codes, guess, fillvalue='W')
    )


# ----------------------------------------------------------
# (Kept from your file; used elsewhere in your app)
# ----------------------------------------------------------
def cell_segments(coord, segments):
    return [seg for seg in segments if coord in seg.get('coords', [])]

def all_letter_coords(placed: List[dict]) -> set:
    s = set()
    for item in (placed or []):
        s.update(item.get("coords", []))
    return s

def square_for(code: str) -> str:
    return {'G': '🟩', 'Y': '🟨', 'B': '🟦', 'W': '⬜'}.get(code, '⬜')
