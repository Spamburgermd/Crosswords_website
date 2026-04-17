# app/main.py
# Purpose: FastAPI application entry point. Run with:
#   uvicorn app.main:app --reload
#
# This server exposes endpoints for:
# - /auth/register, /auth/login
# - /games/create, /games/join
# - /games/{id}/submit_words, /games/{id}/state, /games/{id}/guess
#
# It uses a SQLite database by default and a simple API key "Authorization: Bearer <api_key>" for dev auth.

from fastapi import FastAPI
from .config import LOCAL_ONLY_MODE
from .db.session import init_db
from sqlmodel import select
from sqlalchemy import text
from sqlmodel import Session, select
from app.models.models import Game
from .routers import auth, games

app = FastAPI(title="CrosSwords Server", version="0.1.1" )

from fastapi import Request
from fastapi.responses import PlainTextResponse
import traceback

# ✅ Works without engine/SessionLocal; reuses your existing get_session() dependency.

def _borrow_session():
    """
    Borrow the FastAPI dependency-style DB session outside a request.
    This drives the generator so the same open/close logic is used.
    """
    gen = get_session()
    s = next(gen)  # get the yielded Session
    try:
        yield s
    finally:
        try:
            next(gen)  # let the generator finalize/close
        except StopIteration:
            pass

@app.exception_handler(Exception)
async def dev_all_errors(request: Request, exc: Exception):
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    return PlainTextResponse(f"{exc}\n\n{tb}", status_code=500)


# Include routers (grouped by feature)
app.include_router(auth.router)
app.include_router(games.router)

@app.on_event("startup")
def on_startup():
    # Create tables the first time the app starts
    init_db()
    

    """
    On startup, normalize any legacy rows where games.status is NULL → 'waiting'.
    This prevents clients from seeing status=None after /ready.
    """
    for s in _borrow_session():
        # Option A (ORM loop). Keep this if you prefer ORM objects:
        games = s.exec(select(Game)).all()
        changed = False
        for g in games:
            if not g.status:
                g.status = "waiting"
                changed = True
                s.add(g)
        if changed:
            s.commit()

@app.get("/")
def root():
    return {"ok": True, "service": "crosSwords-server", "docs": "/docs"}


# Tip: when launching uvicorn locally, you can reduce noise with:
#   uvicorn app.main:app --reload --log-level warning
# This pairs well with LOCAL_ONLY_MODE=True for quiet dev sessions.
