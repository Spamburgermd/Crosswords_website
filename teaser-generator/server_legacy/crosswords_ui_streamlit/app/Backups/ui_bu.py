from __future__ import annotations  # (recommended on Py 3.10+ / 3.13)
import streamlit as st
from typing import Dict, Tuple, List, Set
from app.utils.constants import GRID_SIZE, ROW_LABELS, COL_LABELS
from app.utils.random_words import pick_random_valid_wordset
from app.utils.types import Coord, LettersMap
from app.game_logic.validation import is_twl_word, clean_word, validate_wordset
from app.game_logic.placement import auto_place_all_words
from app.game_logic.scoring import (
    letters_in_other_words, wordle_feedback_with_board_blue, render_feedback_row,
    cell_segments, all_letter_coords, feedback_for_guess, square_for
)

Coord = Tuple[int, int]

def new_player_state():
    return {
        "stage": "enter_words",
        "raw_words": ["","","","",""],
        "words": [],
        "letters": {},
        "placed": [],
        "words_confirmed": False,
    }

def init_game():
    st.session_state.p1 = new_player_state()
    st.session_state.p2 = new_player_state()
    st.session_state.turn = 1
    st.session_state.guess_history = []
    st.session_state.revealed_p1 = set()
    st.session_state.revealed_p2 = set()
    st.session_state.marks_p1_on_p2 = {}
    st.session_state.marks_p2_on_p1 = {}
    st.session_state.game_over = False
    st.session_state.winner = None
    st.session_state["word_mode"] = True

def draw_board_crossword(letters: Dict[Coord, str], reveal_all: bool, title: str, revealed_hits: Set[Coord], marks: Dict[Coord, str], key_prefix: str):
    st.markdown(f"### {title}")
    header_cols = st.columns(GRID_SIZE + 1, gap="small")
    header_cols[0].markdown("&nbsp;", unsafe_allow_html=True)
    for ci, lbl in enumerate(COL_LABELS):
        header_cols[ci + 1].markdown(f"<div style='text-align:center;font-weight:700;opacity:0.7'>{lbl}</div>", unsafe_allow_html=True)
    for r in range(GRID_SIZE):
        cols = st.columns(GRID_SIZE + 1, gap="small")
        cols[0].markdown(f"<div style='text-align:center;font-weight:700;opacity:0.7'>{ROW_LABELS[r]}</div>", unsafe_allow_html=True)
        for c in range(GRID_SIZE):
            coord = (r, c)
            is_word_cell = coord in letters
            ch = letters.get(coord, " ")
            revealed = (reveal_all or (coord in revealed_hits))
            if is_word_cell:
                if revealed and ch.strip():
                    label = ch
                else:
                    label = square_for(marks.get(coord)) if coord in marks else "⬜"
            else:
                label = square_for(marks.get(coord)) if coord in marks else "⬛"
            cols[c + 1].button(label, key=f"{key_prefix}_cell_{r}_{c}", use_container_width=True, disabled=True)

def opponent_view(opp_key: str, revealed_hits: Set[Coord], marks: Dict[Coord, str]):
    opp = st.session_state[opp_key]
    draw_board_crossword(opp["letters"], False, "Opponent Crossword", revealed_hits, marks, key_prefix=f"{opp_key}_opp")

def words_entry_ui(player_key: str):
    from collections import Counter
    import streamlit as st

    st.subheader(f"{'Player 1' if player_key=='p1' else 'Player 2'} — Enter Your Words")

    # --- Define the 5 widget keys up front
    widget_keys = [f"{player_key}_w{i}_input" for i in range(5)]

    # --- One-time defaults so the keys exist before widgets are created
    for k in widget_keys:
        st.session_state.setdefault(k, "")

    # ✅ Random-fill button must come BEFORE the text_input widgets
    if st.button("🎲 Use random valid words", key=f"{player_key}_random"):
        rnd = pick_random_valid_wordset()   # returns 5 strings (2x4, 2x5, 1x6)
        for i, k in enumerate(widget_keys):
            st.session_state[k] = rnd[i]
        st.rerun()  # rebuilds the page; on the next run, widgets will pick up these values

    # --- Now render the 5 inputs (do NOT assign to session_state after this)
    cols = st.columns(5)
    for i, k in enumerate(widget_keys):
        with cols[i]:
            st.text_input(
                f"Word {i+1}",
                key=k,
                max_chars=6,
                help="A–Z only; allowed lengths: 4, 5, or 6"
            )

    # --- Read the values from session_state (safe: widgets already exist)
    cleaned = []
    for k in widget_keys:
        v = st.session_state.get(k, "")
        v = "".join(ch for ch in v.upper() if "A" <= ch <= "Z")
        if v:
            cleaned.append(v)
    err = validate_wordset(cleaned)

    if not err:
        st.success("Looks good: 2×4, 2×5, 1×6 — unique and TWL-valid.")
    else:
        st.warning(err)

    if st.button("Validate & Auto-Place", type="primary", key=f"{player_key}_validate", disabled=bool(err)):
        words = []
        for L, need_n in [(4,2),(5,2),(6,1)]:
            words.extend([w for w in cleaned if len(w)==L][:need_n])

        letters, placed = auto_place_all_words(words)
        if letters is None:
            st.error("Couldn’t auto-place your words within the grid constraints. Try different words.")
            return

        player["letters"] = letters
        player["placed"] = placed
        player["words_confirmed"] = True
        player["words"] = words
        player["stage"] = "ready"
        st.success("Words validated and placed! Player is now READY.")

    # Quick-fill button for testing: pick a valid 2x4,2x5,1x6 set
    if st.button("🎲 Use random valid words", key=f"{player_key}_random"):
        rnd = pick_random_valid_wordset()
        # Persist into the five inputs respecting the expected order (2x4, 2x5, 1x6)
        # We'll just assign in order; you can reorder if you like.
        for i, w in enumerate(rnd):
            st.session_state[f"{player_key}_w{i}_input"] = w
        # Re-render the form with the new values
        st.experimental_rerun()


