# ===================== REPLACE ENTIRE FILE client_streamlit_lobby_board_v1.py WITH THIS =====================
"""
Lobby → Submit words → Ready → Countdown → Board
Milestone 2/3 adds: turns, guessing, history, and progress counters.
"""

from __future__ import annotations
import time
from datetime import datetime, timezone
from typing import List

import streamlit as st
from api_client_v0 import API, APIError  # your simple HTTP client

# ---------- Small helpers ----------
def _parse_utc(ts: str | None):
    if not ts:
        return None
    try:
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        return datetime.fromisoformat(ts)
    except Exception:
        return None

def _seconds_left(start_at: datetime | None) -> int:
    if not start_at:
        return 0
    now = datetime.now(timezone.utc)
    if start_at.tzinfo is None:
        start_at = start_at.replace(tzinfo=timezone.utc)
    diff = (start_at - now).total_seconds()
    return max(0, int(diff))

def _ensure_state():
    defaults = {
        "api_base": "http://127.0.0.1:8000",
        "api_key": None,
        "user": None,
        "game_id": None,
        "words_inputs": ["", "", "", "", ""],
        "last_state": None,
        "view": "lobby",   # "lobby" or "board"
        "guess_input": "",
        "target_index": 0,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

# ---------- Lobby (unchanged except for minor polish) ----------
def lobby_view(api: API):
    st.header("Lobby")

    colA, colB = st.columns(2)
    with colA:
        if st.button("Create Game (become Player 1)"):
            try:
                gid = api.create_game()
                st.session_state.game_id = gid
                st.success(f"Created game #{gid}")
            except APIError as e:
                st.error(str(e))
    with colB:
        with st.form("join_form", clear_on_submit=True):
            gid_inp = st.text_input("Enter Game ID to join")
            join = st.form_submit_button("Join Game")
        if join:
            try:
                api.join_game(int(gid_inp))
                st.session_state.game_id = int(gid_inp)
                st.success(f"Joined game #{gid_inp}")
            except Exception as e:
                st.error(str(e))

    if not st.session_state.game_id:
        st.info("Create or join a game to continue.")
        return

    st.divider()
    st.subheader(f"Game #{st.session_state.game_id} — Submit Words")

    with st.form("words_form", clear_on_submit=False):
        cols = st.columns(5)
        labels = ["4-letter #1", "4-letter #2", "5-letter #1", "5-letter #2", "6-letter #1"]
        new_vals = []
        for i in range(5):
            new_vals.append(cols[i].text_input(labels[i], value=st.session_state.words_inputs[i]))
        submit = st.form_submit_button("Submit My Words")
    if submit:
        try:
            api.submit_words(st.session_state.game_id, new_vals)
            st.session_state.words_inputs = new_vals
            st.success("Words submitted and auto-placed on the server.")
        except APIError as e:
            st.error(str(e))

    st.divider()
    st.subheader("Ready Check")

    c1, c2 = st.columns([1, 3])
    with c1:
        if st.button("I'm Ready"):
            try:
                api.ready(st.session_state.game_id)
                st.success("Marked Ready.")
            except APIError as e:
                st.error(str(e))
    with c2:
        st.caption("Both players must submit words and click Ready. Then a 10-second countdown starts.")

    # ---- Live state panel ----
    st.divider()
    st.subheader("Live Game State")

    poll = st.checkbox("Auto-poll state (every 0.5s)", value=True)
    placeholder = st.empty()

    def render_state():
        try:
            state = api.get_state(st.session_state.game_id)
            st.session_state.last_state = state
        except APIError as e:
            placeholder.error(str(e))
            return

        status = state.get("status")
        start_at_raw = state.get("start_at")
        start_at_dt = _parse_utc(start_at_raw) if start_at_raw else None

        me = state.get("me") or {}
        opp = state.get("opponent") or {}

        col1, col2, col3 = placeholder.columns([1, 1, 2])
        col1.metric("Status", status or "—")
        col1.metric("Me: submitted", str(me.get("words_submitted", False)))
        col1.metric("Me: ready", str(me.get("ready", False)))
        col2.metric("Opponent: submitted", str(opp.get("words_submitted", False)))
        col2.metric("Opponent: ready", str(opp.get("ready", False)))

        if status == "starting" and start_at_dt:
            left = _seconds_left(start_at_dt)
            col3.subheader(f"⏳ Game starts in: {left} s")
            if left == 0:
                try:
                    state2 = api.get_state(st.session_state.game_id)
                    if state2.get("status") == "active":
                        st.session_state.view = "board"
                        st.query_params["view"] = "board"
                        st.experimental_rerun()
                except APIError as e:
                    col3.error(str(e))
        elif status == "active":
            st.session_state.view = "board"
            st.query_params["view"] = "board"
            st.experimental_rerun()
        else:
            col3.write("Waiting for both players to submit words and click Ready…")

    if poll:
        for _ in range(40):
            render_state()
            time.sleep(0.5)
    else:
        render_state()

# ---------- Board (new for Milestone 2/3) ----------
def _badge(code: str) -> str:
    # Simple colored square HTML for G/Y/R
    color = {"G": "#22c55e", "Y": "#eab308", "R": "#ef4444"}.get(code, "#6b7280")
    return f"<span style='display:inline-block;width:18px;height:18px;border-radius:4px;background:{color};margin-right:4px'></span>"

def _render_history(entries: List[dict]):
    if not entries:
        st.write("No guesses yet.")
        return
    for e in entries:
        codes = e.get("codes", [])
        guess = e.get("guess", "")
        dots = "".join(_badge(c) for c in codes)
        st.markdown(f"{dots} **{guess}**", unsafe_allow_html=True)

def board_view(api: API):
    st.header("Game Board")

    if not st.session_state.game_id:
        st.warning("No game selected. Go back to Lobby.")
        if st.button("Back to Lobby"):
            st.session_state.view = "lobby"
            st.query_params["view"] = "lobby"
            st.experimental_rerun()
        return

    try:
        state = api.get_state(st.session_state.game_id)
    except APIError as e:
        st.error("Could not fetch game state.")
        with st.expander("Details (for debugging)"):
            st.code(str(e))
        # Keep the page usable
        st.stop()


    status = state.get("status")
    if status != "active":
        st.warning(f"Board not active yet (status={status}). Waiting for server to flip…")
        colA, colB = st.columns(2)
        if colA.button("Retry now"):
            st.experimental_rerun()
        # gentle auto-retry without freezing UI
        import time
        time.sleep(0.5)
        st.experimental_rerun()


    # Turn banner
    # Defensive: handle missing user/session silently
    me = st.session_state.get("user") or {}
    my_uid = me.get("user_id")
    is_my_turn = (state.get("current_turn_user_id") == my_uid) if my_uid is not None else False

    if is_my_turn:
        st.success("✅ Your turn!")
    else:
        st.info("⏳ Waiting for opponent… (this will refresh)")

    # Progress
    cols = st.columns(3)
    cols[0].metric("Your Progress (letters)", state.get("your_progress_letters", 0))
    cols[1].metric("Opponent Progress", state.get("opponent_progress_letters", 0))
    cols[2].metric("Total Letters (goal)", state.get("total_letters", 0))

    st.divider()
    st.subheader("Your Guess History")
    _render_history(state.get("your_history", []))

    st.divider()
    st.subheader("Make a Guess")

    target_lengths: List[int] = state.get("target_lengths") or []
    if len(target_lengths) != 5:
        st.warning("Opponent target lengths not available yet.")
        return

    # Choose which opponent word to guess
    idx = st.selectbox(
        "Which word?",
        options=list(range(5)),
        format_func=lambda i: f"Word {i+1} (length {target_lengths[i]})",
        index=min(max(0, st.session_state.get("target_index", 0)), 4),
        key="target_index"
    )

    # Guess input (enforce length)
    need_len = target_lengths[idx]
    guess = st.text_input(
        f"Enter a {need_len}-letter guess",
        value=st.session_state.get("guess_input", ""),
        max_chars=need_len,
        key="guess_input"
    )

    # Helpful validation note
    st.caption("Only letters A–Z are allowed. Non-letters will be stripped on submit.")

    # Submit guess (only if it's your turn)
    g_clean = "".join(ch for ch in (guess or "") if ch.isalpha())
    disabled = (not is_my_turn) or (len(g_clean.upper()) != need_len)

    if st.button("Submit Guess", type="primary", disabled=disabled):
        try:
            api.guess(st.session_state.game_id, int(idx), guess)
            # Clear input, refetch state
            st.session_state.guess_input = ""
            st.experimental_rerun()
        except APIError as e:
            st.error(str(e))

    with st.expander("Debug: Raw game state"):
        import json as _json
        st.code(_json.dumps(state, indent=2, sort_keys=True, default=str))


def main():
    _ensure_state()
    st.set_page_config(page_title="CrosSwords", page_icon="🗡️", layout="wide")
    st.title("🗡️ CrosSwords — Multiplayer (Milestones 1–3)")

    # Sidebar: Server + Auth
    with st.sidebar:
        st.header("Server")
        st.session_state.api_base = st.text_input("API Base URL", st.session_state.api_base)
        api = API(base_url=st.session_state.api_base)

        st.divider()
        st.header("Auth")
        with st.form("auth_form"):
            col1, col2 = st.columns(2)
            with col1:
                username = st.text_input("Username", value="alice")
            with col2:
                password = st.text_input("Password", value="password123", type="password")
            c1, c2 = st.columns(2)
            do_login = c1.form_submit_button("Login")
            do_register = c2.form_submit_button("Register")
        if do_login or do_register:
            try:
                data = api.register(username, password) if do_register else api.login(username, password)
                st.session_state.api_key = api.auth_header
                st.session_state.user = data
                st.success(f"Authenticated as user_id={data.get('user_id')}")
            except APIError as e:
                st.error(str(e))
        if st.session_state.api_key:
            api.auth_header = st.session_state.api_key

    # URL param bridge for board
    view_q = st.query_params.get("view", "lobby")
    if view_q == "board":
        st.session_state.view = "board"

    api = API(base_url=st.session_state.api_base)
    if st.session_state.api_key:
        api.auth_header = st.session_state.api_key

    if st.session_state.view == "board":
        board_view(api)
    else:
        lobby_view(api)

if __name__ == "__main__":
    main()
# ===================== END OF FILE =====================
