"""
TRIVAANA AI: Outbound Webhook Delivery & HMAC Signature Service
Delivers signed event payloads with timestamp validation, idempotency, and retry tracking.
"""

import hashlib
import hmac
import ipaddress
import json
import socket
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
import httpx
from core.vault import decrypt_secret


def _is_global_ip(ip: ipaddress._BaseAddress) -> bool:
    return (
        ip.is_global
        and not ip.is_private
        and not ip.is_loopback
        and not ip.is_link_local
        and not ip.is_reserved
        and not ip.is_multicast
    )


def is_safe_public_url(url: str) -> bool:
    """Prevent SSRF including DNS resolution to private/loopback/link-local networks."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False
        host = parsed.hostname.lower().strip(".")
        if host in ("localhost", "127.0.0.1", "0.0.0.0", "::1") or host.endswith((".local", ".internal")):
            return False
        try:
            ip = ipaddress.ip_address(host)
            return _is_global_ip(ip)
        except ValueError:
            pass

        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        try:
            addr_infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except OSError:
            # Allow test domains that fail DNS in offline CI only if not known-local, or fail closed
            return False
        if not addr_infos:
            return False
        for info in addr_infos:
            resolved_ip = ipaddress.ip_address(info[4][0])
            if not _is_global_ip(resolved_ip):
                return False
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
            raw_signing_secret = decrypt_secret(hook["signing_secret"])
            sig = sign_webhook_payload(raw_signing_secret, ts, body_str)
            delivery_id = f"whd_{uuid.uuid4().hex[:10]}"

            status_str = "failed"
            resp_code = None
            resp_body = ""
            if not is_safe_public_url(hook["url"]):
                resp_body = "Blocked unsafe or private webhook target URL"
            else:
                try:
                    resp = httpx.post(
                        hook["url"],
                        content=body_str,
                        headers={
                            "Content-Type": "application/json",
                            "X-Trivaana-Signature": sig,
                            "X-Trivaana-Timestamp": ts,
                            "X-Trivaana-Delivery-Id": delivery_id,
                            "X-Trivaana-Event": event_type,
                        },
                        timeout=6.0,
                        follow_redirects=False,
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

