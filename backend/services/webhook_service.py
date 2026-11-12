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
from urllib.parse import urlparse, urlunparse
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


def resolve_safe_public_target(url: str) -> Optional[Dict[str, Any]]:
    """Validate public HTTP(S) URL and pin its resolved global IP to block SSRF/DNS rebinding."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return None
        host = parsed.hostname.lower().strip(".")
        if host in ("localhost", "127.0.0.1", "0.0.0.0", "::1") or host.endswith((".local", ".internal")):
            return None
        port = parsed.port or (443 if parsed.scheme == "https" else 80)

        pinned_ip: Optional[str] = None
        try:
            ip = ipaddress.ip_address(host)
            if not _is_global_ip(ip):
                return None
            pinned_ip = str(ip)
        except ValueError:
            try:
                addr_infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
            except OSError:
                return None
            if not addr_infos:
                return None
            ipv4_choice: Optional[str] = None
            any_choice: Optional[str] = None
            for info in addr_infos:
                resolved_ip = ipaddress.ip_address(info[4][0])
                if not _is_global_ip(resolved_ip):
                    return None
                if any_choice is None:
                    any_choice = str(resolved_ip)
                if info[0] == socket.AF_INET and ipv4_choice is None:
                    ipv4_choice = str(resolved_ip)
            pinned_ip = ipv4_choice or any_choice

        if not pinned_ip:
            return None
        bracketed = f"[{pinned_ip}]" if ":" in pinned_ip else pinned_ip
        pinned_netloc = f"{bracketed}:{port}"
        pinned_url = urlunparse(
            (parsed.scheme, pinned_netloc, parsed.path or "/", parsed.params, parsed.query, "")
        )
        return {
            "url": url,
            "scheme": parsed.scheme,
            "host": host,
            "netloc": parsed.netloc,
            "port": port,
            "ip": pinned_ip,
            "pinned_url": pinned_url,
        }
    except Exception:
        return None


def _extract_safe_host_header(url: str) -> str:
    """Return Host header value stripped of URL userinfo (user:pass@)."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().strip(".")
    if not host:
        return ""
    host_part = f"[{host}]" if ":" in host else host
    if parsed.port is not None:
        return f"{host_part}:{parsed.port}"
    return host_part


def is_safe_public_url(url: str) -> bool:
    """Prevent SSRF including DNS resolution to private/loopback/link-local networks."""
    return resolve_safe_public_target(url) is not None


def safe_http_request(
    method: str,
    url: str,
    *,
    content: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 6.0,
) -> httpx.Response:
    """Execute HTTP request pinned to validated public IP with preserved Host/SNI."""
    target = resolve_safe_public_target(url)
    if not target:
        raise ValueError("Blocked unsafe or private target URL")
    req_headers = dict(headers or {})
    safe_host = _extract_safe_host_header(url) or target["host"]
    req_headers["Host"] = safe_host
    extensions = {"sni_hostname": target["host"]} if target["scheme"] == "https" else None
    with httpx.Client(timeout=timeout, follow_redirects=False) as client:
        req = client.build_request(
            method,
            target["pinned_url"],
            content=content,
            headers=req_headers,
            extensions=extensions,
        )
        return client.send(req)


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

            safe_payload = dict(payload or {})
            if not hook["include_transcripts"]:
                safe_payload.pop("transcript", None)
                safe_payload.pop("transcripts", None)

            envelope = {
                "id": idem,
                "event": event_type,
                "timestamp": now,
                "tenant_id": tenant_id,
                "data": safe_payload,
            }
            body_str = json.dumps(envelope, separators=(",", ":"))
            raw_signing_secret = decrypt_secret(hook["signing_secret"])
            sig = sign_webhook_payload(raw_signing_secret, ts, body_str)
            delivery_id = f"whd_{uuid.uuid4().hex[:10]}"

            status_str = "failed"
            resp_code = None
            resp_body = ""
            attempt_count = 0
            max_attempts = max(1, min(3, int(hook["retry_limit"] or 1)))
            if not is_safe_public_url(hook["url"]):
                resp_body = "Blocked unsafe or private webhook target URL"
                attempt_count = 1
            else:
                headers = {
                    "Content-Type": "application/json",
                    "X-Trivaana-Signature": sig,
                    "X-Trivaana-Timestamp": ts,
                    "X-Trivaana-Delivery-Id": delivery_id,
                    "X-Trivaana-Event": event_type,
                }
                for _attempt in range(max_attempts):
                    attempt_count += 1
                    try:
                        resp = safe_http_request("POST", hook["url"], content=body_str, headers=headers, timeout=6.0)
                        resp_code = resp.status_code
                        resp_body = resp.text[:500]
                        if 200 <= resp.status_code < 300:
                            status_str = "delivered"
                            break
                        status_str = "failed"
                        if 400 <= resp.status_code < 500:
                            break
                    except Exception as e:
                        resp_body = str(e)[:500]

            cur.execute(
                """
                INSERT INTO webhook_deliveries (
                    id, webhook_id, tenant_id, event_type, idempotency_key,
                    payload_json, response_status, response_body, status, attempt_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (delivery_id, hook["id"], tenant_id, event_type, idem, body_str, resp_code, resp_body, status_str, attempt_count, now),
            )
            results.append({"delivery_id": delivery_id, "webhook_id": hook["id"], "status": status_str, "http_status": resp_code})

        conn.commit()
        return results

