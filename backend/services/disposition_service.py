"""
TRIVAANA AI: Organization Disposition Code Mapping (Dograh Pattern)
Translates internal AI call outcomes (`interested`, `callback_required`, `not_interested`,
`do_not_call`, `voicemail`) into tenant-specific CRM/dialer disposition codes (`XFER`, `DNC`, `CBK`, etc.)
while preserving raw observed outcomes.
"""

import json
import sqlite3
from datetime import datetime, timezone
from typing import Dict, Optional

DEFAULT_DISPOSITION_MAP: Dict[str, str] = {
    "interested": "QUALIFIED",
    "qualified": "QUALIFIED",
    "callback_required": "CALLBACK",
    "not_interested": "CLOSED_LOST",
    "do_not_call": "DNC",
    "voicemail": "VM",
    "no-answer": "NA",
    "busy": "BUSY",
}


class DispositionService:
    @staticmethod
    def _ensure_table(conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS disposition_mappings (
                tenant_id TEXT PRIMARY KEY,
                mapping_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL
            )
            """
        )

    @staticmethod
    def get_mapping(conn: sqlite3.Connection, tenant_id: str) -> Dict[str, str]:
        DispositionService._ensure_table(conn)
        cur = conn.cursor()
        cur.execute("SELECT mapping_json FROM disposition_mappings WHERE tenant_id = ?", (tenant_id,))
        row = cur.fetchone()
        if not row or not row["mapping_json"]:
            return dict(DEFAULT_DISPOSITION_MAP)
        try:
            custom = json.loads(row["mapping_json"])
            if isinstance(custom, dict):
                return {str(k).strip().casefold(): str(v) for k, v in custom.items() if str(k).strip()}
        except Exception:
            pass
        return dict(DEFAULT_DISPOSITION_MAP)

    @staticmethod
    def save_mapping(conn: sqlite3.Connection, tenant_id: str, mapping: Dict[str, str]) -> Dict[str, str]:
        DispositionService._ensure_table(conn)
        normalized = {str(k).strip().casefold(): str(v).strip() for k, v in mapping.items() if str(k).strip()}
        now = datetime.now(timezone.utc).isoformat()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO disposition_mappings (tenant_id, mapping_json, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(tenant_id) DO UPDATE SET mapping_json = excluded.mapping_json, updated_at = excluded.updated_at
            """,
            (tenant_id, json.dumps(normalized), now),
        )
        conn.commit()
        return normalized

    @staticmethod
    def resolve_disposition(conn: sqlite3.Connection, tenant_id: str, outcome: Optional[str]) -> Optional[str]:
        if not outcome:
            return outcome
        mapping = DispositionService.get_mapping(conn, tenant_id)
        return mapping.get(outcome.strip().casefold(), outcome)
