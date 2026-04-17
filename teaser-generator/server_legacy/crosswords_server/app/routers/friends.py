from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, and_, func
from sqlmodel import Session, select

from ..models.models import FriendRequest, Friendship, Profile, User, Game, GamePlayer
from ..schemas.schemas import (
    CreateGameOut,
    FriendOut,
    FriendRequestCreateIn,
    FriendRequestOut,
    FriendChallengeCreateIn,
    ProfileOut,
    ProfileUpdateIn,
)
from ..services.auth_dep import require_user
from ..db.session import get_session

router = APIRouter(prefix="/friends", tags=["friends"])


def _get_or_create_profile(session: Session, user: User) -> Profile:
    """Return the user's profile; create a default one when missing."""
    profile = session.get(Profile, user.id)
    if profile:
        return profile
    profile = Profile(user_id=user.id, display_name=user.username)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def _are_friends(session: Session, user_id: int, other_id: int) -> bool:
    """Check if two users have a confirmed friendship."""
    row = session.exec(
        select(Friendship).where(Friendship.user_id == user_id, Friendship.friend_user_id == other_id)
    ).first()
    return bool(row)


def _has_pending_request(session: Session, from_id: int, to_id: int) -> bool:
    """Check if there is an outstanding pending request in either direction."""
    row = session.exec(
        select(FriendRequest).where(
            FriendRequest.status == "pending",
            FriendRequest.from_user_id == from_id,
            FriendRequest.to_user_id == to_id,
        )
    ).first()
    if row:
        return True
    row = session.exec(
        select(FriendRequest).where(
            FriendRequest.status == "pending",
            FriendRequest.from_user_id == to_id,
            FriendRequest.to_user_id == from_id,
        )
    ).first()
    return bool(row)


@router.get("/profiles/me", response_model=ProfileOut)
def my_profile(session: Session = Depends(get_session), me: User = Depends(require_user)):
    """Fetch the caller's profile (creates a default if missing)."""
    profile = _get_or_create_profile(session, me)
    profile.last_active_at = datetime.utcnow()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.get("/profiles/{user_id}", response_model=ProfileOut)
