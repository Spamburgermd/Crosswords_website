from fastapi import Depends, HTTPException, Request
from sqlmodel import Session, select
from ..db.session import get_session
from ..models.models import User
from ..config import LOCAL_ONLY_MODE

def _extract_api_key(request: Request) -> str | None:
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip() or None
    if LOCAL_ONLY_MODE:
        return request.query_params.get("api_key")
    return None

def require_user(request: Request, session: Session = Depends(get_session)) -> User:
    api_key = _extract_api_key(request)
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key (Authorization: Bearer ...)")
    user = session.exec(select(User).where(User.api_key == api_key)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key.")
    return user
