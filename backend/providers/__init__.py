"""
TRIVAANA AI: Provider Factory
Dynamically selects active telephony, voice, and payment adapters.
"""

from core.config import settings
from providers.base import BaseTelephonyProvider, BaseVoiceProvider, BasePaymentProvider
from providers.mock_adapter import MockTelephonyProvider, MockVoiceProvider, MockPaymentProvider
from providers.exotel_adapter import ExotelTelephonyProvider
from providers.twilio_adapter import TwilioTelephonyProvider
from providers.plivo_adapter import PlivoTelephonyProvider
from providers.vobiz_adapter import VobizTelephonyProvider
from providers.voice_adapters import (
    SarvamVoiceProvider,
    ElevenLabsVoiceProvider,
    OpenAIVoiceProvider,
    IndicF5VoiceProvider,
)
from providers.razorpay_adapter import RazorpayPaymentProvider


def get_telephony_provider(provider_name: str = None) -> BaseTelephonyProvider:
    """Returns active telephony carrier or mock fallback."""
    p_name = (provider_name or "").lower()

    if p_name == "exotel" or (not p_name and settings.has_exotel):
        return ExotelTelephonyProvider()
    if p_name == "plivo" or (not p_name and settings.has_plivo):
        return PlivoTelephonyProvider()
    if p_name == "vobiz" or (not p_name and settings.has_vobiz):
        return VobizTelephonyProvider()
    if p_name == "twilio" or (not p_name and settings.has_twilio):
        return TwilioTelephonyProvider()

    # Fallback to deterministic mock
    return MockTelephonyProvider()


def get_voice_provider(provider_name: str = "sarvam") -> BaseVoiceProvider:
    """Returns requested voice synthesis adapter."""
    p_name = (provider_name or "").lower()
    if p_name == "elevenlabs":
        return ElevenLabsVoiceProvider()
    if p_name == "openai":
        return OpenAIVoiceProvider()
    if p_name == "indicf5":
        return IndicF5VoiceProvider()
    return SarvamVoiceProvider()


def get_payment_provider() -> BasePaymentProvider:
    """Returns Razorpay payment adapter or mock in test mode."""
    return RazorpayPaymentProvider()
