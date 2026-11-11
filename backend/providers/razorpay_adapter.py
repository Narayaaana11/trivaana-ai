"""
TRIVAANA AI: Razorpay Payment Gateway Adapter
Server-verified order creation, HMAC-SHA256 payment signature verification,
and raw-body webhook signature verification with dev sandbox fallback.
"""

import hmac
import hashlib
import httpx
import uuid
from typing import Dict, Any, Optional
from core.config import settings
from providers.base import BasePaymentProvider

class RazorpayPaymentProvider(BasePaymentProvider):
    name = "razorpay"

    def __init__(
        self,
        key_id: Optional[str] = None,
        key_secret: Optional[str] = None,
        webhook_secret: Optional[str] = None
    ):
        self._key_id = key_id
        self._key_secret = key_secret
        self._webhook_secret = webhook_secret
        self.base_url = "https://api.razorpay.com/v1"

    @property
    def key_id(self) -> str:
        return self._key_id or settings.RAZORPAY_KEY_ID

    @property
    def key_secret(self) -> str:
        return self._key_secret or settings.RAZORPAY_KEY_SECRET

    @property
    def webhook_secret(self) -> str:
        return self._webhook_secret or settings.RAZORPAY_WEBHOOK_SECRET

    @property
    def is_configured(self) -> bool:
        return bool(self.key_id and self.key_secret)

    def create_order(
        self,
        amount_paise: int,
        currency: str = "INR",
        receipt: Optional[str] = None
    ) -> Dict[str, Any]:
        receipt_id = receipt or f"rcpt_{uuid.uuid4().hex[:8]}"

        if not self.is_configured:
            # Deterministic Dev Sandbox Order (Explicitly marked)
            order_id = f"order_sandbox_{uuid.uuid4().hex[:10]}"
            return {
                "id": order_id,
                "entity": "order",
                "amount": amount_paise,
                "amount_paid": 0,
                "amount_due": amount_paise,
                "currency": currency,
                "receipt": receipt_id,
                "status": "created",
                "is_sandbox": True,
                "notes": {"mode": "development_sandbox"}
            }

        endpoint = f"{self.base_url}/orders"
        payload = {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt_id,
            "payment_capture": 1
        }

        resp = httpx.post(
            endpoint,
            auth=(self.key_id, self.key_secret),
            json=payload,
            timeout=10.0,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            data["is_sandbox"] = False
            return data
        raise RuntimeError(f"Razorpay order creation failed: {resp.status_code} - {resp.text}")

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        if not self.is_configured:
            # In sandbox mode without live keys, verify sandbox prefix
            return order_id.startswith("order_sandbox_") and payment_id.startswith("pay_sandbox_")

        expected_msg = f"{order_id}|{payment_id}".encode("utf-8")
        expected_sig = hmac.new(
            self.key_secret.encode("utf-8"),
            expected_msg,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_sig, signature)

    def verify_webhook_signature(self, raw_body: bytes, signature: str) -> bool:
        if settings.ENVIRONMENT.lower() in ("production", "prod"):
            secret = self.webhook_secret
        else:
            secret = self.webhook_secret or self.key_secret
        if not secret:
            return False

        expected_sig = hmac.new(
            secret.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_sig, signature)

    def fetch_payment(self, payment_id: str) -> Dict[str, Any]:
        """Fetch payment details from Razorpay to verify status, amount, and currency."""
        if not self.is_configured:
            return {
                "id": payment_id,
                "status": "captured",
                "amount": 0,
                "currency": "INR",
                "is_sandbox": True
            }
        endpoint = f"{self.base_url}/payments/{payment_id}"
        resp = requests.get(
            endpoint,
            auth=(self.key_id, self.key_secret),
            timeout=10.0
        )
        if resp.status_code == 200:
            return resp.json()
        raise RuntimeError(f"Razorpay fetch payment failed: {resp.status_code} - {resp.text}")

