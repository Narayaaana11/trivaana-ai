"""Initial Trivaana AI PostgreSQL + pgvector + RLS schema baseline

Revision ID: 0001_initial_pgvector_rls
Revises:
Create Date: 2026-11-11
"""

from pathlib import Path
from typing import Sequence, Union
from alembic import op
from database.schema import SCHEMA_SQL

revision: str = "0001_initial_pgvector_rls"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        ddl_path = Path(__file__).resolve().parents[2] / "database" / "postgres_pgvector_schema.sql"
        ddl = ddl_path.read_text(encoding="utf-8")
        for stmt in ddl.split(";"):
            cleaned = "\n".join(line for line in stmt.splitlines() if not line.strip().startswith("--")).strip()
            if cleaned:
                op.execute(cleaned)
    else:
        for stmt in SCHEMA_SQL.split(";"):
            cleaned = "\n".join(line for line in stmt.splitlines() if not line.strip().startswith("--")).strip()
            if cleaned:
                op.execute(cleaned)


def downgrade() -> None:
    pass

