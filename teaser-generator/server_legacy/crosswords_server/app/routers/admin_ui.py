from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.responses import HTMLResponse
from sqlalchemy import or_, and_
from sqlmodel import Session, select

from ..config import ADMIN_API_KEY, LOCAL_ONLY_MODE
from ..db.session import get_session
from ..models.models import FriendRequest, Friendship, Profile, User

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(admin_key: str | None = Header(default=None)) -> None:
    """
    Simple admin guard. Accepts X-Admin-Key header matching ADMIN_API_KEY,
    or in LOCAL_ONLY_MODE allows empty key (local dev convenience).
    """
    if LOCAL_ONLY_MODE:
        return
    if not ADMIN_API_KEY:
        raise HTTPException(403, "Admin UI disabled (ADMIN_API_KEY not set).")
    if admin_key != ADMIN_API_KEY:
        raise HTTPException(403, "Invalid admin key.")


@router.get("/friends", response_class=HTMLResponse)
def admin_friends_page(_: None = Depends(_require_admin)) -> Response:
    """Serve a minimal HTML page to inspect/manage friends and requests."""
    html = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Friends Admin</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 16px; background: #0f172a; color: #e2e8f0; }
    h1 { margin-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    th, td { border: 1px solid #334155; padding: 8px; text-align: left; }
    th { background: #1e293b; }
    button { margin-right: 6px; }
    .card { border: 1px solid #334155; padding: 12px; border-radius: 8px; margin-bottom: 16px; background: #111827; }
    input { padding: 6px; margin-right: 8px; }
  </style>
</head>
<body>
  <h1>Friends Admin</h1>
  <div class="card">
    <h3>Pending Requests</h3>
    <table id="req-table"><thead><tr><th>ID</th><th>From</th><th>To</th><th>Status</th><th>Actions</th></tr></thead><tbody></tbody></table>
  </div>
  <div class="card">
    <h3>Friendships</h3>
    <table id="friends-table"><thead><tr><th>User</th><th>Friend</th><th>Since</th><th>Actions</th></tr></thead><tbody></tbody></table>
  </div>
  <div class="card">
    <h3>Profiles (top 50)</h3>
    <table id="profiles-table"><thead><tr><th>User ID</th><th>Display Name</th><th>Last Active</th></tr></thead><tbody></tbody></table>
  </div>
  <script>
    const headers = { 'X-Admin-Key': '%(admin_key)s' };
    async function loadData() {
      const reqs = await fetch('/admin/friends/requests', { headers }).then(r => r.json());
      const tbody = document.querySelector('#req-table tbody');
      tbody.innerHTML = '';
      reqs.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.id}</td><td>${r.from_display_name} (${r.from_user_id})</td><td>${r.to_display_name} (${r.to_user_id})</td><td>${r.status}</td>`;
        const actions = document.createElement('td');
        ['accept','decline','cancel'].forEach(action => {
          const btn = document.createElement('button');
          btn.textContent = action;
          btn.onclick = async () => {
            await fetch(`/admin/friends/requests/${r.id}/${action}`, { method: 'POST', headers });
            loadData();
          };
          actions.appendChild(btn);
        });
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });

      const friends = await fetch('/admin/friends/list', { headers }).then(r => r.json());
      const ftbody = document.querySelector('#friends-table tbody');
      ftbody.innerHTML = '';
      friends.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${f.user_id}</td><td>${f.friend_user_id}</td><td>${f.created_at}</td>`;
        const actions = document.createElement('td');
        const btn = document.createElement('button');
        btn.textContent = 'remove both';
        btn.onclick = async () => {
          await fetch(`/admin/friends/${f.user_id}/${f.friend_user_id}`, { method: 'DELETE', headers });
          loadData();
        };
        actions.appendChild(btn);
        tr.appendChild(actions);
        ftbody.appendChild(tr);
      });

      const profiles = await fetch('/admin/friends/profiles', { headers }).then(r => r.json());
      const ptbody = document.querySelector('#profiles-table tbody');
      ptbody.innerHTML = '';
      profiles.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.user_id}</td><td>${p.display_name}</td><td>${p.last_active_at}</td>`;
        ptbody.appendChild(tr);
      });
    }
    loadData();
  </script>
</body>
</html>
    """
    # If ADMIN_API_KEY is empty and not LOCAL_ONLY_MODE, page will still be guarded by header check.
    return HTMLResponse(html.replace("%(admin_key)s", ADMIN_API_KEY or ""))


@router.get("/friends/profiles")
def admin_profiles(session: Session = Depends(get_session), _: None = Depends(_require_admin)):
    """List top profiles for quick inspection."""
    rows = session.exec(select(Profile).order_by(Profile.last_active_at.desc()).limit(50)).all()
    out = []
    for p in rows:
        out.append(
            {
                "user_id": p.user_id,
                "display_name": p.display_name,
                "avatar_url": p.avatar_url,
                "bio": p.bio,
                "last_active_at": p.last_active_at.isoformat(),
                "created_at": p.created_at.isoformat(),
            }
        )
    return out


@router.get("/friends/requests")
def admin_requests(session: Session = Depends(get_session), _: None = Depends(_require_admin)):
    """List friend requests (all)."""
    rows = session.exec(select(FriendRequest).order_by(FriendRequest.created_at.desc())).all()
    out = []
    for fr in rows:
        from_profile = session.get(Profile, fr.from_user_id)
        to_profile = session.get(Profile, fr.to_user_id)
        out.append(
            {
                "id": fr.id,
                "from_user_id": fr.from_user_id,
                "to_user_id": fr.to_user_id,
                "status": fr.status,
                "created_at": fr.created_at.isoformat(),
                "responded_at": fr.responded_at.isoformat() if fr.responded_at else None,
                "from_display_name": from_profile.display_name if from_profile else None,
                "to_display_name": to_profile.display_name if to_profile else None,
            }
        )
    return out


@router.post("/friends/requests/{request_id}/accept")
def admin_accept_request(request_id: int, session: Session = Depends(get_session), _: None = Depends(_require_admin)):
    fr = session.get(FriendRequest, request_id)
    if not fr or fr.status != "pending":
        raise HTTPException(404, "Pending request not found.")
    now = datetime.utcnow()
    fr.status = "accepted"
    fr.responded_at = now
    # create symmetric friendships
    pairs = [
        (fr.from_user_id, fr.to_user_id),
        (fr.to_user_id, fr.from_user_id),
    ]
    for u, f in pairs:
        existing = session.exec(
            select(Friendship).where(Friendship.user_id == u, Friendship.friend_user_id == f)
        ).first()
        if not existing:
            session.add(Friendship(user_id=u, friend_user_id=f, created_at=now))
    session.add(fr)
    session.commit()
    return {"ok": True}


@router.post("/friends/requests/{request_id}/decline")
def admin_decline_request(request_id: int, session: Session = Depends(get_session), _: None = Depends(_require_admin)):
    fr = session.get(FriendRequest, request_id)
    if not fr or fr.status != "pending":
        raise HTTPException(404, "Pending request not found.")
    fr.status = "declined"
    fr.responded_at = datetime.utcnow()
    session.add(fr)
    session.commit()
    return {"ok": True}


@router.post("/friends/requests/{request_id}/cancel")
def admin_cancel_request(request_id: int, session: Session = Depends(get_session), _: None = Depends(_require_admin)):
    fr = session.get(FriendRequest, request_id)
    if not fr or fr.status != "pending":
        raise HTTPException(404, "Pending request not found.")
    fr.status = "cancelled"
    fr.responded_at = datetime.utcnow()
    session.add(fr)
    session.commit()
    return {"ok": True}


@router.get("/friends/list")
def admin_friendships(session: Session = Depends(get_session), _: None = Depends(_require_admin)):
    rows = session.exec(select(Friendship)).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "friend_user_id": r.friend_user_id,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.delete("/friends/{user_id}/{friend_user_id}")
def admin_remove_friend(
    user_id: int, friend_user_id: int, session: Session = Depends(get_session), _: None = Depends(_require_admin)
):
    rows = session.exec(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_user_id == friend_user_id),
                and_(Friendship.user_id == friend_user_id, Friendship.friend_user_id == user_id),
            )
        )
    ).all()
    if not rows:
        raise HTTPException(404, "Friendship rows not found.")
    for r in rows:
        session.delete(r)
    session.commit()
    return {"ok": True}
