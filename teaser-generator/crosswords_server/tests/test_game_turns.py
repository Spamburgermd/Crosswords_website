"""Integration tests for the games router turn flow."""

from __future__ import annotations

from starlette.requests import Request
from sqlmodel import SQLModel, Session, create_engine

from crosswords_server.app.models.models import Game, User
from crosswords_server.app.routers.games import (
    create_game,
    game_state,
    join_game,
    make_guess,
    mark_ready,
    submit_words,
)
from crosswords_server.app.schemas.schemas import GuessIn, JoinGameIn, SubmitWordsIn

WORD_SET = ["LENT", "TAPE", "PLATE", "LEANT", "PLANET"]


def _request() -> Request:
    return Request({"type": "http", "method": "POST", "path": "/games/test/guess", "headers": []})

def _prepare_game(session: Session) -> tuple[int, User, User]:
    """Create an active game with two players ready to guess."""
    alice = User(username="alice_turn", password_hash="h", api_key="keyA")
    bob = User(username="bob_turn", password_hash="h", api_key="keyB")
    session.add_all([alice, bob])
    session.commit()
    session.refresh(alice)
    session.refresh(bob)

    gid = create_game(session=session, me=alice).game_id
    join_game(JoinGameIn(game_id=gid), session=session, me=bob)

    payload = SubmitWordsIn(words=WORD_SET)
    submit_words(gid, payload, session=session, me=alice)
    submit_words(gid, payload, session=session, me=bob)

    mark_ready(gid, session=session, me=alice)
    mark_ready(gid, session=session, me=bob)

    game = session.get(Game, gid)
    assert game is not None
    game.status = "active"
    game.current_turn_user_id = alice.id
    session.add(game)
    session.commit()
    return gid, alice, bob

def test_turn_alternation_stays_in_sync() -> None:
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        gid, alice, bob = _prepare_game(session)

        expected = alice.id
        for turn in range(20):
            game = session.get(Game, gid)
            assert game is not None
            if game.status == "finished":
                assert game.current_turn_user_id is None
                break
            assert game.current_turn_user_id == expected

            actor = session.get(User, expected)
            assert actor is not None

            idx = turn % 5
            guess = GuessIn(target_word_index=idx, guess_word=WORD_SET[idx])
            resp = make_guess(gid, guess, request=_request(), session=session, me=actor)
            assert resp["ok"] is True

            state_a = game_state(gid, session=session, me=alice)
            state_b = game_state(gid, session=session, me=bob)

            if state_a.status == "finished":
                assert state_a.current_turn_user_id is None
                assert state_b.current_turn_user_id is None
                break

            expected = alice.id if expected == bob.id else bob.id

            assert state_a.current_turn_user_id == expected
            assert state_b.current_turn_user_id == expected
