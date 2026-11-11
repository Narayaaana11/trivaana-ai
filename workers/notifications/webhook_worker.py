"""
TRIVAANA AI: Async Webhook Retry Worker
"""

from typing import Any, Dict
from services.webhook_service import WebhookService


def deliver_webhook_event(conn: Any, tenant_id: str, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    results = WebhookService.dispatch_event(conn, tenant_id, event_type, payload)
    return {"deliveries": results, "count": len(results)}

