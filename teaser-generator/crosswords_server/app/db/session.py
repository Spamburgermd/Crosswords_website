from __future__ import annotations

from sqlalchemy import text
from sqlmodel import SQLModel, Session, create_engine
from ..config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


def _migrate_dictionary_slot() -> None:
    """Add dictionary_slot column to game table if missing (for existing DBs)."""
    try:
        with engine.connect() as conn:
            conn.execute(text(
                "ALTER TABLE game ADD COLUMN dictionary_slot VARCHAR DEFAULT 'STANDARD'"
            ))
            conn.commit()
    except Exception:
        pass  # column likely already exists


def init_db() -> None:
    from ..models import models as _  # register tables
    SQLModel.metadata.create_all(engine)
    try:
        _migrate_dictionary_slot()
    except Exception:
        pass


def get_session():
    with Session(engine) as session:
        yield session
