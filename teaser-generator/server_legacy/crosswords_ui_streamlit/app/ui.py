# app/ui.py
# UI layer only — all game rules live in app/game_logic/*
# This file wires widgets to the logic functions in a Streamlit-friendly (and novice-friendly) way.

from __future__ import annotations

from typing import Dict, List, Set, Tuple
from html import escape
import re

import streamlit as st

try:
    from .utils.constants import GRID_SIZE, ROW_LABELS, COL_LABELS
    from .utils.random_words import pick_random_wordset_from_twl  # truly random from TWL + placeability check
    from .game_logic.validation import validate_wordset
    from .game_logic.placement import auto_place_all_words
    from .game_logic.scoring import (
        letters_in_other_words,
        wordle_feedback_with_board_blue,
        render_feedback_row,
        square_for,
    )
except ImportError:  # script run fallback
    from utils.constants import GRID_SIZE, ROW_LABELS, COL_LABELS
    from utils.random_words import pick_random_wordset_from_twl  # truly random from TWL + placeability check
    from game_logic.validation import validate_wordset
    from game_logic.placement import auto_place_all_words
    from game_logic.scoring import (
        letters_in_other_words,
        wordle_feedback_with_board_blue,
        render_feedback_row,
        square_for,
    )

# Type aliases (kept simple to avoid import-time issues on some Python versions)
Coord = Tuple[int, int]         # (row, col)
LettersMap = Dict[Coord, str]   # {(row, col): "A", ...}


# ------------------------------ State helpers ------------------------------ #

def new_player_state() -> Dict:
    """Return a fresh per-player state dict. We keep this small and serializable."""
    return {
        "stage": "enter_words",    # or "ready"
        "words": [],               # final chosen words (2x4, 2x5, 1x6)
        "letters": {},             # {(r,c): "A"} -> revealed board letters
        "placed": [],              # list of segments: {"text","coords","orient","start","end","solved"?}
        "words_confirmed": False,
    }


def init_game() -> None:
    """Initialize everything in session_state once per new game."""
    st.session_state.p1 = new_player_state()
    st.session_state.p2 = new_player_state()
    st.session_state.turn = 1
    st.session_state.game_over = False
    st.session_state.winner = None

    # Revealed coordinates per side (so opponent_view can show progress)
    st.session_state.revealed_p1 = set()
    st.session_state.revealed_p2 = set()

    st.session_state.blue_letters_p1 = set()
    st.session_state.blue_letters_p2 = set()

    # Marks (if you add marking tools later)
    st.session_state.marks_p1_on_p2 = {}  # {(r,c): code}
    st.session_state.marks_p2_on_p1 = {}

    # Histories for word and letter modes (organized by target word index)
    st.session_state.word_mode_history = {}
    st.session_state.letter_mode_history = {}
    st.session_state.overall_guess_log = []


# ------------------------------ Drawing helpers ---------------------------- #

