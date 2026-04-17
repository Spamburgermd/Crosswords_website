"""Tests for bot placement retry loop."""

from __future__ import annotations

import pytest
from sqlmodel import SQLModel, select, Session, create_engine

from crosswords_server.app.models.models import GamePlayer, User
from crosswords_server.app.routers.games import (
    _default_bot_words_seeded,
    _placement_seed,
    bot_join_public,
    create_game,
)
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


def test_placement_seed_is_deterministic_and_changes_with_attempts() -> None:
    seed = _placement_seed(42, "STANDARD", "normal", 0)
    assert seed == _placement_seed(42, "STANDARD", "normal", 0)
    retry_seeds = {_placement_seed(42, "STANDARD", "normal", attempt) for attempt in range(5)}
    assert len(retry_seeds) == 5
    assert _placement_seed(42, "STANDARD", "normal", 0) != _placement_seed(43, "STANDARD", "normal", 0)


def test_default_bot_words_seeded_is_deterministic_and_valid() -> None:
    words = _default_bot_words_seeded("STANDARD", 12345)
    assert words == _default_bot_words_seeded("STANDARD", 12345)
    assert len(words) == 5
    assert len(set(words)) == 5
    lengths = sorted(len(word) for word in words)
    assert lengths == [4, 4, 5, 5, 6]


def test_retry_attempts_do_not_reuse_the_same_candidate_wordset() -> None:
    attempts = [
        tuple(_default_bot_words_seeded("STANDARD", _placement_seed(77, "STANDARD", "normal", attempt)))
        for attempt in range(4)
    ]
    assert len(set(attempts)) == len(attempts)


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
