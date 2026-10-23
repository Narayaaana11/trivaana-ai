"""
TRIVAANA AI: Database Connection Manager
Thread-Safe SQLite WAL Mode with Foreign Keys and Busy Timeout.
"""

import sqlite3
from pathlib import Path
from typing import Generator
from core.config import settings

def get_connection(db_path: Path = None) -> sqlite3.Connection:
    target_path = str(db_path or settings.DATABASE_PATH)
    conn = sqlite3.connect(target_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn

def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI Dependency for database connection with automatic close."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
