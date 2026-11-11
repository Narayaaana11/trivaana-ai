"""
TRIVAANA AI: Database Connection Manager
Thread-safe SQLite WAL mode by default, with PostgreSQL (`psycopg`) dual-engine
compatibility adapter when DATABASE_URL is configured and psycopg is installed.
"""

import re
import sqlite3
from pathlib import Path
from typing import Any, Generator, Optional, Sequence
from core.config import settings


def _translate_sqlite_params(sql: str) -> str:
    """Translate SQLite `?` placeholders to PostgreSQL `%s` safely."""
    out = []
    in_single = False
    for ch in sql:
        if ch == "'":
            in_single = not in_single
            out.append(ch)
        elif ch == "?" and not in_single:
            out.append("%s")
        else:
            out.append(ch)
    translated = "".join(out)
    if re.search(r"\bINSERT\s+OR\s+IGNORE\s+INTO\b", translated, flags=re.I):
        translated = re.sub(r"\bINSERT\s+OR\s+IGNORE\s+INTO\b", "INSERT INTO", translated, flags=re.I)
        if "ON CONFLICT" not in translated.upper():
            translated = translated.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"
    return translated


class PostgresCompatCursor:
    def __init__(self, pg_cur: Any):
        self._cur = pg_cur

    def execute(self, sql: str, params: Sequence[Any] = ()) -> "PostgresCompatCursor":
        pg_sql = _translate_sqlite_params(sql)
        self._cur.execute(pg_sql, params or None)
        return self

    def executemany(self, sql: str, seq_of_params: Any) -> "PostgresCompatCursor":
        pg_sql = _translate_sqlite_params(sql)
        self._cur.executemany(pg_sql, seq_of_params)
        return self

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount

    @property
    def lastrowid(self) -> Any:
        return getattr(self._cur, "lastrowid", None)


class PostgresCompatConnection:
    """Presents sqlite3-compatible cursor/commit/close semantics backed by psycopg3."""

    engine_name = "postgresql"

    def __init__(self, pg_conn: Any):
        self._conn = pg_conn

    def cursor(self) -> PostgresCompatCursor:
        return PostgresCompatCursor(self._conn.cursor())

    def execute(self, sql: str, params: Sequence[Any] = ()) -> PostgresCompatCursor:
        cur = self.cursor()
        return cur.execute(sql, params)

    def executescript(self, sql_script: str) -> None:
        self._conn.execute(sql_script)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


def get_active_driver() -> str:
    if settings.has_postgres:
        try:
            import psycopg  # type: ignore  # noqa: F401
            return "psycopg"
        except ImportError:
            pass
    return "sqlite3"


def get_connection(db_path: Optional[Path] = None) -> Any:
    if db_path is None and settings.has_postgres:
        try:
            import psycopg  # type: ignore
            from psycopg.rows import dict_row  # type: ignore
            pg_conn = psycopg.connect(settings.DATABASE_URL, row_factory=dict_row)
            return PostgresCompatConnection(pg_conn)
        except Exception:
            if settings.ENVIRONMENT.lower() in ("production", "prod"):
                raise
            # Fall back cleanly to local SQLite WAL in dev/test when Postgres server isn't running
            pass

    target_path = str(db_path or settings.DATABASE_PATH)
    conn = sqlite3.connect(target_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn


def get_db() -> Generator[Any, None, None]:
    """FastAPI Dependency for database connection with automatic close."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
