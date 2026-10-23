"""
TRIVAANA AI: Provider Factory
Dynamically selects active telephony, voice, and payment adapters.
"""

from core.config import settings
from providers.base import BaseTelephonyProvider, BaseVoiceProvider, BasePaymentProvider
from providers.mock_adapter import MockTelephonyProvider, MockVoiceProvider, MockPaymentProvider
from providers.exotel_adapter import ExotelTelephonyProvider
from providers.twilio_adapter import TwilioTelephonyProvider
from providers.voice_adapters import SarvamVoiceProvider, ElevenLabsVoiceProvider
from providers.razorpay_adapter import RazorpayPaymentProvider

def get_telephony_provider(provider_name: str = None) -> BaseTelephonyProvider:
    """Returns active telephony carrier or mock fallback."""
    p_name = (provider_name or "").lower()
    
    if p_name == "exotel" or (not p_name and settings.has_exotel):
        return ExotelTelephonyProvider()
    elif p_name == "twilio" or (not p_name and settings.has_twilio):
        return TwilioTelephonyProvider()
    
    # Fallback to deterministic mock
    return MockTelephonyProvider()

def get_voice_provider(provider_name: str = "sarvam") -> BaseVoiceProvider:
    """Returns requested voice synthesis adapter."""
    p_name = (provider_name or "").lower()
    if p_name == "elevenlabs":
        return ElevenLabsVoiceProvider()
    return SarvamVoiceProvider()

def get_payment_provider() -> BasePaymentProvider:
    """Returns Razorpay payment adapter or mock in test mode."""
    return RazorpayPaymentProvider()
