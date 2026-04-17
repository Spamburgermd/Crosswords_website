"""
Tests for GET /games/{id}/state response contract: me and opponent are top-level siblings only.
Prevents regression where opponent is nested inside me.
"""

from __future__ import annotations

from sqlmodel import SQLModel, Session, create_engine

from crosswords_server.app.models.models import User
from crosswords_server.app.routers.games import bot_join_public, create_game, game_state


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_state_returns_top_level_me_and_opponent() -> None:
    """GET /games/{id}/state returns me and opponent as top-level keys; me does not contain opponent."""
    with _session() as session:
        user = User(username="u_state", password_hash="h", api_key="k_state")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        bot_join_public(result.game_id, mode=None, session=session, me=user)
        state = game_state(result.game_id, session=session, me=user)

    d = state.model_dump()
    assert "me" in d
    assert "opponent" in d
    assert "opponent" not in d["me"], "me must not contain nested opponent (contract: top-level siblings only)"
    assert d["me"] is not None
    assert isinstance(d["me"], dict)
    assert set(d["me"].keys()) <= {"user_id", "words_submitted", "ready"}
    assert d["opponent"] is None or isinstance(d["opponent"], dict)
    if d["opponent"] is not None:
        assert set(d["opponent"].keys()) <= {"user_id", "words_submitted", "ready"}


def test_state_single_player_opponent_null_until_joined() -> None:
    """Before bot join, opponent is None; after join, opponent is an object (no nesting in me)."""
    with _session() as session:
        user = User(username="u_solo", password_hash="h", api_key="k_solo")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        state_before = game_state(result.game_id, session=session, me=user)
        d_before = state_before.model_dump()
        assert "opponent" in d_before
        assert d_before["opponent"] is None
        assert "opponent" not in d_before["me"]

        bot_join_public(result.game_id, mode=None, session=session, me=user)
        state_after = game_state(result.game_id, session=session, me=user)
        d_after = state_after.model_dump()
        assert "opponent" in d_after
        assert d_after["opponent"] is not None
        assert "opponent" not in d_after["me"]
