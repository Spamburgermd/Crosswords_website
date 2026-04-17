from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlmodel import Session

from ..db.session import get_session
from ..models.models import Game, GamePlayer, MatchmakingEntry, Profile, User
from ..schemas.schemas import CreateGameOut
from ..services.auth_dep import require_user

router = APIRouter(prefix="/matchmaking", tags=["matchmaking"])


def _get_or_create_profile(session: Session, user: User) -> Profile:
    profile = session.get(Profile, user.id)
    if profile:
        return profile
    profile = Profile(user_id=user.id, display_name=user.username)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def _skill_for_user(session: Session, user: User) -> float:
    prof = _get_or_create_profile(session, user)
    return prof.skill_rating or 1000.0


def _match_candidate(
    session: Session, me: User, my_skill: float, skill_window: float
) -> Optional[MatchmakingEntry]:
    """
    Find the closest queued user within the skill window.
    """
    now = datetime.utcnow()
    rows = session.exec(
        select(MatchmakingEntry)
        .where(
            MatchmakingEntry.user_id != me.id,
            MatchmakingEntry.matched_game_id.is_(None),
            MatchmakingEntry.skill_rating.between(my_skill - skill_window, my_skill + skill_window),
        )
        .order_by(MatchmakingEntry.enqueued_at)
    ).all()
    if not rows:
        return None
    # pick the closest skill diff
    rows.sort(key=lambda r: abs(r.skill_rating - my_skill))
    return rows[0]


def _create_game_for_pair(session: Session, user_a: User, user_b: User) -> Game:
    game = Game(status="waiting", created_by_id=user_a.id, current_turn_user_id=None, start_at=None)
    session.add(game)
    session.flush()
    gp1 = GamePlayer(game_id=game.id, user_id=user_a.id, is_player1=True)
    gp2 = GamePlayer(game_id=game.id, user_id=user_b.id, is_player1=False)
    session.add(gp1)
    session.add(gp2)
    session.commit()
    session.refresh(game)
    return game


@router.post("/enqueue", response_model=CreateGameOut)
def enqueue_me(
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
    max_skill_window: float = 400.0,
):
    """
    Enqueue the caller for Quick Play. If a suitable opponent is found immediately, returns game_id.
    Otherwise returns game_id=0 (poll /status).
    """
    my_skill = _skill_for_user(session, me)

    existing = session.exec(select(MatchmakingEntry).where(MatchmakingEntry.user_id == me.id)).first()
    if existing and existing.matched_game_id:
        return CreateGameOut(game_id=existing.matched_game_id)
    if not existing:
        entry = MatchmakingEntry(user_id=me.id, skill_rating=my_skill)
        session.add(entry)
        session.commit()
    else:
        existing.enqueued_at = datetime.utcnow()
        existing.skill_rating = my_skill
        existing.matched_game_id = None
        existing.matched_with_user_id = None
        session.add(existing)
        session.commit()

    # Try to find a match right away
    candidate = _match_candidate(session, me, my_skill, max_skill_window)
    if candidate:
        other_user = session.get(User, candidate.user_id)
        if not other_user:
            session.delete(candidate)
            session.commit()
            return CreateGameOut(game_id=0)
        game = _create_game_for_pair(session, me, other_user)
        # Mark both entries as matched
        me_entry = session.exec(select(MatchmakingEntry).where(MatchmakingEntry.user_id == me.id)).first()
        for entry in (candidate, me_entry):
            if entry:
                entry.matched_game_id = game.id
                entry.matched_with_user_id = other_user.id if entry.user_id == me.id else me.id
                session.add(entry)
        session.commit()
        return CreateGameOut(game_id=game.id)

    return CreateGameOut(game_id=0)


@router.get("/status", response_model=CreateGameOut)
def status(session: Session = Depends(get_session), me: User = Depends(require_user)):
    """
    Check if the caller has been matched. If so, returns game_id and cleans up their queue entry.
    """
    entry = session.exec(select(MatchmakingEntry).where(MatchmakingEntry.user_id == me.id)).first()
    if not entry or not entry.matched_game_id:
        return CreateGameOut(game_id=0)
    game_id = entry.matched_game_id
    session.delete(entry)
    session.commit()
    return CreateGameOut(game_id=game_id)


@router.post("/dequeue", response_model=dict)
def dequeue(session: Session = Depends(get_session), me: User = Depends(require_user)):
    """
    Remove caller from the queue.
    """
    entry = session.exec(select(MatchmakingEntry).where(MatchmakingEntry.user_id == me.id)).first()
    if entry:
        session.delete(entry)
        session.commit()
    return {"ok": True}
