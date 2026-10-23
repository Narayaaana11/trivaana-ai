"""
TRIVAANA AI: Deterministic Mock Provider Adapter
Used for reproducible CI/CD runs, offline tests, and sandbox demonstrations.
Never claims live telephony succeeded when running in production.
"""

import uuid
import hmac
import hashlib
from typing import Dict, Any, Optional
from providers.base import (
    BaseTelephonyProvider,
    BaseVoiceProvider,
    BasePaymentProvider,
    CallDispatchResult,
    CallStatusEvent,
)

class MockTelephonyProvider(BaseTelephonyProvider):
    name = "mock"

    def __init__(self):
        self.active_calls: Dict[str, Dict[str, Any]] = {}

    def initiate_call(
        self,
        to_phone: str,
        from_phone: str,
        webhook_url: str,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> CallDispatchResult:
        provider_call_id = f"mock_call_{uuid.uuid4().hex[:12]}"
        self.active_calls[provider_call_id] = {
            "to": to_phone,
            "from": from_phone,
            "status": "initiated",
            "extra": extra_data or {}
        }
        return CallDispatchResult(
            success=True,
            provider="mock",
            provider_call_id=provider_call_id,
            status="initiated",
            raw_response={"mock": True, "call_id": provider_call_id}
        )

    def terminate_call(self, provider_call_id: str) -> bool:
        if provider_call_id in self.active_calls:
            self.active_calls[provider_call_id]["status"] = "cancelled"
            return True
        return False

    def verify_webhook(self, headers: Dict[str, str], raw_body: bytes) -> bool:
        # Mock webhook always verifies in test/sandbox
        return True

    def parse_webhook_event(self, headers: Dict[str, str], payload: Dict[str, Any]) -> CallStatusEvent:
        call_id = (
            payload.get("provider_call_id")
            or payload.get("call_id")
            or payload.get("call_sid")
            or payload.get("CallSid")
            or payload.get("Sid")
            or f"mock_call_{uuid.uuid4().hex[:8]}"
        )
        status = payload.get("status", "completed")
        duration = int(payload.get("duration", 60))
        recording = payload.get("recording_url", f"https://cdn.trivaana.ai/recordings/{call_id}.mp3")

        return CallStatusEvent(
            provider="mock",
            provider_call_id=call_id,
            status=status,
            duration_seconds=duration,
            recording_url=recording,
            raw_payload=payload
        )

class MockVoiceProvider(BaseVoiceProvider):
    name = "mock_voice"

    def synthesize_speech(self, text: str, language: str, voice_id: Optional[str] = None) -> bytes:
        # Deterministic dummy MP3 header bytes for tests
        return b"\xff\xfb\x90\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00" + text.encode("utf-8")

class MockPaymentProvider(BasePaymentProvider):
    name = "mock_payment"

    def __init__(self, secret: str = "mock_secret"):
        self.secret = secret

    def create_order(self, amount_paise: int, currency: str = "INR", receipt: Optional[str] = None) -> Dict[str, Any]:
        order_id = f"order_mock_{uuid.uuid4().hex[:10]}"
        return {
            "id": order_id,
            "entity": "order",
            "amount": amount_paise,
            "amount_paid": 0,
            "amount_due": amount_paise,
            "currency": currency,
            "receipt": receipt or f"rcpt_{uuid.uuid4().hex[:6]}",
            "status": "created"
        }

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        expected = hmac.new(
            self.secret.encode("utf-8"),
            f"{order_id}|{payment_id}".encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def verify_webhook_signature(self, raw_body: bytes, signature: str) -> bool:
        expected = hmac.new(
            self.secret.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
