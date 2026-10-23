from database.connection import get_connection, get_db
from database.schema import create_tables
from database.seed import seed_database

def init_db(db_path=None):
    """Initializes tables and seeds default presets."""
    conn = get_connection(db_path)
    create_tables(conn)
    seed_database(conn)
    conn.close()

__all__ = ["get_connection", "get_db", "init_db"]
