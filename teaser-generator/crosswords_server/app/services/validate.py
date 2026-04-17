from pathlib import Path
from typing import List, Set, Tuple

REQUIRED = [(4,2),(5,2),(6,1)]

# ---------------------------------------------------------------------------
# Profanity / slur denylist (defense-in-depth for word submission)
# ---------------------------------------------------------------------------
_DENYLIST: Set[str] | None = None

def _load_denylist() -> Set[str]:
    global _DENYLIST
    if _DENYLIST is not None:
        return _DENYLIST
    denylist_path = Path(__file__).resolve().parent.parent.parent / "data" / "slur_hate_denylist.txt"
    words: Set[str] = set()
    if denylist_path.exists():
        for line in denylist_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                words.add(line.upper())
    _DENYLIST = words
    return _DENYLIST

def check_profanity(words: List[str]) -> Tuple[bool, List[str]]:
    """Check submitted words against the profanity/slur denylist."""
    denylist = _load_denylist()
    if not denylist:
        return True, []
    errs: List[str] = []
    for w in words:
        cleaned = _clean_word(w)
        if cleaned in denylist:
            errs.append(f"The word '{cleaned}' is not allowed.")
    return (len(errs) == 0), errs
def _clean_word(w: str) -> str:
    return "".join(ch for ch in (w or "").upper() if "A" <= ch <= "Z")
def validate_wordset(words: List[str]) -> Tuple[bool, List[str]]:
    errs: List[str] = []
    cleaned = [_clean_word(w) for w in words]
    if len(cleaned) != 5:
        errs.append("You must provide exactly 5 words.")
        return False, errs
    from collections import Counter
    counts = Counter(len(w) for w in cleaned)
    for L, need in REQUIRED:
        if counts.get(L,0) != need:
            errs.append(f"Need {need} word(s) of length {L}, got {counts.get(L,0)}.")
    if len(set(cleaned)) != 5:
        errs.append("Words must be unique.")
    return (len(errs)==0), errs
def compute_feedback(guess: str, target: str, all_words: List[str]) -> dict:
    """
    Provide Wordle-style feedback codes for a guess against a single target word.
    Blues are counted against every OTHER word in the puzzle; they are never consumed by yellows.
    """
    guess = _clean_word(guess)
    target = _clean_word(target)
    from collections import Counter

    # Build letter inventories: one for the current word (green/yellow) and one for the rest (blue).
    current_counts = Counter(target)
    other_counts = Counter()
    for candidate in all_words:
        candidate_word = _clean_word(candidate)
        if not candidate_word or candidate_word == target:
            continue
        other_counts.update(candidate_word)

    per_letter: List[str] = ["grey"] * len(guess)
    greens = yellows = blues = 0

    # Step 1: greens remove letters from the current word count immediately.
    for pos, ch in enumerate(guess):
        if pos < len(target) and ch == target[pos]:
            per_letter[pos] = "green"
            greens += 1
            current_counts[ch] -= 1

    # Step 2: yellows also consume the current word inventory, but never touch the blue pool.
    for pos, ch in enumerate(guess):
        if per_letter[pos] != "grey":
            continue
        if current_counts.get(ch, 0) > 0:
            per_letter[pos] = "yellow"
            yellows += 1
            current_counts[ch] -= 1

    # Step 3: blues consume the pooled inventory from every other word, ensuring count-awareness.
    for pos, ch in enumerate(guess):
        if per_letter[pos] != "grey":
            continue
        if other_counts.get(ch, 0) > 0:
            per_letter[pos] = "blue"
            blues += 1
            other_counts[ch] -= 1

    return {"per_letter": per_letter, "greens": greens, "yellows": yellows, "blues": blues}
