import importlib
import sys
import types

import pytest

GREEN_SQUARE = "█"
WHITE_SQUARE = "■"
BLACK_SQUARE = "·"


class _DummyColumn:
    def __init__(self, root):
        self.root = root

    def markdown(self, *_, **__):
        return None

    def button(self, label, **kwargs):
        self.root.button_labels.append(label)
        return False


class _DummyStreamlit(types.ModuleType):
    def __init__(self):
        super().__init__("streamlit")
        self.button_labels = []

    def columns(self, n, gap="small"):
        return [_DummyColumn(self) for _ in range(n)]

    def markdown(self, *_, **__):
        return None

    def button(self, label, **kwargs):
        self.button_labels.append(label)
        return False


@pytest.fixture()
def stub_streamlit(monkeypatch):
    dummy_st = _DummyStreamlit()
    monkeypatch.setitem(sys.modules, "streamlit", dummy_st)

    dummy_api = types.ModuleType("api_client_v0")
    dummy_api.API = object

    class _DummyAPIError(Exception):
        pass

    dummy_api.APIError = _DummyAPIError
    monkeypatch.setitem(sys.modules, "api_client_v0", dummy_api)

    dummy_random = types.ModuleType("app.utils.random_words")
    dummy_random.pick_random_wordset_from_twl = lambda require_placeable=True: ["TEST1", "TEST2", "TEST3", "TEST4", "TEST5"]
    monkeypatch.setitem(sys.modules, "app.utils.random_words", dummy_random)

    dummy_placement = types.ModuleType("app.game_logic.placement")

    def _fake_auto_place(words):
        placed = []
        for row, word in enumerate(words):
            coords = [[row, col] for col in range(len(word))]
            placed.append({"text": word, "orient": "H", "coords": coords})
        return {}, placed

    dummy_placement.auto_place_all_words = _fake_auto_place
    monkeypatch.setitem(sys.modules, "app.game_logic.placement", dummy_placement)

    sys.modules.pop("crosswords_ui_streamlit.client_streamlit_lobby_board_v1", None)
    yield dummy_st
    sys.modules.pop("crosswords_ui_streamlit.client_streamlit_lobby_board_v1", None)


def test_draw_masked_board_emits_expected_emojis(stub_streamlit):
    module = importlib.import_module("crosswords_ui_streamlit.client_streamlit_lobby_board_v1")

    module.draw_masked_board(
        opponent_masked=[{"coords": [[0, 0], [0, 1], [0, 2]], "orient": "H"}],
        revealed_coords=[[0, 0]],
    )

    labels = stub_streamlit.button_labels
    assert GREEN_SQUARE in labels
    assert WHITE_SQUARE in labels  # hidden opponent words
    assert BLACK_SQUARE in labels  # empty cells
