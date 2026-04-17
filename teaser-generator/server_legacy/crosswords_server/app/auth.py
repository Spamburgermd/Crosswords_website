"""Authentication router and dependency for CrosSwords."""

from __future__ import annotations

from datetime import datetime
import hashlib
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from .config import LOCAL_ONLY_MODE
from .db.session import get_session
from .models.models import User


class RegisterIn(BaseModel):
    username: str
    password: str


class LoginIn(BaseModel):
    username: str
    password: str


class AuthOut(BaseModel):
    user_id: int
    api_key: str


class MeOut(BaseModel):
    user_id: int
    username: str


router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_pw(password: str) -> str:
    """Hash the password with SHA-256 (swap for bcrypt/argon2 in production)."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _new_api_key() -> str:
    return secrets.token_hex(24)


def _extract_api_key(request: Request, authorization: Optional[str]) -> Optional[str]:
    """Extract an API key from Authorization header or query string."""
    if authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1].strip()

    if LOCAL_ONLY_MODE:
        token = request.query_params.get("api_key")
        if token:
            return token

    return None


def require_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
) -> User:
    token = _extract_api_key(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")

    user = session.exec(select(User).where(User.api_key == token)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key.")
    return user


@router.post("/register", response_model=AuthOut)
def register(data: RegisterIn, session: Session = Depends(get_session)) -> AuthOut:
    existing = session.exec(select(User).where(User.username == data.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists.")

    user = User(
        username=data.username,
        password_hash=_hash_pw(data.password),
        api_key=_new_api_key(),
        created_at=datetime.utcnow(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return AuthOut(user_id=user.id, api_key=user.api_key)


@router.post("/login", response_model=AuthOut)
def login(data: LoginIn, session: Session = Depends(get_session)) -> AuthOut:
    user = session.exec(select(User).where(User.username == data.username)).first()
    if not user or user.password_hash != _hash_pw(data.password):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    return AuthOut(user_id=user.id, api_key=user.api_key)


@router.get("/me", response_model=MeOut)
def me(current: User = Depends(require_user)) -> MeOut:
    return MeOut(user_id=current.id, username=current.username)
