"""Tests for dictionary slot selection at game creation."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlmodel import SQLModel, Session, create_engine

from crosswords_server.app.models.models import Game, User
from crosswords_server.app.routers.games import create_game, game_state
from crosswords_server.app.schemas.schemas import CreateGameIn, DictionarySlotEnum


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_create_game_no_dictionary_slot_uses_standard() -> None:
    """Create game with no dictionary_slot -> uses STANDARD, succeeds."""
    with _session() as session:
        user = User(username="u1", password_hash="h", api_key="k1")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        assert result.game_id > 0

        game = session.get(Game, result.game_id)
        assert game is not None
        assert getattr(game, "dictionary_slot", None) in ("STANDARD", None)


def test_create_game_with_standard_succeeds() -> None:
    """Create game with dictionary_slot=STANDARD -> succeeds."""
    with _session() as session:
        user = User(username="u2", password_hash="h", api_key="k2")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=CreateGameIn(dictionary_slot=DictionarySlotEnum.STANDARD), session=session, me=user)
        assert result.game_id > 0
        game = session.get(Game, result.game_id)
        assert game is not None
        assert getattr(game, "dictionary_slot", "STANDARD") == "STANDARD"


def test_create_game_with_core_succeeds() -> None:
    """Create game with dictionary_slot=CORE -> succeeds and persists CORE."""
    with _session() as session:
        user = User(username="u2b", password_hash="h", api_key="k2b")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=CreateGameIn(dictionary_slot=DictionarySlotEnum.CORE), session=session, me=user)
        assert result.game_id > 0
        game = session.get(Game, result.game_id)
        assert game is not None
        assert getattr(game, "dictionary_slot", None) == "CORE"


def test_create_game_with_twl_alias_maps_to_canon() -> None:
    """Legacy TWL alias should persist as canonical CANON."""
    with _session() as session:
        user = User(username="u2c", password_hash="h", api_key="k2c")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=CreateGameIn(dictionary_slot=DictionarySlotEnum.TWL), session=session, me=user)
        assert result.game_id > 0
        game = session.get(Game, result.game_id)
        assert game is not None
        assert getattr(game, "dictionary_slot", None) == "CANON"


def test_create_game_with_slot_a_returns_400() -> None:
    """Create game with dictionary_slot=A -> returns 400 with clear message."""
    with _session() as session:
        user = User(username="u3", password_hash="h", api_key="k3")
        session.add(user)
        session.commit()
        session.refresh(user)

        with pytest.raises(HTTPException) as exc_info:
            create_game(data=CreateGameIn(dictionary_slot=DictionarySlotEnum.A), session=session, me=user)
        assert exc_info.value.status_code == 400
        assert "not enabled" in str(exc_info.value.detail).lower()


def test_game_state_includes_dictionary_slot() -> None:
    """GET /state includes dictionary_slot as STANDARD for default games."""
    with _session() as session:
        user = User(username="u4", password_hash="h", api_key="k4")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        state = game_state(result.game_id, session=session, me=user)
        assert hasattr(state, "dictionary_slot")
        assert state.dictionary_slot == "STANDARD"
