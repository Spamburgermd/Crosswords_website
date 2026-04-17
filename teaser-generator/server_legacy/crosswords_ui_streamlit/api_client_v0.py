# ===================== REPLACE (OR CREATE) ENTIRE FILE api_client_v0.py WITH THIS =====================
"""
api_client_v0.py
Simple HTTP client for the CrosSwords FastAPI server.

Beginner notes:
- Every method wraps a single REST endpoint.
- We ALWAYS send the auth header once you log in or register.
- On HTTP errors (4xx/5xx), we raise APIError with a readable message.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import requests


class APIError(Exception):
    """Raised for non-2xx responses from the server, with a friendly message."""
    pass


class API:
    def __init__(self, base_url: str = "http://127.0.0.1:8000"):
        # Strip trailing slash to avoid double slashes in URLs
        self.base_url = base_url.rstrip("/")
        # After register/login, set this to {"Authorization": "Bearer <token>"}
        self.auth_header: Optional[str] = None

    # ------------------------- internal helpers -------------------------

    def _headers(self) -> Dict[str, str]:
        """Build request headers. Adds Authorization if we have it."""
        h = {"Content-Type": "application/json"}
        if self.auth_header:
            h["Authorization"] = self.auth_header
        return h

    def _handle(self, resp: requests.Response) -> Any:
        """Raise APIError on non-2xx with the server's message; else return JSON."""
        try:
            data = resp.json()
        except Exception:
            data = None

        if 200 <= resp.status_code < 300:
            return data

        # Build a friendly message
        detail = None
        if isinstance(data, dict):
            # FastAPI often returns {"detail": "..."} or {"detail": {...}}
            d = data.get("detail")
            if isinstance(d, str):
                detail = d
            elif isinstance(d, dict):
                # sometimes detail is like {"errors": [...]}
                if "errors" in d and isinstance(d["errors"], list):
                    detail = "; ".join(str(x) for x in d["errors"]) or str(d)
                else:
                    detail = str(d)
        if not detail:
            detail = data if isinstance(data, str) else resp.text

        raise APIError(f"{resp.status_code} {resp.reason}: {detail}")

    # ----------------------------- auth -----------------------------

    def register(self, username: str, password: str) -> Dict[str, Any]:
        url = f"{self.base_url}/auth/register"
        resp = requests.post(url, headers=self._headers(), json={"username": username, "password": password}, timeout=15)
        data = self._handle(resp)
        # Server returns {"user_id": ..., "api_key": "..."}
        token = data.get("api_key")
        if token:
            self.auth_header = f"Bearer {token}"
        return data

    def login(self, username: str, password: str) -> Dict[str, Any]:
        url = f"{self.base_url}/auth/login"
        resp = requests.post(url, headers=self._headers(), json={"username": username, "password": password}, timeout=15)
        data = self._handle(resp)
        token = data.get("api_key")
        if token:
            self.auth_header = f"Bearer {token}"
        return data

    # ----------------------------- games -----------------------------

    def create_game(self) -> int:
        """POST /games/create -> returns {'game_id': int}"""
        url = f"{self.base_url}/games/create"
        resp = requests.post(url, headers=self._headers(), json={}, timeout=15)
        data = self._handle(resp)
        gid = int(data["game_id"])
        return gid

    def join_game(self, game_id: int) -> Dict[str, Any]:
        """POST /games/join with {'game_id': N}"""
        url = f"{self.base_url}/games/join"
        resp = requests.post(url, headers=self._headers(), json={"game_id": int(game_id)}, timeout=15)
        return self._handle(resp)

    def submit_words(self, game_id: int, words: List[str]) -> Dict[str, Any]:
        """POST /games/{id}/submit_words with {'words': [5 strings]}"""
        url = f"{self.base_url}/games/{int(game_id)}/submit_words"
        resp = requests.post(url, headers=self._headers(), json={"words": words}, timeout=30)
        return self._handle(resp)

    def ready(self, game_id: int) -> Dict[str, Any]:
        """POST /games/{id}/ready (no body)"""
        url = f"{self.base_url}/games/{int(game_id)}/ready"
        resp = requests.post(url, headers=self._headers(), json={}, timeout=15)
        return self._handle(resp)

    def get_state(self, game_id: int) -> Dict[str, Any]:
        """GET /games/{id}/state -> GameStateOut dict (safe)"""
        url = f"{self.base_url}/games/{int(game_id)}/state"
        resp = requests.get(url, headers=self._headers(), timeout=15)
        return self._handle(resp)

    def guess(self, game_id: int, target_index: int, guess: str) -> Dict[str, Any]:
        """POST /games/{id}/guess with {'target_index': 0..4, 'guess': 'HELLO'}"""
        url = f"{self.base_url}/games/{int(game_id)}/guess"
        payload = {"target_index": int(target_index), "guess": str(guess)}
        resp = requests.post(url, headers=self._headers(), json=payload, timeout=30)
        return self._handle(resp)
# ===================== END OF FILE =====================
