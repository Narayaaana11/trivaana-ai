"""
TRIVAANA AI: Multilingual Voice Adapters (Sarvam AI & ElevenLabs)
Generates high-fidelity vernacular speech for Telugu, Hindi, and Indian English.
"""

import requests
from typing import Optional
from core.config import settings
from providers.base import BaseVoiceProvider

class SarvamVoiceProvider(BaseVoiceProvider):
    name = "sarvam"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.SARVAM_API_KEY
        self.endpoint = "https://api.sarvam.ai/text-to-speech"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def synthesize_speech(self, text: str, language: str = "te-IN", voice_id: Optional[str] = "meera") -> bytes:
        if not self.is_configured:
            # Deterministic preview bytes when not configured
            return b"\xff\xfb\x90\x00" + text.encode("utf-8")

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "inputs": [text],
            "target_language_code": language,
            "speaker": voice_id or "meera",
            "pitch": 0,
            "pace": 1.0,
            "loudness": 1.5,
            "speech_sample_rate": 8000,
            "enable_preprocessing": True,
            "model": "bulbul:v4-flash"
        }

        resp = requests.post(self.endpoint, headers=headers, json=payload, timeout=10.0)
        if resp.status_code == 200:
            data = resp.json()
            audios = data.get("audios", [])
            if audios:
                import base64
                return base64.b64decode(audios[0])
        raise RuntimeError(f"Sarvam AI TTS failed: {resp.status_code} - {resp.text}")

class ElevenLabsVoiceProvider(BaseVoiceProvider):
    name = "elevenlabs"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.ELEVENLABS_API_KEY

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def synthesize_speech(self, text: str, language: str = "en-IN", voice_id: Optional[str] = None) -> bytes:
        if not self.is_configured:
            return b"\xff\xfb\x90\x00" + text.encode("utf-8")

        target_voice = voice_id or "21m00Tcm4TlvDq8ikWAM"  # Default Rachel
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{target_voice}"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }

        resp = requests.post(url, headers=headers, json=payload, timeout=12.0)
        if resp.status_code == 200:
            return resp.content
        raise RuntimeError(f"ElevenLabs TTS failed: {resp.status_code} - {resp.text}")