def game_ready() -> bool:
    return st.session_state.p1["stage"] == "ready" and st.session_state.p2["stage"] == "ready"

def handle_turn():
    cur_key = 'p1' if st.session_state.turn == 1 else 'p2'
    opp_key = 'p2' if cur_key == 'p1' else 'p1'

    st.subheader(f"Turn: {'Player 1' if cur_key=='p1' else 'Player 2'}")

    # Which sets/dicts track revealed squares & marks for the current attacker?
    revealed = st.session_state.revealed_p2 if cur_key=='p1' else st.session_state.revealed_p1
    marks = st.session_state.marks_p1_on_p2 if cur_key=='p1' else st.session_state.marks_p2_on_p1

    opponent_view(opp_key, revealed, marks)

    opp = st.session_state[opp_key]
    placed = opp["placed"]
    if not placed:
        st.warning("Opponent has no placed words yet.")
        return

    # Build target dropdown entries from placed word segments
    word_options = []
    for i, seg in enumerate(placed):
        if seg.get("coords"):
            start_y, start_x = seg["coords"][0]
            pretty_start = f"{COL_LABELS[start_x]}{ROW_LABELS[start_y]}"
        else:
            pretty_start = "?"
        word_options.append(f"{i+1}: {seg.get('orient','?')} len={len(seg.get('text',''))} starts {pretty_start}")

    target_index = st.selectbox(
        "Choose a word slot to target:",
        options=list(range(len(word_options))),
        format_func=lambda i: word_options[i],
        key=f"target_index_turn_{st.session_state.turn}"
    )
    target_text = placed[target_index]["text"].upper()

    # Branch by mode
    if st.session_state.get("word_mode", True):
        # === WORD (WORDLE-STYLE) MODE ===
        guess_input = st.text_input(
            f"Enter your {len(target_text)}-letter guess:",
            max_chars=len(target_text),
            key=f"word_guess_{target_index}_turn_{st.session_state.turn}"
        ).strip().upper()

        import re as _re
        guess_input = _re.sub(r"[^A-Z]", "", guess_input)

        # Show guess history for this word in this mode
        hist = st.session_state.setdefault("word_mode_history", {})
        prior = hist.get(target_index, [])
        with st.expander("Guess history for this word", expanded=True):
            if not prior:
                st.caption("No guesses yet. Your attempts will show here.")
            else:
                for gi, (g, codes_row) in enumerate(prior, 1):
                    st.markdown(f"**{gi}.** " + render_feedback_row(codes_row, g))

        if st.button("Submit whole-word guess", key=f"submit_word_guess_turn_{st.session_state.turn}"):
            if len(guess_input) != len(target_text):
                st.error(f"Please enter a {len(target_text)}-letter guess.")
                return

            # Build 'other letters' pool for the blue rule
            other_pool = letters_in_other_words(placed, exclude_index=target_index)
            codes = wordle_feedback_with_board_blue(guess_input, target_text, other_pool)
            st.markdown("**Result:** " + render_feedback_row(codes, guess_input))
            hist.setdefault(target_index, []).append((guess_input, codes))

            # On a correct word, reveal all its coordinates and mark solved
            if all(c == 'G' for c in codes):
                for (r, c), ch in zip(placed[target_index]["coords"], target_text):
                    opp["letters"][(r, c)] = ch
                    revealed.add((r, c))
                placed[target_index]["solved"] = True
                st.success("Correct! The word has been revealed on the board.")

            # Win condition
            if all(seg.get("solved") for seg in placed if seg.get("text")):
                st.session_state.game_over = True
                st.session_state.winner = 1 if cur_key == 'p1' else 2
            else:
                st.session_state.turn = 2 if st.session_state.turn == 1 else 1

    else:
        # === LETTERS MODE ===
        letter = st.text_input(
            "Enter a single letter:",
            max_chars=1,
            key=f"letter_guess_{target_index}_turn_{st.session_state.turn}"
        ).strip().upper()

        import re as _re
        letter = _re.sub(r"[^A-Z]", "", letter)

        # Show letter-guess history for this word
        lhist = st.session_state.setdefault("letter_mode_history", {})
        lprior = lhist.get(target_index, [])
        with st.expander("Letter-guess history for this word", expanded=True):
            if not lprior:
                st.caption("No letter guesses yet.")
            else:
                for gi, (ltr, hits, code) in enumerate(lprior, 1):
                    if code == 'G':
                        st.write(f"**{gi}.** {ltr} → hit at positions {hits}")
                    elif code == 'B':
                        st.write(f"**{gi}.** {ltr} → 🟦 (not in this word, but elsewhere on board)")
                    else:
                        st.write(f"**{gi}.** {ltr} → ⬜ (not on the board)")

        if st.button("Submit letter guess", key=f"submit_letter_guess_turn_{st.session_state.turn}"):
            if len(letter) != 1:
                st.error("Please enter exactly one letter (A–Z).")
                return

            # Find all positions in the target where this letter occurs
            hit_positions = [i for i, ch in enumerate(target_text) if ch == letter]

            if hit_positions:
                # Reveal those coordinates on the board
                for idx in hit_positions:
                    (r, c) = placed[target_index]["coords"][idx]
                    opp["letters"][(r, c)] = letter
                    revealed.add((r, c))
                placed[target_index].setdefault("revealed_positions", set()).update(hit_positions)

                lhist.setdefault(target_index, []).append((letter, hit_positions, 'G'))
                st.success(f"Hit! Letter {letter} occurs at positions {', '.join(str(i+1) for i in hit_positions)}.")

                # If all letters revealed, the word is solved
                if len(placed[target_index]["revealed_positions"]) == len(target_text):
                    placed[target_index]["solved"] = True
                    st.success("You’ve revealed the full word!")

            else:
                # If not in this word, check the blue rule (elsewhere on board?)
                other_pool = letters_in_other_words(placed, exclude_index=target_index)
                if letter in other_pool:
                    lhist.setdefault(target_index, []).append((letter, [], 'B'))
                    st.info(f"🟦 {letter} is not in this word, but it appears in another word on the board.")
                else:
                    lhist.setdefault(target_index, []).append((letter, [], 'W'))
                    st.info(f"⬜ {letter} is not anywhere on the board.")

            # Win condition
            if all(seg.get("solved") for seg in placed if seg.get("text")):
                st.session_state.game_over = True
                st.session_state.winner = 1 if cur_key == 'p1' else 2
            else:
                st.session_state.turn = 2 if st.session_state.turn == 1 else 1


