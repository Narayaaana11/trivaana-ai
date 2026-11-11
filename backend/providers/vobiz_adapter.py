"""
TRIVAANA AI: Vobiz Telephony Adapter (India SIP/PSTN)
Implements Vobiz JSON Call API (`X-Auth-ID` / `X-Auth-Token`), bidirectional `<Stream>` XML,
capability token verification, and status callback normalization.
"""

import hashlib
import hmac
from typing import Any, Dict, Optional
import requests

from core.config import settings
from providers.base import BaseTelephonyProvider, CallDispatchResult, CallStatusEvent


class VobizTelephonyProvider(BaseTelephonyProvider):
    name = "vobiz"

    def __init__(
        self,
        auth_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        caller_id: Optional[str] = None,
    ):
        self.auth_id = auth_id or settings.VOBIZ_AUTH_ID
        self.auth_token = auth_token or settings.VOBIZ_AUTH_TOKEN
        self.caller_id = caller_id or settings.VOBIZ_PHONE_NUMBER
        self.base_url = "https://api.vobiz.ai/api"

    @property
    def is_configured(self) -> bool:
        return bool(self.auth_id and self.auth_token and self.caller_id)

    def build_stream_token(self, call_id: str) -> str:
        secret = (self.auth_token or settings.JWT_SECRET).encode("utf-8")
        return hmac.new(secret, f"vobiz_stream:{call_id}".encode("utf-8"), hashlib.sha256).hexdigest()

    def build_callback_token(self, call_id: str) -> str:
        secret = (self.auth_token or settings.JWT_SECRET).encode("utf-8")
        return hmac.new(secret, f"vobiz_cb:{call_id}".encode("utf-8"), hashlib.sha256).hexdigest()

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
                provider="vobiz",
                status="failed",
                error_message="Vobiz credentials (VOBIZ_AUTH_ID, VOBIZ_AUTH_TOKEN, VOBIZ_PHONE_NUMBER) not configured",
            )

        call_id = (extra_data or {}).get("call_id", "")
        base_url = settings.PUBLIC_BASE_URL.rstrip("/")
        answer_url = f"{base_url}/api/calls/vobiz-xml/{call_id}" if call_id else f"{base_url}/api/calls/vobiz-xml/default"
        cb_tok = self.build_callback_token(call_id) if call_id else ""
        status_url = webhook_url or (
            f"{base_url}/api/calls/callback/{call_id}?vobiz_auth={cb_tok}" if call_id else ""
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

        headers = {
            "X-Auth-ID": self.auth_id,
            "X-Auth-Token": self.auth_token,
            "Content-Type": "application/json",
        }
        try:
            resp = requests.post(
                f"{self.base_url}/v1/Account/{self.auth_id}/Call/",
                headers=headers,
                json=payload,
                timeout=10.0,
            )
            data = resp.json() if resp.content else {}
            call_uuid = data.get("call_uuid") or data.get("request_uuid")
            if resp.status_code in (200, 201, 202) and call_uuid:
                return CallDispatchResult(
                    success=True,
                    provider="vobiz",
                    provider_call_id=str(call_uuid),
                    status="initiated",
                    raw_response=data,
                )
            return CallDispatchResult(
                success=False,
                provider="vobiz",
                status="failed",
                error_message=data.get("message") or data.get("error") or f"Vobiz error: {resp.text}",
                raw_response=data,
            )
        except Exception as exc:
            return CallDispatchResult(
                success=False,
                provider="vobiz",
                status="failed",
                error_message=f"Network exception connecting to Vobiz: {exc}",
            )

    def terminate_call(self, provider_call_id: str) -> bool:
        if not self.is_configured or not provider_call_id:
            return False
        headers = {"X-Auth-ID": self.auth_id, "X-Auth-Token": self.auth_token}
        try:
            resp = requests.delete(
                f"{self.base_url}/v1/Account/{self.auth_id}/Call/{provider_call_id}/",
                headers=headers,
                timeout=5.0,
            )
            return resp.status_code in (200, 204)
        except Exception:
            return False

    def verify_request(self, headers: Dict[str, str], params: Dict[str, Any]) -> bool:
        lower_headers = {k.lower(): v for k, v in headers.items()}
        hdr_id = lower_headers.get("x-auth-id")
        hdr_tok = lower_headers.get("x-auth-token")
        if (
            self.auth_id
            and self.auth_token
            and hdr_id
            and hdr_tok
            and hmac.compare_digest(str(hdr_id), str(self.auth_id))
            and hmac.compare_digest(str(hdr_tok), str(self.auth_token))
        ):
            return True

        vobiz_auth = params.get("vobiz_auth")
        call_id = params.get("_call_id") or ""
        if vobiz_auth and call_id:
            expected = self.build_callback_token(str(call_id))
            if hmac.compare_digest(expected, str(vobiz_auth)):
                return True

        return False

    def verify_webhook(self, headers: Dict[str, str], raw_body: bytes) -> bool:
        return self.verify_request(headers, {})

    def generate_stream_xml(self, call_id: str, language: str = "te-IN") -> str:
        base_url = settings.PUBLIC_BASE_URL.rstrip("/")
        ws_base = base_url.replace("https://", "wss://").replace("http://", "ws://")
        token = self.build_stream_token(call_id)
        ws_url = f"{ws_base}/api/calls/stream/{call_id}?provider=vobiz&amp;token={token}"
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            "<Response>\n"
            '    <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-l16;rate=8000">'
            f"{ws_url}</Stream>\n"
            "</Response>"
        )

    def parse_webhook_event(self, headers: Dict[str, str], payload: Dict[str, Any]) -> CallStatusEvent:
        call_uuid = payload.get("CallUUID") or payload.get("call_uuid") or payload.get("RequestUUID") or ""
        raw_status = (payload.get("CallStatus") or payload.get("status") or "completed").lower()
        status_map = {
            "ringing": "ringing",
            "in-progress": "connected",
            "answered": "connected",
            "completed": "completed",
            "busy": "busy",
            "no-answer": "no-answer",
            "failed": "failed",
            "canceled": "cancelled",
        }
        duration = int(payload.get("Duration") or payload.get("BillDuration") or 0)
        return CallStatusEvent(
            provider="vobiz",
            provider_call_id=str(call_uuid),
            status=status_map.get(raw_status, "completed"),
            duration_seconds=duration,
            recording_url=payload.get("RecordingUrl") or payload.get("RecordUrl"),
            raw_payload=payload,
        )

