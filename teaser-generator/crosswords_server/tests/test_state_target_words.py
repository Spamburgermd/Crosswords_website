from __future__ import annotations

import sys
from pathlib import Path

from sqlmodel import SQLModel, Session, create_engine

# Ensure repo root on path so "crosswords_server" package resolves when tests run standalone.
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from crosswords_server.app.models.models import User
from crosswords_server.app.routers.games import bot_join_public, create_game, game_state


def _session() -> Session:
  engine = create_engine("sqlite:///:memory:")
  SQLModel.metadata.create_all(engine)
  return Session(engine)


def test_state_includes_target_words_and_dictionary_version() -> None:
  with _session() as session:
    user = User(username="u_words", password_hash="h", api_key="k_words")
    session.add(user)
    session.commit()
    session.refresh(user)

    result = create_game(data=None, session=session, me=user)
    bot_join_public(result.game_id, mode=None, session=session, me=user)
    state = game_state(result.game_id, session=session, me=user)
    data = state.model_dump()

    assert "target_words" in data
    assert data["target_words"] is None or isinstance(data["target_words"], list)
    # Bot join populates words for the bot; expect 5 words when available.
    if data["target_words"] is not None:
      assert len(data["target_words"]) == 5
    assert "dictionary_version" in data
