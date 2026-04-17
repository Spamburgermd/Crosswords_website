from collections import Counter
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'crosswords_ui_streamlit'))

from app.utils.random_words import pick_random_wordset_from_twl
from app.game_logic.placement import auto_place_all_words
from crosswords_server.app.services import twl as server_twl
from crosswords_ui_streamlit.app.utils import random_words


def test_random_wordset_comes_from_twl_and_is_placeable():
    for _ in range(10000):
        # Ensure the random-word module sees the same TWL path as the server
        random_words.server_twl = server_twl
        words = pick_random_wordset_from_twl(require_placeable=True)
        assert len(words) == 5

        lengths = Counter(len(w) for w in words)
        assert lengths[4] == 2
        assert lengths[5] == 2
        assert lengths[6] == 1

        for w in words:
            assert w.isupper(), f"word {w!r} should be uppercase"
            assert server_twl.is_twl_word(w), f"word {w!r} not found in server TWL"

        letters, placed = auto_place_all_words(words)
        assert letters, "auto placer returned no letters"
        assert placed, "auto placer returned no layout"
