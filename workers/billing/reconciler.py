"""
TRIVAANA AI: Financial Reconciliation & Provider COGS Worker
"""

from datetime import datetime, timezone
import uuid
from typing import Any, Dict


def record_provider_cogs(
    conn: Any,
    tenant_id: str,
    call_id: str,
    category: str,
    provider_name: str,
    units: float,
    estimated_cost_paise: int,
) -> Dict[str, Any]:
    cost_id = f"cogs_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO provider_usage_costs (id, tenant_id, call_id, category, provider_name, units, estimated_cost_paise, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (cost_id, tenant_id, call_id, category, provider_name, units, estimated_cost_paise, now),
    )
    conn.commit()
    return {"id": cost_id, "estimated_cost_paise": estimated_cost_paise}

