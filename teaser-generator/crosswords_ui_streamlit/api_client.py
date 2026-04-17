
"""
api_client.py
=============

A tiny, well-commented client for your Streamlit app to talk to the CrosSwords FastAPI server.

You can import this file in your Streamlit code:

    from api_client import API, APIError

    api = API(base_url="http://127.0.0.1:8000")  # <-- point to your server
    api.login("alice", "password123")            # now api.auth_header is set for future calls

Then use:
    api.create_game()
    api.join_game(game_id)
    api.submit_words(game_id, ["TREE","BIRD","APPLE","TABLE","PLANET"])
    local, server = api.guess_with_optimistic_ui(game_id, 0, "SAND", opponent_words)

NOTE: This file also includes a local color calculator (compute_feedback) so your UI can
render colors *instantly* while the server is still responding. We then reconcile to the
server's official result to keep the game fair and authoritative.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import requests
import time


# ------------------------------
# Exceptions
# ------------------------------

class APIError(Exception):
    """Raised when the server returns a non-2xx response or when we detect a client misuse."""
    pass


# ------------------------------
# Helper: local color computation
# ------------------------------

def compute_feedback(guess: str, target: str, opponent_full_set: List[str]) -> Dict[str, object]:
    """
    Compute per-letter feedback using the same rules as the server:
      - 'green'  => right letter, right position  (adds to letters_solved_count)
      - 'yellow' => in target word, wrong position
      - 'blue'   => not in target word, but appears in another opponent word
      - 'grey'   => not present in any opponent word

    Parameters
    ----------
    guess : str
        The guessed word (any case); must be the same length as the target word.
    target : str
        The true target word for the current guess (your opponent's word at a given index).
    opponent_full_set : List[str]
        All 5 of your opponent's words (UPPERCASE recommended).

    Returns
    -------
    Dict[str, object]
        Example:
        {
            "per_letter": ["grey","green","blue","grey"],
            "greens": 1,
            "yellows": 0,
            "blues": 1
        }
    """
    g = (guess or "").strip().upper()
    t = (target or "").strip().upper()

    if len(g) != len(t):
        raise APIError(f"Local compute_feedback: guess length {len(g)} != target length {len(t)}")

    target_letters = list(t)
    opponent_letters = set("".join(opponent_full_set or []))

    # First pass: mark greens (exact matches)
    per = ["grey"] * len(g)
    used_in_target = [False] * len(t)
    for i, ch in enumerate(g):
        if i < len(t) and ch == t[i]:
            per[i] = "green"
            used_in_target[i] = True

    # Second pass: mark yellow (present elsewhere in target), otherwise blue/grey
    for i, ch in enumerate(g):
        if per[i] == "green":
            continue

        # Try to find a matching unused letter in the target => yellow
        found_yellow = False
        for j, tch in enumerate(target_letters):
            if not used_in_target[j] and ch == tch:
                per[i] = "yellow"
                used_in_target[j] = True
                found_yellow = True
                break
        if found_yellow:
            continue

        # Not in target; is it in another opponent word?
        per[i] = "blue" if ch in opponent_letters else "grey"

    greens = sum(1 for p in per if p == "green")
    yellows = sum(1 for p in per if p == "yellow")
    blues = sum(1 for p in per if p == "blue")

    return {"per_letter": per, "greens": greens, "yellows": yellows, "blues": blues}


# ------------------------------
# API Client
# ------------------------------

@dataclass
class API:
    """
    Thin wrapper around the HTTP API. Keeps headers + base URL in one place and
    provides beginner-friendly methods that your Streamlit UI can call directly.

    Attributes
    ----------
    base_url : str
        The server root URL, e.g. "http://127.0.0.1:8000" or "https://api.example.com".
    timeout : int
        Seconds to wait for each HTTP request before giving up.
    auth_header : Optional[Dict[str, str]]
        Set after login/register; used automatically by methods that require auth.
    """
    base_url: str
    timeout: int = 15
    auth_header: Optional[Dict[str, str]] = None

    # -------------
    # Low-level HTTP helpers (you usually don't need to touch these)
    # -------------
    def _url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}{path}"

    def _headers(self) -> Dict[str, str]:
        return self.auth_header or {}

    def _post(self, path: str, json: Optional[dict] = None) -> dict:
        try:
            r = requests.post(self._url(path), json=json, headers=self._headers(), timeout=self.timeout)
            if r.status_code >= 400:
                # Try to show friendly details if the server returned JSON
                try:
                    detail = r.json()
                except Exception:
                    detail = r.text
                raise APIError(f"POST {path} failed: {r.status_code} {detail}")
            return r.json()
        except requests.RequestException as e:
            raise APIError(f"POST {path} error: {e}")

    def _get(self, path: str) -> dict:
        try:
            r = requests.get(self._url(path), headers=self._headers(), timeout=self.timeout)
            if r.status_code >= 400:
                try:
                    detail = r.json()
                except Exception:
                    detail = r.text
                raise APIError(f"GET {path} failed: {r.status_code} {detail}")
            return r.json()
        except requests.RequestException as e:
            raise APIError(f"GET {path} error: {e}")

    # -------------
    # Auth
    # -------------
    def register(self, username: str, password: str) -> dict:
        """
        Create a new user and store the returned API key in self.auth_header.
        Safe to call from Streamlit UI code.
        """
        payload = {"username": username, "password": password}
        data = self._post("/auth/register", payload)
        api_key = data.get("api_key")
        if not api_key:
            raise APIError("Register succeeded but no api_key in response.")
        self.auth_header = {"Authorization": f"Bearer {api_key}"}
        return data

    def login(self, username: str, password: str) -> dict:
        """
        Log in and store the API key so subsequent calls are authenticated.
        """
        payload = {"username": username, "password": password}
        data = self._post("/auth/login", payload)
        api_key = data.get("api_key")
        if not api_key:
            raise APIError("Login succeeded but no api_key in response.")
        self.auth_header = {"Authorization": f"Bearer {api_key}"}
        return data

    # -------------
    # Game setup
    # -------------
    def create_game(self) -> int:
        """
        Create a new game where *you* are Player 1.
        Returns the new game_id.
        """
        data = self._post("/games/create")
        game_id = data.get("game_id")
        if game_id is None:
            raise APIError("Server did not return game_id.")
        return int(game_id)

    def join_game(self, game_id: int) -> dict:
        """
        Join an existing game as Player 2.
        """
        return self._post("/games/join", {"game_id": int(game_id)})

    def submit_words(self, game_id: int, words: List[str]) -> dict:
        """
        Submit your 5-word set. The server validates:
          - Exactly 5 words
          - 2×4, 2×5, 1×6 letters
          - All unique
          - A–Z only
          - In TWL (unless the server is in dev mode with soft-allow)

        Common mistakes the server will reject:
          - wrong counts (e.g., 3 four-letter words)
          - lowercase (use upper or we will upper() for you)
          - words with spaces, hyphens, or numbers
        """
        words_up = [ (w or "").strip().upper() for w in words ]
        return self._post(f"/games/{int(game_id)}/submit_words", {"words": words_up})

    # -------------
    # Game state + guesses
    # -------------
    def get_state(self, game_id: int) -> dict:
        """
        Ask the server whose turn it is and see each player's letters_solved_count.
        Useful to refresh your UI or decide whether to show the 'Guess' button.
        """
        return self._get(f"/games/{int(game_id)}/state")

    def guess(self, game_id: int, target_word_index: int, guess_word: str) -> dict:
        """
        Submit a guess *authoritatively* to the server.
        The server computes official per-letter colors, updates solved counts,
        switches the turn, and returns feedback:
           {
             "per_letter": [...],
             "greens": int,
             "yellows": int,
             "blues": int,
             "total_correct_letters_so_far": int
           }
        """
        payload = {"target_word_index": int(target_word_index), "guess_word": (guess_word or "").strip().upper()}
        return self._post(f"/games/{int(game_id)}/guess", payload)

    def guess_with_optimistic_ui(
        self,
        game_id: int,
        target_word_index: int,
        guess_word: str,
        opponent_words: List[str],
        sleep_after_local_ms: int = 0,
    ) -> Tuple[Dict[str, object], Dict[str, object]]:
        """
        Do a 'fast feel' guess:
          1) Compute local colors immediately (for instant UI).
          2) Send the guess to the server for the official verdict.
          3) Return (local_feedback, server_feedback). Your UI should render local first
             and then reconcile to the server when the response arrives.

        Parameters
        ----------
        game_id : int
            The game you are playing.
        target_word_index : int
            Which of opponent's 5 words you're targeting (0..4).
        guess_word : str
            Your guess. Must be same length as the target word.
        opponent_words : List[str]
            All 5 opponent words (UPPERCASE recommended). The target word is opponent_words[target_word_index].
        sleep_after_local_ms : int
            OPTIONAL delay to simulate network latency in demos; your Streamlit UI can call
            time.sleep() separately if preferred. Defaults to 0.
        """
        # 1) Instant local colors
        target = opponent_words[target_word_index]
        local = compute_feedback(guess_word, target, opponent_words)

        # Optional small pause so you can see the optimistic result before server returns (for demo purposes)
        if sleep_after_local_ms > 0:
            time.sleep(sleep_after_local_ms / 1000.0)

        # 2) Official result
        server = self.guess(game_id, target_word_index, guess_word)

        return local, server


# ------------------------------
# Tiny demo (optional): run this file directly to smoke-test your server
# ------------------------------
if __name__ == "__main__":
    # IMPORTANT: Set your server URL here (localhost by default)
    api = API(base_url="http://127.0.0.1:8000")

    print("Registering users...")
    try:
        a = api.register("alice", "password123")
    except APIError:
        # If alice already exists, just login
        a = api.login("alice", "password123")
    alice_key = api.auth_header

    # New client object for Bob (to simulate 2 players cleanly)
    api_bob = API(base_url="http://127.0.0.1:8000")
    try:
        b = api_bob.register("bob", "password123")
    except APIError:
        b = api_bob.login("bob", "password123")

    print("Creating and joining a game...")
    gid = api.create_game()
    api_bob.join_game(gid)

    print("Submitting words...")
    api.submit_words(gid, ["TREE","BIRD","APPLE","TABLE","PLANET"])
    api_bob.submit_words(gid, ["WIND","FROG","CHAIR","MOUSE","ORANGE"])

    print("Checking state...")
    state = api.get_state(gid)
    print("State (Alice):", state)

    print("Alice guesses with optimistic UI...")
    local, server = api.guess_with_optimistic_ui(gid, 0, "SAND", ["WIND","FROG","CHAIR","MOUSE","ORANGE"])
    print("Local colors:", local)
    print("Server colors:", server)

    print("Now it's Bob's turn...")
    state_bob = api_bob.get_state(gid)
    print("State (Bob):", state_bob)
