# Validation helpers (uses your real TWL)
from typing import List
import re
from crosswords_server.app.services import twl as server_twl

def is_twl_word(w: str) -> bool:
    """Use the server-side TWL checker for consistency across UI and API."""
    return server_twl.is_twl_word(w)

def clean_word(w: str) -> str:
    """Uppercase A–Z only: remove non-letters and normalize to uppercase."""
    import re as _re
    return _re.sub(r"[^A-Z]", "", (w or "").upper())

def validate_wordset(words: List[str]) -> str:
    """Ensure 2×4, 2×5, 1×6, unique words, and TWL membership."""
    from collections import Counter
    cleaned = [clean_word(w) for w in words if clean_word(w)]
    need = {4:2,5:2,6:1}
    got = Counter(len(w) for w in cleaned)
    if any(got.get(L,0)!=need[L] for L in need) or sum(got.values())!=5:
        return "Need exactly 5 words: 2×4, 2×5, 1×6."
    if len(set(cleaned))!=len(cleaned):
        return "Duplicate words not allowed."
    bad = [w for w in cleaned if not is_twl_word(w)]
    if bad: return "Not in TWL list: "+", ".join(bad)
    return ""
