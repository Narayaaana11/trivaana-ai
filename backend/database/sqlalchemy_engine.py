"""
TRIVAANA AI: SQLAlchemy 2 Engine, Session Factory & PostgreSQL RLS Context Manager
Provides pooled ORM/Core access across PostgreSQL 16 (production) and SQLite WAL (local/test).
"""

from typing import Generator, Optional
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from core.config import settings


class Base(DeclarativeBase):
    pass


def _resolve_sqlalchemy_url() -> str:
    if settings.has_postgres:
        url = settings.DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://") and "+psycopg" not in url:
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url
    return f"sqlite:///{settings.DATABASE_PATH}"


SQLALCHEMY_DATABASE_URL = _resolve_sqlalchemy_url()

_engine_kwargs = {"pool_pre_ping": True, "future": True}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def set_tenant_rls_context(session: Session, tenant_id: Optional[str]) -> None:
    """Bind PostgreSQL Row-Level Security tenant context for the current transaction."""
    if not tenant_id or SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        return
    session.execute(
        text("SELECT set_config('app.current_tenant_id', :tid, true)"),
        {"tid": tenant_id},
    )


def get_sa_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a pooled SQLAlchemy 2 Session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