def ensure_board_styles() -> None:
    """Inject shared CSS for the crossword board once per session."""
    if st.session_state.get('_board_styles_injected'):
        return
    st.markdown(
        """
        <style>
        .board-cell {
            border: 1px solid #3a3a3a;
            border-radius: 6px;
            text-align: center;
            font-weight: 700;
            font-size: 1.05rem;
            min-height: 2.2rem;
            padding: 0.15rem 0.1rem;
            background-color: #111822;
            color: #e6e6e6;
            transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .board-cell.cell-word-hidden {
            background-color: #0c1119;
            color: #394553;
        }
        .board-cell.cell-word-revealed {
            background-color: #2f9e44;
            border-color: #1e6d2d;
            color: #0d3918;
            text-shadow: 0 0 4px rgba(255, 255, 255, 0.35);
        }
        .board-cell.cell-word-revealed .board-letter {
            color: inherit;
        }
        .board-cell.cell-empty {
            background-color: #1a1f26;
            color: #3d4a5a;
        }
        .board-cell.cell-mark {
            font-size: 1.3rem;
            line-height: 1.2rem;
        }
        .board-row-label, .board-col-label {
            text-align: center;
            font-weight: 700;
            opacity: 0.7;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
    st.session_state['_board_styles_injected'] = True


def draw_board_crossword(
    letters: LettersMap,
    reveal_all: bool,
    title: str,
    revealed_hits: Set[Coord],
    marks: Dict[Coord, str],
    key_prefix: str,
) -> None:
    """Render the crossword board with revealed letters highlighted."""
    _ = key_prefix  # legacy parameter (grid now renders via HTML)
    ensure_board_styles()
    st.markdown(f"### {escape(title)}")

    header_cols = st.columns(GRID_SIZE + 1, gap="small")
    header_cols[0].markdown('&nbsp;', unsafe_allow_html=True)
    for ci, lbl in enumerate(COL_LABELS):
        header_cols[ci + 1].markdown(
            f"<div class='board-col-label'>{escape(lbl)}</div>",
            unsafe_allow_html=True,
        )

    def render_cell(content: str, classes: str, allow_html: bool = False) -> str:
        body = content if allow_html else escape(content)
        return f"<div class='board-cell {classes}'>{body}</div>"

    for r in range(GRID_SIZE):
        cols = st.columns(GRID_SIZE + 1, gap="small")
        cols[0].markdown(
            f"<div class='board-row-label'>{escape(ROW_LABELS[r])}</div>",
            unsafe_allow_html=True,
        )
        for c in range(GRID_SIZE):
            coord = (r, c)
            is_word_cell = coord in letters
            letter = letters.get(coord, ' ')
            revealed = reveal_all or (coord in revealed_hits)
            mark = marks.get(coord)

            if is_word_cell:
                if revealed and letter.strip():
                    content = f"<span class='board-letter'>{escape(letter)}</span>"
                    classes = 'cell-word-revealed'
                    allow_html = True
                else:
                    if mark:
                        content = square_for(mark)
                        classes = 'cell-word-hidden cell-mark'
                        allow_html = False
                    else:
                        content = square_for('W')
                        classes = 'cell-word-hidden'
                        allow_html = False
            else:
                if mark:
                    content = square_for(mark)
                    classes = 'cell-empty cell-mark'
                    allow_html = False
                else:
                    content = '&nbsp;'
                    classes = 'cell-empty'
                    allow_html = True

            cols[c + 1].markdown(
                render_cell(content, classes, allow_html=allow_html),
                unsafe_allow_html=True,
            )



def opponent_view(opp_key: str, revealed_hits: Set[Coord], marks: Dict[Coord, str]) -> None:
    """Convenience wrapper to render the opponent board."""
    opp = st.session_state[opp_key]
    draw_board_crossword(
        letters=opp["letters"],
        reveal_all=False,
        title="Opponent Crossword",
        revealed_hits=revealed_hits,
        marks=marks,
        key_prefix=f"{opp_key}_opp",
    )


# ------------------------------ Word entry page ---------------------------- #

def words_entry_ui(player_key: str) -> None:
    """
    Player word entry with safe session_state handling.

    Key ideas (important with Streamlit):
      • Initialize widget keys BEFORE creating inputs (so we can set them later).
      • Random-fill button occurs BEFORE inputs; if clicked, set values then st.rerun().
      • Never assign to a widget key after the widget has been instantiated in the same run.
    """
    st.subheader(f"{'Player 1' if player_key=='p1' else 'Player 2'} — Enter Your Words")

    # Define and initialize the 5 widget keys up front
    widget_keys = [f"{player_key}_w{i}_input" for i in range(5)]
    for k in widget_keys:
        st.session_state.setdefault(k, "")

    # Toolbar row: random + clear
    colA, colB = st.columns([1, 1])
    with colA:
        # Random fill (unique key per player to avoid collisions)
        btn_key = f"{player_key}_random_setup"
        if st.button("🎲 Use random TWL words", key=btn_key):
            try:
                # truly random from TWL, then checked against the actual placer
                rnd = pick_random_wordset_from_twl(require_placeable=True)
            except Exception as e:
                st.error(f"Random picker failed: {e}")
                st.stop()
            for i, k in enumerate(widget_keys):
                st.session_state[k] = rnd[i]
            st.rerun()
    with colB:
        if st.button("🧹 Clear all", key=f"{player_key}_clear"):
            for k in widget_keys:
                st.session_state[k] = ""
            st.rerun()

    # Render the 5 inputs (values come from session_state via 'key=' argument)
    cols = st.columns(5)
    for i, k in enumerate(widget_keys):
        with cols[i]:
            st.text_input(
                f"Word {i+1}",
                key=k,
                max_chars=6,
                help="A–Z only; allowed lengths: 4, 5, or 6",
            )

    # Read values safely after widgets exist; sanitize to letters-only uppercase
    entered = [st.session_state.get(k, "") for k in widget_keys]
    cleaned: List[str] = []
    for v in entered:
        vv = re.sub(r"[^A-Za-z]", "", (v or "")).upper()
        if vv:
            cleaned.append(vv)

    # Validate (2×4, 2×5, 1×6; unique; in TWL)
    err = validate_wordset(cleaned)
    if not err:
        st.success("Looks good: 2×4, 2×5, 1×6 — unique and TWL-valid.")
    else:
        st.warning(err)

    # Helpful preview of length counts (teaches users what’s missing)
    lengths = [len(w) for w in cleaned]
    counts = {L: lengths.count(L) for L in (4, 5, 6)}
    st.caption(f"Chosen lengths → 4: {counts.get(4,0)} • 5: {counts.get(5,0)} • 6: {counts.get(6,0)}")

    # Only enable when we *can* take exactly 2×4, 2×5, 1×6
    exact_counts_ready = counts.get(4, 0) >= 2 and counts.get(5, 0) >= 2 and counts.get(6, 0) >= 1
    disabled = bool(err) or not exact_counts_ready

    # Finalize: run the auto-placer from the logic module
    if st.button(
        "Validate & Auto-Place",
        type="primary",
        key=f"{player_key}_validate_btn",
        disabled=disabled,
    ):
        # Choose exactly the required counts in case the user typed extras
        chosen: List[str] = []
        for L, need_n in [(4, 2), (5, 2), (6, 1)]:
            chosen.extend([w for w in cleaned if len(w) == L][:need_n])

        result = auto_place_all_words(chosen)

        # Handle both tuple and accidental None, gracefully
        if not result or result[0] is None or result[1] is None:
            st.error(
                "Couldn’t auto-place your words within the grid constraints. "
                "Try different words, or click **🎲 Use random TWL words** again."
            )
            return

        letters, placed = result

        # Commit to this player’s state
        player = st.session_state[player_key]
        player["letters"] = letters
        player["placed"] = placed
        player["words_confirmed"] = True
        player["words"] = chosen
        player["stage"] = "ready"

        st.success("Words validated and placed! Player is now READY.")


# ------------------------------ Turn loop ---------------------------------- #

def game_ready() -> bool:
    """Both players must have completed setup to start the game."""
    return st.session_state.p1["stage"] == "ready" and st.session_state.p2["stage"] == "ready"


def handle_turn() -> None:
    """One turn of play: supports Word mode (Wordle-style) and Letters mode."""
    cur_key = "p1" if st.session_state.turn == 1 else "p2"
    opp_key = "p2" if cur_key == "p1" else "p1"

    st.subheader(f"Turn: {'Player 1' if cur_key=='p1' else 'Player 2'}")

    # Which sets/dicts track revealed squares & marks for the current attacker?
    revealed: Set[Coord] = st.session_state.revealed_p2 if cur_key == "p1" else st.session_state.revealed_p1
    marks: Dict[Coord, str] = st.session_state.marks_p1_on_p2 if cur_key == "p1" else st.session_state.marks_p2_on_p1

    opponent_view(opp_key, revealed, marks)

    if cur_key == 'p1':
        blue_letters = st.session_state.setdefault('blue_letters_p1', set())
    else:
        blue_letters = st.session_state.setdefault('blue_letters_p2', set())

    blue_summary = st.empty()

    def update_blue_summary() -> None:
        sorted_letters = sorted(blue_letters)
        if sorted_letters:
            blue_summary.markdown(
                "**Blue letters (elsewhere on the board):** "
                + " ".join(f"🟦{ch}" for ch in sorted_letters)
            )
        else:
            blue_summary.caption("Blue letters (elsewhere on the board): none yet.")

    update_blue_summary()

    def show_overall_history() -> None:
        history = st.session_state.get("overall_guess_log", [])
        with st.expander("All guesses this game", expanded=False):
            if not history:
                st.caption("No guesses yet.")
                return
            for idx, entry in enumerate(history, 1):
                player = entry.get("player") or "?"
                word_label = entry.get("word_label") or f"Word {entry.get('word_index', '?')}"
                mode = entry.get("mode")
                if mode == "word":
                    feedback_row = render_feedback_row(entry.get("feedback"), entry.get("guess"))
                    solved_note = " (solved)" if entry.get("solved") else ""
                    st.markdown(f"**{idx}.** P{player} - {word_label}{solved_note}\n{feedback_row}")
                elif mode == "letter":
                    letter = entry.get("letter", "?")
                    code = entry.get("code")
                    if code == "G":
                        hits = entry.get("positions") or []
                        if hits:
                            pos_text = ", ".join(str(pos) for pos in hits)
                            detail = f"revealed positions {pos_text}"
                        else:
                            detail = "revealed at least one position"
                    elif code == "B":
                        detail = "present elsewhere on the board"
                    else:
                        detail = "not present on the board"
                    st.markdown(f"**{idx}.** P{player} - {word_label} - letter {letter} -> {detail}")
                else:
                    st.markdown(f"**{idx}.** P{player} - {word_label}")

    opp = st.session_state[opp_key]
    placed = opp["placed"]
    if not placed:
        st.warning("Opponent has no placed words yet.")
        return

    # Build target dropdown entries from placed word segments
    word_options: List[str] = []
    word_labels: List[str] = []
    length_occurrence: Dict[int, int] = {}
    for i, seg in enumerate(placed):
        raw_text = (seg.get("text") or "").upper()
        length = len(raw_text)
        coords_list = seg.get("coords") or []
        if coords_list:
            start_y, start_x = coords_list[0]
            start_label = f"{COL_LABELS[start_x]}{ROW_LABELS[start_y]}"
        else:
            start_label = "?"
        orient_code = (seg.get("orient") or "?").upper()
        orient_label = "Across" if orient_code == "H" else ("Down" if orient_code == "V" else "?")
        revealed_count = sum(1 for coord in coords_list if coord in revealed)
        if seg.get("solved"):
            progress = "Solved"
        elif length and revealed_count:
            progress = f"{revealed_count}/{length} revealed"
        else:
            progress = "Not started"
        if length:
            length_occurrence[length] = length_occurrence.get(length, 0) + 1
            length_index = length_occurrence[length]
            length_label = f"{length}-letter #{length_index}"
        else:
            length_label = "Unplaced"
        base_label = f"Word {i + 1}: {length_label} | {orient_label} from {start_label}"
        word_labels.append(base_label)
        word_options.append(f"{base_label} | {progress}")

    target_index = st.selectbox(
        "Choose a word slot to target:",
        options=list(range(len(word_options))),
        format_func=lambda i: word_options[i],
        key=f"target_index_turn_{st.session_state.turn}",
    )

    target_label = word_labels[target_index]
    target_text = placed[target_index]["text"].upper()

    with st.expander("Feedback legend"):
        if st.session_state.get("word_mode", True):
            st.markdown(
                "- 🟩 **Green**: correct letter in the correct spot\n"
                "- 🟨 **Yellow**: letter is in this word but in a different spot\n"
                "- 🟦 **Blue**: letter is **not** in this word, but **is** on some other word on the board\n"
                "- ⬜ **Gray**: letter isn’t anywhere on the board"
            )
        else:
            st.markdown(
                "- **Letters mode**: enter a single letter.\n"
                "  - Hits reveal those letter positions on the board.\n"
                "  - If the letter is not in this word but appears elsewhere on the board → 🟦\n"
                "  - If the letter is nowhere on the board → ⬜"
            )

    # Branch by mode
    if st.session_state.get("word_mode", True):
        # === WORD (WORDLE-STYLE) MODE ===
        guess_input = st.text_input(
            f"Enter your {len(target_text)}-letter guess:",
            max_chars=len(target_text),
            key=f"word_guess_{target_index}_turn_{st.session_state.turn}",
        ).strip().upper()
        guess_input = re.sub(r"[^A-Z]", "", guess_input)

        # Per-target history
        hist = st.session_state.word_mode_history
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
                show_overall_history()
                return

            other_pool = letters_in_other_words(placed, exclude_index=target_index)
            codes = wordle_feedback_with_board_blue(guess_input, target_text, other_pool)

            st.markdown("**Result:** " + render_feedback_row(codes, guess_input))
            hist.setdefault(target_index, []).append((guess_input, codes))
            newly_blue = {ch for ch, code in zip(guess_input, codes) if code == 'B' and ch}
            if newly_blue:
                blue_letters.update(newly_blue)
                update_blue_summary()

            word_solved = all(c == "G" for c in codes)
            overall_log = st.session_state.setdefault("overall_guess_log", [])
            overall_log.append({
                "mode": "word",
                "player": 1 if cur_key == "p1" else 2,
                "word_index": target_index,
                "word_label": target_label,
                "guess": guess_input,
                "feedback": codes,
                "solved": word_solved,
            })

            # On a correct word, reveal all its coordinates and mark solved
            if word_solved:
                for (r, c), ch in zip(placed[target_index]["coords"], target_text):
                    opp["letters"][(r, c)] = ch
                    revealed.add((r, c))
                placed[target_index]["solved"] = True
                st.success("Correct! The word has been revealed on the board.")

            # Win condition
            if all(seg.get("solved") for seg in placed if seg.get("text")):
                st.session_state.game_over = True
                st.session_state.winner = 1 if cur_key == "p1" else 2
            else:
                st.session_state.turn = 2 if st.session_state.turn == 1 else 1

    else:
        # === LETTERS MODE ===
        letter = st.text_input(
            "Enter a single letter:",
            max_chars=1,
            key=f"letter_guess_{target_index}_turn_{st.session_state.turn}",
        ).strip().upper()
        letter = re.sub(r"[^A-Z]", "", letter)

        # Per-target letter history
        lhist = st.session_state.letter_mode_history
        lprior = lhist.get(target_index, [])
        with st.expander("Letter-guess history for this word", expanded=True):
            if not lprior:
                st.caption("No letter guesses yet.")
            else:
                for gi, (ltr, hits, code) in enumerate(lprior, 1):
                    if code == "G":
                        st.write(f"**{gi}.** {ltr} → hit at positions {', '.join(str(i+1) for i in hits)}")
                    elif code == "B":
                        st.write(f"**{gi}.** {ltr} → 🟦 (not in this word, but elsewhere on board)")
                    else:
                        st.write(f"**{gi}.** {ltr} → ⬜ (not on the board)")

        if st.button("Submit letter guess", key=f"submit_letter_guess_turn_{st.session_state.turn}"):
            if len(letter) != 1:
                st.error("Please enter exactly one letter (A-Z).")
                show_overall_history()
                return

            # Find all indices where the letter occurs in the target word
            hit_positions = [i for i, ch in enumerate(target_text) if ch == letter]
            overall_log = st.session_state.setdefault("overall_guess_log", [])

            if hit_positions:
                # Reveal those coordinates
                seg = placed[target_index]
                for idx in hit_positions:
                    (r, c) = seg["coords"][idx]
                    opp["letters"][(r, c)] = letter
                    revealed.add((r, c))
                revealed_pos = seg.setdefault("revealed_positions", set())
                revealed_pos.update(hit_positions)

                lhist.setdefault(target_index, []).append((letter, hit_positions, "G"))
                overall_log.append({
                    "mode": "letter",
                    "player": 1 if cur_key == "p1" else 2,
                    "word_index": target_index,
                    "word_label": target_label,
                    "letter": letter,
                    "code": "G",
                    "positions": [pos + 1 for pos in hit_positions],
                })
                st.success(f"Hit! Letter {letter} occurs at positions {', '.join(str(i+1) for i in hit_positions)}.")

                # If all letters revealed, consider the word solved
                if len(revealed_pos) == len(target_text):
                    seg["solved"] = True
                    st.success("You've revealed the full word!")

            else:
                # Not in this word - check the blue rule (elsewhere on board)
                other_pool = letters_in_other_words(placed, exclude_index=target_index)
                if letter in other_pool:
                    lhist.setdefault(target_index, []).append((letter, [], "B"))
                    blue_letters.add(letter)
                    overall_log.append({
                        "mode": "letter",
                        "player": 1 if cur_key == "p1" else 2,
                        "word_index": target_index,
                        "word_label": target_label,
                        "letter": letter,
                        "code": "B",
                    })
                    update_blue_summary()
                    st.info(f"🔵 {letter} is not in this word, but it appears in another word on the board.")
                else:
                    lhist.setdefault(target_index, []).append((letter, [], "W"))
                    overall_log.append({
                        "mode": "letter",
                        "player": 1 if cur_key == "p1" else 2,
                        "word_index": target_index,
                        "word_label": target_label,
                        "letter": letter,
                        "code": "W",
                    })
                    st.info(f"⬜ {letter} is not anywhere on the board.")

            # Win condition
            if all(seg.get("solved") for seg in placed if seg.get("text")):
                st.session_state.game_over = True
                st.session_state.winner = 1 if cur_key == "p1" else 2
            else:
                st.session_state.turn = 2 if st.session_state.turn == 1 else 1

    show_overall_history()


# ------------------------------ Page entry --------------------------------- #

def layout_builder() -> None:
    """Main page layout; call this from run.py (or app/app.py)."""
    st.set_page_config(page_title="🛳️ Wordship — Modular v0.6.7", page_icon="🛳️", layout="wide")
    st.title("🛳️ Wordship — Modular v0.6.7")
    st.caption("Two-player hotseat. Auto-placed TWL-checked crossword boards.")

    # Sidebar: Play mode toggle (persist in session_state so the whole app sees it)
    mode_label = st.sidebar.radio(
        "Play mode",
        ["Word (Wordle-style)", "Letters"],
        index=0 if st.session_state.get("word_mode", True) else 1,
        help="Word mode = guess the whole word like Wordle. Letters mode = guess one letter at a time.",
        key="play_mode_radio",
    )
    st.session_state["word_mode"] = (mode_label == "Word (Wordle-style)")

    # First-time initialization
    if "p1" not in st.session_state:
        init_game()

    if st.button("🔄 Reset Game", key="reset_game"):
        init_game()

    # Player setup expanders — call words_entry_ui() exactly once per player
    with st.expander("Player 1 Setup", expanded=st.session_state.p1["stage"] != "ready"):
        if st.session_state.p1["stage"] == "enter_words":
            words_entry_ui("p1")
        else:
            st.success("Player 1 is ready.")

    with st.expander("Player 2 Setup", expanded=st.session_state.p2["stage"] != "ready"):
        if st.session_state.p2["stage"] == "enter_words":
            words_entry_ui("p2")
        else:
            st.success("Player 2 is ready.")

    st.divider()

    # Turn loop
    if game_ready():
        if st.session_state.game_over:
            st.success(f"🏁 Game over! Winner: Player {st.session_state.winner}")
        else:
            handle_turn()
    else:
        st.info("Both players must enter words and finish auto-placement to start.")
