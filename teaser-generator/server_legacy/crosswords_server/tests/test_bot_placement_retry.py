"""Tests for bot placement retry loop."""

from __future__ import annotations

import pytest
from sqlmodel import SQLModel, select, Session, create_engine

from crosswords_server.app.models.models import GamePlayer, User
from crosswords_server.app.routers.games import bot_join_public, create_game
from crosswords_server.app.services.placement import auto_place_all_words


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_bot_join_public_smoke() -> None:
    """bot_join_public returns 200 when placement succeeds."""
    with _session() as session:
        user = User(username="u1", password_hash="h", api_key="k1")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        resp = bot_join_public(result.game_id, mode=None, session=session, me=user)

        assert resp["ok"] is True
        assert "bot_user_id" in resp
        gp = session.exec(
            select(GamePlayer).where(
                GamePlayer.game_id == result.game_id, GamePlayer.user_id == resp["bot_user_id"]
            )
        ).first()
        assert gp is not None
        assert gp.words_submitted is True


def test_bot_join_retry_loop_exercised(monkeypatch: pytest.MonkeyPatch) -> None:
    """Placement fails N-1 times then succeeds; bot_join_public returns 200 after retries."""
    call_count: list[int] = [0]
    original_place = auto_place_all_words

    def mock_place(words):
        call_count[0] += 1
        if call_count[0] < 3:
            return None, None
        return original_place(words)

    monkeypatch.setattr(
        "crosswords_server.app.routers.games.auto_place_all_words",
        mock_place,
    )

    with _session() as session:
        user = User(username="u2", password_hash="h", api_key="k2")
        session.add(user)
        session.commit()
        session.refresh(user)

        result = create_game(data=None, session=session, me=user)
        resp = bot_join_public(result.game_id, mode="normal", session=session, me=user)

        assert resp["ok"] is True
        assert call_count[0] >= 3, "Placement should have been attempted at least 3 times"
