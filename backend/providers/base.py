"""
TRIVAANA AI: Provider Abstraction Interfaces
Clean interfaces for Telephony Carriers, Speech Synthesizers, and Payment Gateways.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from pydantic import BaseModel

class CallDispatchResult(BaseModel):
    success: bool
    provider: str
    provider_call_id: Optional[str] = None
    status: str  # 'initiated', 'ringing', 'connected', 'failed'
    error_message: Optional[str] = None
    raw_response: Dict[str, Any] = {}

class CallStatusEvent(BaseModel):
    provider: str
    provider_call_id: str
    status: str  # 'initiated', 'ringing', 'connected', 'completed', 'failed', 'busy', 'no-answer', 'cancelled'
    duration_seconds: int = 0
    recording_url: Optional[str] = None
    raw_payload: Dict[str, Any] = {}

class BaseTelephonyProvider(ABC):
    name: str

    @abstractmethod
    def initiate_call(
        self,
        to_phone: str,
        from_phone: str,
        webhook_url: str,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> CallDispatchResult:
        """Place an outbound call via the carrier."""
        pass

    @abstractmethod
    def terminate_call(self, provider_call_id: str) -> bool:
        """Sever an active call on the carrier network."""
        pass

    @abstractmethod
    def verify_webhook(self, headers: Dict[str, str], raw_body: bytes) -> bool:
        """Verify authenticity of provider callback event."""
        pass

    @abstractmethod
    def parse_webhook_event(self, headers: Dict[str, str], payload: Dict[str, Any]) -> CallStatusEvent:
        """Parse raw carrier callback payload into standardized CallStatusEvent."""
        pass

    def parse_status_callback(self, payload: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> CallStatusEvent:
        """Convenience method to parse callback payload with optional headers."""
        return self.parse_webhook_event(headers or {}, payload)

class BaseVoiceProvider(ABC):
    name: str

    @abstractmethod
    def synthesize_speech(self, text: str, language: str, voice_id: Optional[str] = None) -> bytes:
        """Synthesize text into speech audio bytes."""
        pass

class BasePaymentProvider(ABC):
    name: str

    @abstractmethod
    def create_order(self, amount_paise: int, currency: str = "INR", receipt: Optional[str] = None) -> Dict[str, Any]:
        """Create a payment order on the payment gateway."""
        pass

    @abstractmethod
    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        """Verify checkout payment signature using merchant secret."""
        pass

    @abstractmethod
    def verify_webhook_signature(self, raw_body: bytes, signature: str) -> bool:
        """Verify webhook authenticity against raw request body."""
        pass
