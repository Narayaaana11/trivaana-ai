"""
TRIVAANA AI: Audit Logging & In-App Notification Service
Records tenant-scoped compliance, security, and operational audit trails.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class AuditService:
    @staticmethod
    def log_event(
        conn: sqlite3.Connection,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        actor_user_id: Optional[str] = None,
        actor_email: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        commit: bool = False,
    ) -> str:
        log_id = f"aud_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO audit_logs (
                id, tenant_id, actor_user_id, actor_email, action,
                resource_type, resource_id, metadata_json, ip_address, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                log_id,
                tenant_id,
                actor_user_id,
                actor_email,
                action,
                resource_type,
                resource_id,
                json.dumps(metadata or {}),
                ip_address,
                now,
            ),
        )
        if commit:
            conn.commit()
        return log_id

    @staticmethod
    def notify(
        conn: sqlite3.Connection,
        tenant_id: str,
        title: str,
        message: str,
        category: str = "system",
        severity: str = "info",
        user_id: Optional[str] = None,
        commit: bool = False,
    ) -> str:
        notif_id = f"ntf_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO notifications (
                id, tenant_id, user_id, category, title, message, severity, is_read, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
            """,
            (notif_id, tenant_id, user_id, category, title, message, severity, now),
        )
        if commit:
            conn.commit()
        return notif_id

