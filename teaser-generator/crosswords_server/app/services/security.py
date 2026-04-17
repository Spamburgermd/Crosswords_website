# app/services/security.py
# Purpose: simple auth helpers (NOT production-grade). For a real app use JWT.
import os, hashlib
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-change-me")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def make_api_key(username: str) -> str:
    # Simple API key derived from username + secret. For dev only.
    raw = f"{username}:{SECRET_KEY}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()
