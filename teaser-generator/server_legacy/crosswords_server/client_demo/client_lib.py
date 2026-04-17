"""client_lib.py
A tiny, beginner-friendly Python client you can reuse in your Streamlit or RN (via Python bridge tests) to:
- Compute local per-letter colors immediately (optimistic UI)
- Still call the server for the official result
- Reconcile any differences to the server's truth

You can copy the compute_feedback() function into your JS client 1:1 (logic is deterministic).
"""

from typing import List, Dict, Tuple
import requests

def compute_feedback(guess: str, target: str, opponent_full_set: List[str]) -> Dict:
    """Exact match of the server's services/validate.py algorithm."""
    g = guess.upper().strip()
    t = target.upper().strip()

    target_letters = list(t)
    opponent_letters = set("".join(opponent_full_set))

    # First pass: greens
    result = ["grey"] * len(g)
    used_in_target = [False] * len(t)
    for i, ch in enumerate(g):
        if i < len(t) and ch == t[i]:
            result[i] = "green"
            used_in_target[i] = True

    # Second pass: yellow/blue/grey
    for i, ch in enumerate(g):
        if result[i] == "green":
            continue
        # yellow?
        found_yellow = False
        for j, tch in enumerate(target_letters):
            if not used_in_target[j] and ch == tch:
                result[i] = "yellow"
                used_in_target[j] = True
                found_yellow = True
                break
        if found_yellow:
            continue
        # blue or grey
        if ch in opponent_letters:
            result[i] = "blue"
        else:
            result[i] = "grey"

    greens = sum(1 for r in result if r == "green")
    yellows = sum(1 for r in result if r == "yellow")
    blues = sum(1 for r in result if r == "blue")

    return {"per_letter": result, "greens": greens, "yellows": yellows, "blues": blues}

class GameClient:
    """Thin wrapper around the HTTP API that does optimistic local colors and reconciliation."""
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {api_key}"}

    def _post(self, path: str, json=None):
        r = requests.post(f"{self.base_url}{path}", json=json, headers=self.headers)
        r.raise_for_status()
        return r.json()

    def _get(self, path: str):
        r = requests.get(f"{self.base_url}{path}", headers=self.headers)
        r.raise_for_status()
        return r.json()

    # --- Gameplay helpers ---
    def guess_with_optimistic_ui(self, game_id: int, target_word_index: int, guess_word: str, opponent_words: List[str]) -> Tuple[Dict, Dict]:
        """Returns (local_feedback, server_feedback). Your UI can render local immediately,
        then reconcile to server when it returns."""
        # 1) Local compute (optimistic)
        target = opponent_words[target_word_index]
        local = compute_feedback(guess_word, target, opponent_words)

        # 2) Official server result
        server = self._post(f"/games/{game_id}/guess", {"target_word_index": target_word_index, "guess_word": guess_word})

        return local, server
