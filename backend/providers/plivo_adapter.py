"""
TRIVAANA AI: Plivo Telephony Adapter (India & Global SIP/PSTN)
Implements outbound dialing, bidirectional Stream XML, HMAC-SHA256 V2/V3 signature verification,
owned-number verification, and status callback parsing.
"""

import base64
import hashlib
import hmac
from typing import Any, Dict, List, Optional
import requests

from core.config import settings
from providers.base import BaseTelephonyProvider, CallDispatchResult, CallStatusEvent


class PlivoTelephonyProvider(BaseTelephonyProvider):
    name = "plivo"

    def __init__(
        self,
        auth_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        caller_id: Optional[str] = None,
    ):
        self.auth_id = auth_id or settings.PLIVO_AUTH_ID
        self.auth_token = auth_token or settings.PLIVO_AUTH_TOKEN
        self.caller_id = caller_id or settings.PLIVO_PHONE_NUMBER
        self.base_url = f"https://api.plivo.com/v1/Account/{self.auth_id}"

    @property
    def is_configured(self) -> bool:
        return bool(self.auth_id and self.auth_token and self.caller_id)

    def build_stream_token(self, call_id: str) -> str:
        secret = (self.auth_token or settings.JWT_SECRET).encode("utf-8")
        return hmac.new(secret, f"plivo_stream:{call_id}".encode("utf-8"), hashlib.sha256).hexdigest()

    def build_callback_token(self, call_id: str) -> str:
        secret = (self.auth_token or settings.JWT_SECRET).encode("utf-8")
        return hmac.new(secret, f"plivo_cb:{call_id}".encode("utf-8"), hashlib.sha256).hexdigest()

    def initiate_call(
        self,
        to_phone: str,
        from_phone: Optional[str] = None,
        webhook_url: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> CallDispatchResult:
        if not self.is_configured:
            return CallDispatchResult(
                success=False,
                provider="plivo",
                status="failed",
                error_message="Plivo credentials (PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_PHONE_NUMBER) not configured",
            )

        call_id = (extra_data or {}).get("call_id", "")
        base_url = settings.PUBLIC_BASE_URL.rstrip("/")
        cb_tok = self.build_callback_token(call_id) if call_id else ""
        answer_url = (
            f"{base_url}/api/calls/plivo-xml/{call_id}?plivo_auth={cb_tok}"
            if call_id
            else f"{base_url}/api/calls/plivo-xml/default"
        )
        status_url = webhook_url or (
            f"{base_url}/api/calls/callback/{call_id}?plivo_auth={cb_tok}" if call_id else ""
        )

        payload: Dict[str, Any] = {
            "from": (from_phone or self.caller_id).lstrip("+"),
            "to": to_phone.lstrip("+"),
            "answer_url": answer_url,
            "answer_method": "POST",
        }
        if status_url:
            payload["hangup_url"] = status_url
            payload["hangup_method"] = "POST"
            payload["ring_url"] = status_url
            payload["ring_method"] = "POST"

        try:
            resp = requests.post(
                f"{self.base_url}/Call/",
                auth=(self.auth_id, self.auth_token),
                json=payload,
                timeout=10.0,
            )
            data = resp.json() if resp.content else {}
            req_uuid = data.get("request_uuid") or data.get("call_uuid")
            if resp.status_code in (200, 201, 202) and req_uuid:
                return CallDispatchResult(
                    success=True,
                    provider="plivo",
                    provider_call_id=str(req_uuid),
                    status="initiated",
                    raw_response=data,
                )
            return CallDispatchResult(
                success=False,
                provider="plivo",
                status="failed",
                error_message=data.get("error", f"Plivo error: {resp.text}"),
                raw_response=data,
            )
        except Exception as exc:
            return CallDispatchResult(
                success=False,
                provider="plivo",
                status="failed",
                error_message=f"Network exception connecting to Plivo: {exc}",
            )

    def terminate_call(self, provider_call_id: str) -> bool:
        if not self.is_configured or not provider_call_id:
            return False
        try:
            resp = requests.delete(
                f"{self.base_url}/Call/{provider_call_id}/",
                auth=(self.auth_id, self.auth_token),
                timeout=5.0,
            )
            return resp.status_code in (200, 204)
        except Exception:
            return False

    def verify_phone_numbers(self) -> Dict[str, Any]:
        """Verify owned Plivo numbers via Plivo Number API."""
        if not self.is_configured:
            return {"verified": False, "numbers": [], "error": "Plivo credentials not configured"}
        try:
            resp = requests.get(
                f"{self.base_url}/Number/",
                auth=(self.auth_id, self.auth_token),
                timeout=8.0,
            )
            if resp.status_code == 200:
                objects: List[Dict[str, Any]] = resp.json().get("objects", [])
                return {
                    "verified": True,
                    "numbers": [obj.get("number") for obj in objects if obj.get("number")],
                }
            return {"verified": False, "numbers": [], "error": f"Plivo returned {resp.status_code}"}
        except Exception as exc:
            return {"verified": False, "numbers": [], "error": str(exc)}

    def verify_request(self, headers: Dict[str, str], params: Dict[str, Any], url: Optional[str] = None) -> bool:
        # 1. Plivo Signature V2 / V3 check (HMAC-SHA256 base64, requires auth_token)
        if self.auth_token:
            lower_headers = {k.lower(): v for k, v in headers.items()}
            sig_v2 = lower_headers.get("x-plivo-signature-v2")
            nonce_v2 = lower_headers.get("x-plivo-signature-v2-nonce")
            if sig_v2 and nonce_v2 and url:
                base = url.split("?")[0] + nonce_v2
                expected_v2 = base64.b64encode(
                    hmac.new(self.auth_token.encode("utf-8"), base.encode("utf-8"), hashlib.sha256).digest()
                ).decode("utf-8")
                if hmac.compare_digest(expected_v2, sig_v2):
                    return True

            sig_v3 = lower_headers.get("x-plivo-signature-v3")
            nonce_v3 = lower_headers.get("x-plivo-signature-v3-nonce")
            if sig_v3 and nonce_v3 and url:
                filtered = {k: v for k, v in params.items() if k not in ("_call_id", "plivo_auth")}
                sorted_kv = "".join(f"{k}{filtered[k]}" for k in sorted(filtered.keys()))
                payload_str = f"{url.split('?')[0]}{sorted_kv}.{nonce_v3}"
                expected_v3 = base64.b64encode(
                    hmac.new(self.auth_token.encode("utf-8"), payload_str.encode("utf-8"), hashlib.sha256).digest()
                ).decode("utf-8")
                if hmac.compare_digest(expected_v3, sig_v3):
                    return True

        # 2. Capability HMAC token minted on callback/answer XML URL
        plivo_auth = params.get("plivo_auth")
        call_id = params.get("_call_id") or ""
        if plivo_auth and call_id:
            expected_tok = self.build_callback_token(str(call_id))
            if hmac.compare_digest(expected_tok, str(plivo_auth)):
                return True

        return False

    def verify_webhook(self, headers: Dict[str, str], raw_body: bytes) -> bool:
        return self.verify_request(headers, {})

    def generate_stream_xml(self, call_id: str, language: str = "te-IN") -> str:
        base_url = settings.PUBLIC_BASE_URL.rstrip("/")
        ws_base = base_url.replace("https://", "wss://").replace("http://", "ws://")
        token = self.build_stream_token(call_id)
        ws_url = f"{ws_base}/api/calls/stream/{call_id}?provider=plivo&amp;token={token}"
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            "<Response>\n"
            '    <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">'
            f"{ws_url}</Stream>\n"
            "</Response>"
        )

    def parse_webhook_event(self, headers: Dict[str, str], payload: Dict[str, Any]) -> CallStatusEvent:
        call_uuid = payload.get("CallUUID") or payload.get("RequestUUID") or ""
        raw_status = (payload.get("CallStatus") or payload.get("HangupCause") or "completed").lower()
        status_map = {
            "ringing": "ringing",
            "in-progress": "connected",
            "completed": "completed",
            "normal_clearing": "completed",
            "busy": "busy",
            "user_busy": "busy",
            "no-answer": "no-answer",
            "no_answer": "no-answer",
            "cancel": "cancelled",
            "failed": "failed",
        }
        duration = int(payload.get("Duration") or payload.get("BillDuration") or 0)
        return CallStatusEvent(
            provider="plivo",
            provider_call_id=str(call_uuid),
            status=status_map.get(raw_status, "completed"),
            duration_seconds=duration,
            recording_url=payload.get("RecordUrl") or payload.get("RecordingUrl"),
            raw_payload=payload,
        )

    def transfer_call(self, provider_call_id: str, to_phone: str) -> Dict[str, Any]:
        if not self.is_configured:
            return {
                "supported": True,
                "success": False,
                "status": "not_configured",
                "provider": "plivo",
                "error": "Plivo credentials not configured for live call transfer.",
            }
        if not provider_call_id:
            return {
                "supported": True,
                "success": False,
                "status": "failed",
                "provider": "plivo",
                "error": "Missing Plivo CallUUID for transfer.",
            }
        base_url = settings.PUBLIC_BASE_URL.rstrip("/")
        aleg_url = f"{base_url}/api/calls/plivo-xml/{provider_call_id}"
        try:
            resp = requests.post(
                f"{self.base_url}/Call/{provider_call_id}/",
                auth=(self.auth_id, self.auth_token),
                json={"legs": "aleg", "aleg_url": aleg_url, "aleg_method": "POST"},
                timeout=10.0,
            )
            if resp.status_code in (200, 202):
                return {
                    "supported": True,
                    "success": True,
                    "status": "executed",
                    "provider": "plivo",
                    "provider_call_id": provider_call_id,
                    "transfer_to": to_phone,
                }
            return {
                "supported": True,
                "success": False,
                "status": "failed",
                "provider": "plivo",
                "error": f"Plivo transfer failed ({resp.status_code}): {resp.text[:300]}",
            }
        except Exception as exc:
            return {
                "supported": True,
                "success": False,
                "status": "failed",
                "provider": "plivo",
                "error": str(exc),
            }