def profile_detail(user_id: int, session: Session = Depends(get_session), me: User = Depends(require_user)):
    """Fetch another user's profile."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found.")
    profile = _get_or_create_profile(session, user)
    return profile


@router.patch("/profiles/me", response_model=ProfileOut)
def update_profile(
    data: ProfileUpdateIn,
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    """Update caller profile fields (display name, avatar, bio)."""
    profile = _get_or_create_profile(session, me)
    if data.display_name is not None:
        profile.display_name = data.display_name.strip() or me.username
    if data.avatar_url is not None:
        profile.avatar_url = data.avatar_url.strip() or None
    if data.bio is not None:
        profile.bio = data.bio.strip() or None
    profile.last_active_at = datetime.utcnow()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.post("/requests", response_model=FriendRequestOut)
def create_friend_request(
    data: FriendRequestCreateIn,
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    """Send a friend request to another user."""
    if data.to_user_id == me.id:
        raise HTTPException(400, "You cannot friend yourself.")
    target = session.get(User, data.to_user_id)
    if not target:
        raise HTTPException(404, "Target user not found.")
    if _are_friends(session, me.id, target.id):
        raise HTTPException(400, "You are already friends.")
    if _has_pending_request(session, me.id, target.id):
        raise HTTPException(400, "There is already a pending request between you.")

    fr = FriendRequest(from_user_id=me.id, to_user_id=target.id, status="pending")
    session.add(fr)
    session.commit()
    session.refresh(fr)

    from_profile = _get_or_create_profile(session, me)
    to_profile = _get_or_create_profile(session, target)
    return FriendRequestOut(
        id=fr.id,
        from_user_id=fr.from_user_id,
        to_user_id=fr.to_user_id,
        status=fr.status,
        created_at=fr.created_at,
        responded_at=fr.responded_at,
        from_display_name=from_profile.display_name,
        to_display_name=to_profile.display_name,
    )


@router.get("/requests", response_model=List[FriendRequestOut])
def list_requests(
    direction: Optional[str] = Query(None, description="in|out|all"),
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    """List friend requests for the caller."""
    query = select(FriendRequest)
    if direction == "in":
        query = query.where(FriendRequest.to_user_id == me.id)
    elif direction == "out":
        query = query.where(FriendRequest.from_user_id == me.id)
    else:
        query = query.where(
            (FriendRequest.to_user_id == me.id) | (FriendRequest.from_user_id == me.id)
        )
    query = query.order_by(FriendRequest.created_at.desc())
    rows = session.exec(query).all()

    out: List[FriendRequestOut] = []
    for fr in rows:
        from_profile = session.get(Profile, fr.from_user_id)
        to_profile = session.get(Profile, fr.to_user_id)
        out.append(
            FriendRequestOut(
                id=fr.id,
                from_user_id=fr.from_user_id,
                to_user_id=fr.to_user_id,
                status=fr.status,
                created_at=fr.created_at,
                responded_at=fr.responded_at,
                from_display_name=from_profile.display_name if from_profile else None,
                to_display_name=to_profile.display_name if to_profile else None,
            )
        )
    return out


def _accept_request(session: Session, request: FriendRequest) -> None:
    """Mark request accepted and create friendship rows both directions."""
    now = datetime.utcnow()
    request.status = "accepted"
    request.responded_at = now
    # create symmetric friendships if missing
    pairs = [
        (request.from_user_id, request.to_user_id),
        (request.to_user_id, request.from_user_id),
    ]
    for user_id, friend_id in pairs:
        existing = session.exec(
            select(Friendship).where(Friendship.user_id == user_id, Friendship.friend_user_id == friend_id)
        ).first()
        if not existing:
            session.add(Friendship(user_id=user_id, friend_user_id=friend_id, created_at=now))


@router.post("/requests/{request_id}/accept", response_model=FriendRequestOut)
def accept_request(
    request_id: int,
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    """Accept a friend request sent to the caller."""
    fr = session.get(FriendRequest, request_id)
    if not fr:
        raise HTTPException(404, "Request not found.")
    if fr.to_user_id != me.id:
        raise HTTPException(403, "You can only accept requests sent to you.")
    if fr.status != "pending":
        raise HTTPException(400, f"Request is already {fr.status}.")

    _accept_request(session, fr)
    session.add(fr)
    session.commit()
    session.refresh(fr)

    from_profile = session.get(Profile, fr.from_user_id)
    to_profile = session.get(Profile, fr.to_user_id)
    return FriendRequestOut(
        id=fr.id,
        from_user_id=fr.from_user_id,
        to_user_id=fr.to_user_id,
        status=fr.status,
        created_at=fr.created_at,
        responded_at=fr.responded_at,
        from_display_name=from_profile.display_name if from_profile else None,
        to_display_name=to_profile.display_name if to_profile else None,
    )


@router.post("/requests/{request_id}/decline", response_model=FriendRequestOut)
def decline_request(
    request_id: int,
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    """Decline a friend request sent to the caller."""
    fr = session.get(FriendRequest, request_id)
    if not fr:
        raise HTTPException(404, "Request not found.")
    if fr.to_user_id != me.id:
        raise HTTPException(403, "You can only decline requests sent to you.")
    if fr.status != "pending":
        raise HTTPException(400, f"Request is already {fr.status}.")

    fr.status = "declined"
    fr.responded_at = datetime.utcnow()
    session.add(fr)
    session.commit()
    session.refresh(fr)

    from_profile = session.get(Profile, fr.from_user_id)
    to_profile = session.get(Profile, fr.to_user_id)
    return FriendRequestOut(
        id=fr.id,
        from_user_id=fr.from_user_id,
        to_user_id=fr.to_user_id,
        status=fr.status,
        created_at=fr.created_at,
        responded_at=fr.responded_at,
        from_display_name=from_profile.display_name if from_profile else None,
        to_display_name=to_profile.display_name if to_profile else None,
    )


@router.post("/requests/{request_id}/cancel", response_model=FriendRequestOut)
def cancel_request(
    request_id: int,
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    """Cancel a pending request the caller previously sent."""
    fr = session.get(FriendRequest, request_id)
    if not fr:
        raise HTTPException(404, "Request not found.")
    if fr.from_user_id != me.id:
        raise HTTPException(403, "You can only cancel requests you sent.")
    if fr.status != "pending":
        raise HTTPException(400, f"Request is already {fr.status}.")

    fr.status = "cancelled"
    fr.responded_at = datetime.utcnow()
    session.add(fr)
    session.commit()
    session.refresh(fr)

    from_profile = session.get(Profile, fr.from_user_id)
    to_profile = session.get(Profile, fr.to_user_id)
    return FriendRequestOut(
        id=fr.id,
        from_user_id=fr.from_user_id,
        to_user_id=fr.to_user_id,
        status=fr.status,
        created_at=fr.created_at,
        responded_at=fr.responded_at,
        from_display_name=from_profile.display_name if from_profile else None,
        to_display_name=to_profile.display_name if to_profile else None,
    )


@router.get("/", response_model=List[FriendOut])
def list_friends(session: Session = Depends(get_session), me: User = Depends(require_user)):
    """List confirmed friends for the caller."""
    rows = session.exec(
        select(Friendship).where(Friendship.user_id == me.id).order_by(Friendship.created_at.desc())
    ).all()
    out: List[FriendOut] = []
    for fr in rows:
        prof = session.get(Profile, fr.friend_user_id)
        user = session.get(User, fr.friend_user_id)
        out.append(
            FriendOut(
                user_id=fr.friend_user_id,
                display_name=(prof.display_name if prof else (user.username if user else None)),
                since=fr.created_at,
            )
        )
    return out


@router.delete("/{friend_user_id}")
def remove_friend(friend_user_id: int, session: Session = Depends(get_session), me: User = Depends(require_user)):
    """Remove a friend (deletes both directions)."""
    if friend_user_id == me.id:
        raise HTTPException(400, "Cannot unfriend yourself.")
    removed = False
    rows = session.exec(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == me.id, Friendship.friend_user_id == friend_user_id),
                and_(Friendship.user_id == friend_user_id, Friendship.friend_user_id == me.id),
            )
        )
    ).all()
    for fr in rows:
        session.delete(fr)
        removed = True
    session.commit()
    if not removed:
        raise HTTPException(404, "Not friends.")
    return {"ok": True}


@router.get("/search", response_model=List[ProfileOut])
def search_profiles(
    query: str = Query(..., min_length=2, description="Partial display name or username"),
    limit: int = Query(10, ge=1, le=25),
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    """Simple profile search by display name (case-insensitive)."""
    q = query.strip()
    if not q:
        return []
    # ensure caller has a profile too
    _get_or_create_profile(session, me)
    rows = session.exec(
        select(Profile).where(func.lower(Profile.display_name).contains(q.lower())).limit(limit)
    ).all()
    return [
        ProfileOut(
            user_id=p.user_id,
            display_name=p.display_name,
            avatar_url=p.avatar_url,
            bio=p.bio,
            last_active_at=p.last_active_at,
            created_at=p.created_at,
        )
        for p in rows
    ]


@router.post("/challenge", response_model=CreateGameOut)
def challenge_friend(
    data: FriendChallengeCreateIn,
    session: Session = Depends(get_session),
    me: User = Depends(require_user),
):
    """
    Create a game with a friend. Both players are added immediately; each still submits words/ready.
    """
    if data.opponent_user_id == me.id:
        raise HTTPException(400, "Cannot challenge yourself.")
    opponent = session.get(User, data.opponent_user_id)
    if not opponent:
        raise HTTPException(404, "Opponent not found.")
    if not _are_friends(session, me.id, opponent.id):
        raise HTTPException(403, "You must be friends before challenging.")

    game = Game(status="waiting", created_by_id=me.id, current_turn_user_id=None, start_at=None)
    session.add(game)
    session.flush()

    p1 = GamePlayer(game_id=game.id, user_id=me.id, is_player1=True)
    p2 = GamePlayer(game_id=game.id, user_id=opponent.id, is_player1=False)
    session.add(p1)
    session.add(p2)
    session.commit()
    session.refresh(game)
    return CreateGameOut(game_id=game.id)
