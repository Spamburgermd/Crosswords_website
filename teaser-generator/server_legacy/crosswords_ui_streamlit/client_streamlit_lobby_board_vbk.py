# =========================  DROP-IN REPLACEMENT FILE  =========================
# File: client_streamlit_lobby_board_v1.py
#
# KEY IMPROVEMENTS IN THIS VERSION:
# 1) SAFE secrets usage: never crashes if .streamlit/secrets.toml doesn't exist.
# 2) URL PARAMS *and* FALLBACK UI:
#      - If the URL has ?game_id=123, we use it.
#      - If not, we show a small form to enter game_id (and optional username),
#        update the URL (when possible), save to session_state, and rerun.
# 3) Clear, beginner-friendly comments on every moving part.
# -----------------------------------------------------------------------------


from __future__ import annotations

import os
import time
from typing import Any, Dict, Optional

import requests
import streamlit as st

# === ADD THIS HELPER (right below your imports) ===
def _safe_autorefresh(interval_ms: int = 2000, key: str = "lobby_poll"):
    """
    Try to auto-refresh using the optional 'streamlit-autorefresh' plugin.
    If it's not installed, we degrade gracefully and show a manual refresh button.
    """
    try:
        # If you want auto-refresh without extra code, install the plugin:
        #   pip install streamlit-autorefresh
        from streamlit_autorefresh import st_autorefresh  # type: ignore
        st_autorefresh(interval=interval_ms, key=key)
        return True
    except Exception:
        # Plugin not available → show a manual refresh option instead
        col_r, _ = st.columns([1, 4])
        with col_r:
            if st.button("Refresh now 🔄", use_container_width=True):
                st.rerun()
        st.caption("Auto-refresh not available (plugin missing). Click **Refresh now** to update.")
        return False


# ------------------------------ Configuration ------------------------------- #
DEFAULT_BASE_URL = "http://127.0.0.1:8000"


def _get_base_url_from_secrets() -> Optional[str]:
    """
    Safely read Streamlit secrets.
    IMPORTANT: Accessing st.secrets raises if secrets.toml is missing.
    We catch any exception and return None so we can fall back gracefully.
    """
    try:
        return st.secrets.get("api", {}).get("base_url")
    except Exception:
        return None


# Order of precedence for API base URL:
#   1) Env var CROSSWORDS_API_BASE_URL
#   2) [api].base_url from .streamlit/secrets.toml
#   3) Local default (dev): http://127.0.0.1:8000
BASE_URL = (
    os.environ.get("CROSSWORDS_API_BASE_URL")
    or _get_base_url_from_secrets()
    or DEFAULT_BASE_URL
)


