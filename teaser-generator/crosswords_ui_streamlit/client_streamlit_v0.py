
"""
client_streamlit_v0.py
----------------------
Versioned Streamlit scaffold that talks to the CrosSwords FastAPI server and
uses optimistic local colors + server reconciliation.

Run:
    pip install -r requirements.txt
    streamlit run client_streamlit_v0.py
"""

from __future__ import annotations
import streamlit as st
from typing import List
from api_client_v0 import API, APIError, compute_feedback

def _ensure_state():
    defaults = {
        "api_base": "http://127.0.0.1:8000",
        "api_key": None,
        "user": None,
        "game_id": None,
        "my_words": [],
        "opponent_words": [],
        "last_local_feedback": None,
        "last_server_feedback": None,
        "last_state": None,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

def color_badge(label: str) -> str:
    palette = {"green": "#22c55e","yellow":"#eab308","blue":"#3b82f6","grey":"#6b7280"}
    color = palette.get(label, "#6b7280")
    return f'<span style="display:inline-block;padding:2px 6px;margin:0 2px;border-radius:6px;background:{color};color:white;font-size:0.8rem">{label}</span>'

def render_feedback_row(title: str, fb: dict | None):
    st.markdown(f"**{title}**")
    if not fb:
        st.write("—")
        return
    cols = st.columns([1,3,1,1,1])
    with cols[0]:
        st.caption("per_letter")
    with cols[1]:
        if isinstance(fb.get("per_letter"), list):
            html = "".join(color_badge(x) for x in fb["per_letter"])
            st.markdown(html, unsafe_allow_html=True)
        else:
            st.write(fb.get("per_letter"))
    with cols[2]: st.metric("greens", fb.get("greens",0))
    with cols[3]: st.metric("yellows", fb.get("yellows",0))
    with cols[4]: st.metric("blues", fb.get("blues",0))

def main():
    _ensure_state()
    st.set_page_config(page_title="CrosSwords Client v0", page_icon="🗡️", layout="wide")
    st.title("🗡️ CrosSwords — Streamlit Client v0")
    st.caption("Optimistic local colors + authoritative server results.")

    # Sidebar
    with st.sidebar:
        st.header("Server")
        st.session_state.api_base = st.text_input("API Base URL", st.session_state.api_base)
        api = API(base_url=st.session_state.api_base)

        st.divider()
        st.header("Auth")
        with st.form("auth_form"):
            col1, col2 = st.columns(2)
            with col1: username = st.text_input("Username", value="alice")
            with col2: password = st.text_input("Password", value="password123", type="password")
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

    left, right = st.columns([1,1], gap="large")

    # Left: Setup
    with left:
        st.subheader("1) Game Setup")
        c1, c2 = st.columns(2)
        if c1.button("Create Game (P1)"):
            try:
                api2 = API(base_url=st.session_state.api_base); api2.auth_header = st.session_state.api_key
                st.session_state.game_id = api2.create_game()
                st.success(f"Created game #{st.session_state.game_id}")
            except APIError as e:
                st.error(str(e))

        with c2:
            with st.form("join_form"):
                join_id = st.text_input("Enter Game ID", value="")
                do_join = st.form_submit_button("Join Game (P2)")
            if do_join:
                try:
                    api3 = API(base_url=st.session_state.api_base); api3.auth_header = st.session_state.api_key
                    api3.join_game(int(join_id))
                    st.session_state.game_id = int(join_id)
                    st.success(f"Joined game #{st.session_state.game_id}")
                except ValueError:
                    st.error("Please enter a valid numeric Game ID.")
                except APIError as e:
                    st.error(str(e))

        st.markdown("---")
        st.markdown("**Submit your 5 words** (2×4, 2×5, 1×6)")
        with st.form("submit_words_form"):
            w1 = st.text_input("Word #1 (4 letters)")
            w2 = st.text_input("Word #2 (4 letters)")
            w3 = st.text_input("Word #3 (5 letters)")
            w4 = st.text_input("Word #4 (5 letters)")
            w5 = st.text_input("Word #5 (6 letters)")
            submitted = st.form_submit_button("Submit Words")
        if submitted:
            try:
                api4 = API(base_url=st.session_state.api_base); api4.auth_header = st.session_state.api_key
                api4.submit_words(st.session_state.game_id, [w1,w2,w3,w4,w5])
                st.session_state.my_words = [w.strip().upper() for w in [w1,w2,w3,w4,w5]]
                st.success("Words submitted!")
            except APIError as e:
                st.error(str(e))

        st.markdown("---")
        st.markdown("**Opponent words (local colors only)**")
        with st.form("opp_words_form"):
            opp_text = st.text_area("5 words, one per line", height=120, placeholder="WIND\nFROG\nCHAIR\nMOUSE\nORANGE")
            saved = st.form_submit_button("Save Opponent Words")
        if saved:
            words = [w.strip().upper() for w in opp_text.splitlines() if w.strip()]
            if len(words) != 5:
                st.warning("Enter exactly 5 words.")
            else:
                st.session_state.opponent_words = words
                st.success("Saved locally.")

    # Right: State & Guessing
    with right:
        st.subheader("2) State & Guessing")
        st.write("**Game ID:**", st.session_state.game_id or "—")

        r1, r2 = st.columns(2)
        if r1.button("Refresh State"):
            try:
                api5 = API(base_url=st.session_state.api_base); api5.auth_header = st.session_state.api_key
                st.session_state.last_state = api5.get_state(st.session_state.game_id)
            except APIError as e:
                st.error(str(e))

        if st.session_state.last_state:
            s = st.session_state.last_state
            st.info(f"Status: {s.get('status')} | Your turn? {s.get('your_turn')}")
            c1, c2 = st.columns(2)
            c1.metric("Your letters solved", s.get("your_letters_solved",0))
            c2.metric("Opponent letters solved", s.get("opponent_letters_solved",0))

        st.markdown("---")
        st.markdown("**Make a guess** (local + server)")
        with st.form("guess_form"):
            target_index = st.number_input("Target word index (0..4)", min_value=0, max_value=4, value=0, step=1)
            guess_word = st.text_input("Your guess (match target length)")
            do_guess = st.form_submit_button("Guess")
        if do_guess:
            if not st.session_state.opponent_words:
                st.warning("Set Opponent words first (left column).")
            else:
                try:
                    api6 = API(base_url=st.session_state.api_base); api6.auth_header = st.session_state.api_key
                    local, server = api6.guess_with_optimistic_ui(int(st.session_state.game_id), int(target_index), guess_word, st.session_state.opponent_words)
                    st.session_state.last_local_feedback = local
                    st.session_state.last_server_feedback = server
                    st.success("Submitted. See feedback below.")
                except APIError as e:
                    st.error(str(e))

        c1, c2 = st.columns(2)
        with c1:
            st.markdown("**Local (optimistic) colors**")
            fb = st.session_state.last_local_feedback
            if fb:
                html = "".join(color_badge(x) for x in (fb.get("per_letter") or []))
                st.markdown(html, unsafe_allow_html=True)
        with c2:
            st.markdown("**Official server result**")
            fb = st.session_state.last_server_feedback
            if fb:
                html = "".join(color_badge(x) for x in (fb.get("per_letter") or []))
                st.markdown(html, unsafe_allow_html=True)
                if "total_correct_letters_so_far" in fb:
                    st.metric("Your total greens", fb["total_correct_letters_so_far"])

if __name__ == "__main__":
    main()