def layout_builder():
    st.set_page_config(page_title="🛳️ Wordship — Modular v0.6.7", page_icon="🛳️", layout="wide")
    st.title("🛳️ Wordship — Modular v0.6.7")
    st.caption("Two-player hotseat. Auto-placed TWL-checked crossword boards.")

    # =========================
    # GAMEPLAY MODE TOGGLE
    # =========================
    mode_label = "Guessing Mode"
    mode_options = ["Letter mode (per-cell guesses)", "Wordle-style (whole word guesses)"]
    mode_choice = st.radio(
    mode_label,
    mode_options,
    index=0,
    help=(
        "Letter mode: pick a row/col, guess a single letter, get per-cell feedback.\\n"
        "Wordle-style: choose a placed word and guess the whole word; feedback uses green/yellow/gray + blue."
    ),
    key="guess_mode_radio"
    )
    st.session_state["word_mode"] = (mode_choice == "Wordle-style (whole word guesses)")

    if "p1" not in st.session_state:
        init_game()

    if st.button("🔄 Reset Game", key="reset_game"):
        init_game()

    with st.expander("Player 1 Setup", expanded=st.session_state.p1["stage"]!="ready"):
        if st.session_state.p1["stage"] == "enter_words":
            words_entry_ui("p1")
        else:
            st.success("Player 1 is ready.")

    with st.expander("Player 2 Setup", expanded=st.session_state.p2["stage"]!="ready"):
        if st.session_state.p2["stage"] == "enter_words":
            words_entry_ui("p2")
        else:
            st.success("Player 2 is ready.")

    st.divider()

    if game_ready():
        if st.session_state.game_over:
            st.success(f"🏁 Game over! Winner: Player {st.session_state.winner}")
        else:
            handle_turn()
    else:
        st.info("Both players must enter words and finish auto-placement to start.")
