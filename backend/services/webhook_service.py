"""
TRIVAANA AI: Outbound Webhook Delivery & HMAC Signature Service
Delivers signed event payloads with timestamp validation, idempotency, and retry tracking.
"""

import hashlib
import hmac
import ipaddress
import json
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
import requests


def is_safe_public_url(url: str) -> bool:
    """Prevent basic SSRF against localhost/private/link-local networks unless explicitly local test."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False
        host = parsed.hostname.lower()
        if host in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            return False
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        except ValueError:
            pass
        return True
    except Exception:
        return False


def sign_webhook_payload(secret: str, timestamp: str, payload_str: str) -> str:
    signed_content = f"{timestamp}.{payload_str}".encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), signed_content, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


class WebhookService:
    @staticmethod
    def dispatch_event(
        conn: sqlite3.Connection,
        tenant_id: str,
        event_type: str,
        payload: Dict[str, Any],
        idempotency_key: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM webhooks WHERE tenant_id = ? AND is_active = 1",
            (tenant_id,),
        )
        hooks = cur.fetchall()
        results: List[Dict[str, Any]] = []
        now = datetime.now(timezone.utc).isoformat()
        ts = str(int(time.time()))

        for hook in hooks:
            events = json.loads(hook["events_json"] or "[]")
            if events and "*" not in events and event_type not in events:
                continue

            idem = idempotency_key or f"{hook['id']}_{event_type}_{uuid.uuid4().hex[:10]}"
            cur.execute("SELECT id FROM webhook_deliveries WHERE idempotency_key = ?", (idem,))
            if cur.fetchone():
                continue

            envelope = {
                "id": idem,
                "event": event_type,
                "timestamp": now,
                "tenant_id": tenant_id,
                "data": payload,
            }
            body_str = json.dumps(envelope, separators=(",", ":"))
            sig = sign_webhook_payload(hook["signing_secret"], ts, body_str)
            delivery_id = f"whd_{uuid.uuid4().hex[:10]}"

            status_str = "failed"
            resp_code = None
            resp_body = ""
            if not is_safe_public_url(hook["url"]):
                resp_body = "Blocked unsafe or private webhook target URL"
            else:
                try:
                    resp = requests.post(
                        hook["url"],
                        data=body_str,
                        headers={
                            "Content-Type": "application/json",
                            "X-Trivaana-Signature": sig,
                            "X-Trivaana-Timestamp": ts,
                            "X-Trivaana-Delivery-Id": delivery_id,
                            "X-Trivaana-Event": event_type,
                        },
                        timeout=6.0,
                    )
                    resp_code = resp.status_code
                    resp_body = resp.text[:500]
                    status_str = "delivered" if 200 <= resp.status_code < 300 else "failed"
                except Exception as e:
                    resp_body = str(e)[:500]

            cur.execute(
                """
                INSERT INTO webhook_deliveries (
                    id, webhook_id, tenant_id, event_type, idempotency_key,
                    payload_json, response_status, response_body, status, attempt_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                """,
                (delivery_id, hook["id"], tenant_id, event_type, idem, body_str, resp_code, resp_body, status_str, now),
            )
            results.append({"delivery_id": delivery_id, "webhook_id": hook["id"], "status": status_str, "http_status": resp_code})

        conn.commit()
        return results

