"""Tests for DEBUG_REVEAL_SOLUTIONS: debug_bot_words in GET /games/{id}/state."""

from __future__ import annotations

import pytest
from sqlmodel import SQLModel, Session, create_engine

from crosswords_server.app.models.models import User
from crosswords_server.app.routers.games import bot_join_public, create_game, game_state


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_debug_bot_words_present_when_flag_on(monkeypatch: pytest.MonkeyPatch) -> None:
    """With DEBUG_REVEAL_SOLUTIONS=1, GET state returns debug_bot_words for bot games."""
    monkeypatch.setattr("crosswords_server.app.routers.games.DEBUG_REVEAL_SOLUTIONS", True)

    with _session() as session:
        user = User(username="u1", password_hash="h", api_key="k1")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        bot_join_public(result.game_id, mode=None, session=session, me=user)
        state = game_state(result.game_id, session=session, me=user)

        assert state.debug_bot_words is not None
        assert isinstance(state.debug_bot_words, list)
        assert len(state.debug_bot_words) == 5
        assert all(isinstance(w, str) for w in state.debug_bot_words)
        assert state.debug_solution_words is not None
        assert state.debug_solution_words == state.debug_bot_words


def test_debug_bot_words_none_when_flag_off(monkeypatch: pytest.MonkeyPatch) -> None:
    """With DEBUG_REVEAL_SOLUTIONS off, GET state does not include debug_bot_words."""
    monkeypatch.setattr("crosswords_server.app.routers.games.DEBUG_REVEAL_SOLUTIONS", False)

    with _session() as session:
        user = User(username="u2", password_hash="h", api_key="k2")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        bot_join_public(result.game_id, mode=None, session=session, me=user)
        state = game_state(result.game_id, session=session, me=user)

        assert state.debug_bot_words is None
        assert state.debug_solution_words is None