# ------------------------------ API Client ---------------------------------- #
class API:
    """
    Tiny HTTP client for your FastAPI backend.

    Expected endpoints (adjust if yours differ):
      GET   /games/{game_id}        -> fetch game state/status
      POST  /games/{game_id}/ready  -> mark current player as 'ready'
    """

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def _get(self, path: str, **kwargs) -> Dict[str, Any]:
        r = requests.get(self._url(path), timeout=10, **kwargs)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, json: Optional[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
        r = requests.post(self._url(path), json=json or {}, timeout=10, **kwargs)
        r.raise_for_status()
        try:
            return r.json()
        except requests.JSONDecodeError:
            return {"ok": True}

    def get_game(self, game_id: int) -> Dict[str, Any]:
        return self._get(f"/games/{game_id}")

    def ready(self, game_id: int, player_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Mark the current player as ready.
        If your server REQUIRES player_name, switch payload to include it.
        """
        # payload = {"player_name": player_name}  # <- UNCOMMENT if server requires a name
        payload = {}  # <- keep empty if your server doesn't need player name
        return self._post(f"/games/{game_id}/ready", json=payload)


# --------------------------- Query Param Helpers ---------------------------- #
def init_params_from_url() -> None:
    """
    Pull query params from the URL using the NEW Streamlit API: st.query_params
    (Replaces deprecated st.experimental_get_query_params)
    """
    qp = st.query_params  # dict-like object
    if "game_id" not in st.session_state:
        gid = qp.get("game_id")  # string or None
        try:
            st.session_state.game_id = int(gid) if gid is not None else None
        except (TypeError, ValueError):
            st.session_state.game_id = None

    if "username" not in st.session_state:
        st.session_state.username = qp.get("username")  # may be None


def ensure_game_selection() -> bool:
    """
    If we don't have a game_id yet, show a simple form to collect it.
    Returns True once game_id is set; otherwise renders the form and returns False.
    """
    game_id = st.session_state.get("game_id")
    if game_id:
        return True  # already have one

    st.warning(
        "No `game_id` found in the URL. "
        "Use the form below, or open a link like `...?game_id=123&username=Alice`."
    )

    # Use a form so we only rerun when the user clicks the button
    with st.form("pick_game_form", clear_on_submit=False):
        col1, col2 = st.columns([1, 1])
        with col1:
            game_id_input = st.number_input(
                "Enter Game ID",
                value=0,
                min_value=0,
                step=1,
                help="Ask your host or copy it from the lobby link."
            )
        with col2:
            username_input = st.text_input(
                "Optional: Your name",
                value=(st.session_state.get("username") or ""),
                help="Used by some servers to identify players."
            )

        submitted = st.form_submit_button("Join Lobby ▶️", type="primary", use_container_width=True)

    if submitted:
        # Validate: require a positive game_id
        if not game_id_input or int(game_id_input) <= 0:
            st.error("Please enter a valid Game ID (positive integer).")
            return False

        # Save to session state so the rest of the app can use it
        st.session_state.game_id = int(game_id_input)
        st.session_state.username = username_input.strip() or None

        # Try to update the URL so refreshes/bookmarks keep it
        try:
            # NOTE: st.query_params is writable in modern Streamlit
            st.query_params.update(
                {
                    "game_id": str(st.session_state.game_id),
                    **({"username": st.session_state.username} if st.session_state.username else {}),
                }
            )
        except Exception:
            # Not critical—continue without URL update
            pass

        # Rerun so downstream code sees the new values immediately
        st.rerun()

    # Haven't got a valid selection yet; stop the rest of the page from assuming one.
    return False


# ------------------------------- UI Helpers -------------------------------- #
def show_game_status_block(api: API, game_id: int) -> Dict[str, Any] | None:
    """
    Poll the server and render a tiny status panel.
    Returns the parsed game JSON (or None on error).
    """
    status_placeholder = st.empty()

    try:
        game = api.get_game(game_id)
    except requests.HTTPError as err:
        status_placeholder.error(f"Failed to fetch game {game_id} (HTTP {err.response.status_code}).")
        return None
    except Exception as err:
        status_placeholder.error(f"Failed to fetch game {game_id}: {err}")
        return None

    with status_placeholder.container():
        st.markdown(f"### Lobby · Game **#{game_id}**")

        # If server returns a players list, show readable statuses
        players = game.get("players") or game.get("player_status") or []
        if players:
            lines = []
            for p in players:
                name = p.get("name") or p.get("player") or "Unknown"
                ready = p.get("ready")
                if ready is True:
                    lines.append(f"✅ **{name}** — ready")
                elif ready is False:
                    lines.append(f"⏳ **{name}** — not ready")
                else:
                    lines.append(f"• **{name}**")
            st.markdown("\n".join(lines))
        else:
            st.info("Server did not return a 'players' list — showing raw response to help debug:")
            st.code(game, language="json")

    return game


def lobby_view(api: API) -> None:
    """
    The main lobby view.
    """
    # Ensure we have game_id (from URL or from the fallback form)
    if not ensure_game_selection():
        # Form is displayed; nothing more to do yet.
        return

    game_id = st.session_state["game_id"]
    username = st.session_state.get("username")

    # Auto-refresh the lobby every ~2 seconds so both players see updates.
    _safe_autorefresh(interval_ms=2000, key="lobby_poll")  # tries plugin; otherwise shows a Refresh button


    # Show the latest status
    game = show_game_status_block(api, game_id)

    st.divider()

    # Ready button
    c1, c2 = st.columns([1, 2])
    with c1:
        if st.button("I’m Ready ✅", type="primary", use_container_width=True):
            try:
                # If server REQUIRES name, pass it:
                # api.ready(game_id, player_name=username)
                api.ready(game_id)
                st.success("You are marked ready!")
                time.sleep(0.4)  # give the next poll a moment to catch up
            except requests.HTTPError as err:
                st.error(f"Failed to mark ready (HTTP {err.response.status_code}).")
            except Exception as err:
                st.error(f"Failed to mark ready: {err}")

    with c2:
        # Convenience: show a copyable lobby link reflecting current params
        try:
            qp = {"game_id": str(game_id)}
            if username:
                qp["username"] = username
            # Compose a URL with current host/path plus these params
            base = st.runtime.get_instance()._runtime.hosted_url or ""  # may be empty locally
        except Exception:
            base = ""

        st.caption("Both players click **I’m Ready**. The panel above refreshes every ~2 seconds.")
        if base:
            st.text_input(
                "Shareable Lobby URL",
                value=f"{base}?game_id={game_id}" + (f"&username={username}" if username else ""),
                help="Copy this to invite another player.",
                disabled=True,
            )

    # If both players are ready, hint to proceed
    if game:
        both_ready = (
            game.get("both_ready")
            or (all(p.get("ready") for p in game.get("players", [])) if game.get("players") else None)
        )
        if both_ready:
            st.success("Both players are ready! Head to the Game Board.")
            st.info(
                "➡️ Open your Game Board page/tab for this game. "
                "If your app uses multipage navigation, click the Game Board page now."
            )


# ------------------------------- Entry Point -------------------------------- #
def main() -> None:
    st.set_page_config(page_title="CrosSwords · Lobby", page_icon="🗡️", layout="centered")
    st.title("CrosSwords · Lobby")

    # 1) Try to read URL params (if present)
    init_params_from_url()

    # 2) Build API client
    api = API(BASE_URL)

    # 3) Render lobby
    lobby_view(api)


if __name__ == "__main__":
    main()
# =======================  END DROP-IN REPLACEMENT FILE  =======================
