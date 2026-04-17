"""Tests for structured invalid-game-state error detail on submit_words and ready."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlmodel import SQLModel, Session, create_engine, select

from crosswords_server.app.models.models import Game, GamePlayer, User
from crosswords_server.app.routers.games import create_game, mark_ready, submit_words
from crosswords_server.app.schemas.schemas import SubmitWordsIn


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_ready_without_words_submitted_returns_structured_detail() -> None:
    """Call ready without submitting words -> 400 with structured detail."""
    with _session() as session:
        user = User(username="u1", password_hash="h", api_key="k1")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        game_id = result.game_id

        with pytest.raises(HTTPException) as exc_info:
            mark_ready(game_id, session=session, me=user)
        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert isinstance(detail, dict)
        assert detail.get("error") == "invalid_game_state"
        assert detail.get("action") == "ready"
        assert detail.get("status") == "waiting"
        assert detail.get("me", {}).get("words_submitted") is False
        assert "message" in detail


def test_submit_words_validation_failure_returns_structured_detail() -> None:
    """Submit invalid words (wrong lengths) -> 400 with structured detail."""
    with _session() as session:
        user = User(username="u2", password_hash="h", api_key="k2")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        game_id = result.game_id
        # Wrong format: need 2x4, 2x5, 1x6; pass five 5-letter words
        data = SubmitWordsIn(words=["HELLO", "WORLD", "APPLE", "GRAPE", "MUSIC"])

        with pytest.raises(HTTPException) as exc_info:
            submit_words(game_id, data, session=session, me=user)
        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert isinstance(detail, dict)
        assert detail.get("error") == "invalid_game_state"
        assert detail.get("action") == "submit_words"
        assert detail.get("status") == "waiting"
        assert "errors" in detail
        assert "message" in detail


def test_ready_when_game_active_returns_structured_detail() -> None:
    """Call ready when game status is active (invalid) -> 400 with structured detail."""
    with _session() as session:
        user = User(username="u3", password_hash="h", api_key="k3")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        game = session.get(Game, result.game_id)
        assert game is not None
        game.status = "active"
        session.add(game)
        session.commit()

        gp = session.exec(
            select(GamePlayer).where(
                GamePlayer.game_id == game.id, GamePlayer.user_id == user.id
            )
        ).first()
        if gp:
            gp.words_submitted = True
            gp.ready = False
            session.add(gp)
            session.commit()

        with pytest.raises(HTTPException) as exc_info:
            mark_ready(result.game_id, session=session, me=user)
        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert isinstance(detail, dict)
        assert detail.get("error") == "invalid_game_state"
        assert detail.get("action") == "ready"
        assert detail.get("status") == "active"


def test_submit_words_when_game_active_returns_structured_detail() -> None:
    """Submit words when game status is active (invalid) -> 400 with structured detail."""
    with _session() as session:
        user = User(username="u4", password_hash="h", api_key="k4")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        game = session.get(Game, result.game_id)
        assert game is not None
        game.status = "active"
        session.add(game)
        session.commit()

        data = SubmitWordsIn(words=["TEAM", "WORD", "APPLE", "GRAPE", "BUTTER"])

        with pytest.raises(HTTPException) as exc_info:
            submit_words(result.game_id, data, session=session, me=user)
        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert isinstance(detail, dict)
        assert detail.get("error") == "invalid_game_state"
        assert detail.get("action") == "submit_words"
        assert detail.get("status") == "active"
