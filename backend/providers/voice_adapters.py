"""
TRIVAANA AI: Multilingual Voice Adapters & Provider Capability Registry
Supports Sarvam AI, ElevenLabs, OpenAI TTS, IndicF5 (local/remote), and Mock fallback.
"""

import base64
import json
import requests
from typing import Optional, Dict, Any, List
from core.config import settings
from providers.base import BaseVoiceProvider


def _get_tts_cache():
    from voice_engine.tts_cache import tts_cache
    return tts_cache


class VoiceProviderPlanError(RuntimeError):
    """Raised when a configured provider rejects a synthesis call due to plan/tier limits."""
    pass


SUPPORTED_LANGUAGES: List[Dict[str, Any]] = [
    {"code": "en-IN", "name": "English (India)", "native": "English", "regions": "Pan-India & Global"},
    {"code": "hi-IN", "name": "Hindi", "native": "हिन्दी", "regions": "North & Central India"},
    {"code": "te-IN", "name": "Telugu", "native": "తెలుగు", "regions": "Andhra Pradesh & Telangana"},
    {"code": "ta-IN", "name": "Tamil", "native": "தமிழ்", "regions": "Tamil Nadu"},
    {"code": "kn-IN", "name": "Kannada", "native": "ಕನ್ನಡ", "regions": "Karnataka"},
    {"code": "ml-IN", "name": "Malayalam", "native": "മലയാളം", "regions": "Kerala"},
    {"code": "mr-IN", "name": "Marathi", "native": "मराठी", "regions": "Maharashtra"},
]


class SarvamVoiceProvider(BaseVoiceProvider):
    name = "sarvam"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = settings.SARVAM_API_KEY if api_key is None else api_key
        self.endpoint = "https://api.sarvam.ai/text-to-speech"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def synthesize_speech(
        self,
        text: str,
        language: str = "te-IN",
        voice_id: Optional[str] = "meera",
        speed: float = 1.0,
    ) -> bytes:
        if not self.is_configured:
            return b"\xff\xfb\x90\x00" + text.encode("utf-8")

        speaker = voice_id or "meera"
        cached = _get_tts_cache().get(self.name, speaker, language, text)
        if cached:
            return cached

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "inputs": [text],
            "target_language_code": language,
            "speaker": speaker,
            "pitch": 0,
            "pace": max(0.5, min(2.0, speed)),
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
                audio_bytes = base64.b64decode(audios[0])
                _get_tts_cache().set(self.name, speaker, language, text, audio_bytes)
                return audio_bytes
        raise RuntimeError(f"Sarvam AI TTS failed: {resp.status_code} - {resp.text}")

    async def synthesize_speech_ws(
        self,
        text: str,
        language: str = "te-IN",
        voice_id: Optional[str] = "meera",
        speed: float = 1.0,
    ) -> bytes:
        """Low-latency Sarvam WebSocket TTS (Bolna SarvamSynthesizer protocol)."""
        if not self.is_configured:
            return b"\xff\xfb\x90\x00" + text.encode("utf-8")

        speaker = voice_id or "meera"
        cached = _get_tts_cache().get(self.name, speaker, language, text)
        if cached:
            return cached

        import websockets  # type: ignore

        ws_url = "wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v4-flash&send_completion_event=true"
        headers = {"api-subscription-key": self.api_key}
        chunks = bytearray()
        async with websockets.connect(ws_url, additional_headers=headers) as ws:
            await ws.send(json.dumps({
                "type": "config",
                "data": {
                    "target_language_code": language,
                    "speaker": speaker,
                    "pace": max(0.5, min(2.0, speed)),
                    "speech_sample_rate": "8000",
                    "output_audio_codec": "wav",
                    "enable_preprocessing": True,
                },
            }))
            await ws.send(json.dumps({"type": "text", "data": {"text": text}}))
            await ws.send(json.dumps({"type": "flush"}))

            async for raw_msg in ws:
                msg = json.loads(raw_msg)
                mtype = msg.get("type")
                if mtype == "audio":
                    b64 = (msg.get("data") or {}).get("audio")
                    if b64:
                        chunks.extend(base64.b64decode(b64))
                elif mtype == "event" and (msg.get("data") or {}).get("event_type") == "final":
                    break
                elif mtype == "error":
                    raise RuntimeError(f"Sarvam WS TTS error: {msg}")

        audio_bytes = bytes(chunks)
        if audio_bytes:
            _get_tts_cache().set(self.name, speaker, language, text, audio_bytes)
        return audio_bytes


class ElevenLabsVoiceProvider(BaseVoiceProvider):
    name = "elevenlabs"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = settings.ELEVENLABS_API_KEY if api_key is None else api_key

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def synthesize_speech(
        self,
        text: str,
        language: str = "en-IN",
        voice_id: Optional[str] = None,
        stability: float = 0.5,
    ) -> bytes:
        if not self.is_configured:
            return b"\xff\xfb\x90\x00" + text.encode("utf-8")

        target_voice = voice_id or "21m00Tcm4TlvDq8ikWAM"  # Default Rachel
        cached = _get_tts_cache().get(self.name, target_voice, language, text)
        if cached:
            return cached

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{target_voice}"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": max(0.0, min(1.0, stability)),
                "similarity_boost": 0.75
            }
        }

        resp = requests.post(url, headers=headers, json=payload, timeout=12.0)
        if resp.status_code == 200:
            _get_tts_cache().set(self.name, target_voice, language, text, resp.content)
            return resp.content
        if resp.status_code == 402:
            raise VoiceProviderPlanError(
                "ElevenLabs free-tier plans cannot synthesize shared library voices via the API. "
                "Supply a custom non-library voice_id or upgrade your ElevenLabs plan."
            )
        raise RuntimeError(f"ElevenLabs TTS failed: {resp.status_code} - {resp.text}")


class OpenAIVoiceProvider(BaseVoiceProvider):
    name = "openai"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = settings.OPENAI_API_KEY if api_key is None else api_key
        self.endpoint = "https://api.openai.com/v1/audio/speech"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def synthesize_speech(
        self,
        text: str,
        language: str = "en-IN",
        voice_id: Optional[str] = "alloy",
        speed: float = 1.0,
    ) -> bytes:
        if not self.is_configured:
            return b"\xff\xfb\x90\x00" + text.encode("utf-8")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "tts-1",
            "input": text,
            "voice": voice_id or "alloy",
            "speed": max(0.25, min(4.0, speed)),
            "response_format": "mp3",
        }
        resp = requests.post(self.endpoint, headers=headers, json=payload, timeout=15.0)
        if resp.status_code == 200:
            return resp.content
        raise RuntimeError(f"OpenAI TTS failed: {resp.status_code} - {resp.text}")


class IndicF5VoiceProvider(BaseVoiceProvider):
    name = "indicf5"

    def __init__(self, endpoint: Optional[str] = None):
        self.endpoint = settings.INDICF5_ENDPOINT if endpoint is None else endpoint

    @property
    def is_configured(self) -> bool:
        return bool(self.endpoint)

    def synthesize_speech(
        self,
        text: str,
        language: str = "te-IN",
        voice_id: Optional[str] = "indic_female_1",
    ) -> bytes:
        if not self.is_configured:
            return b"\xff\xfb\x90\x00" + text.encode("utf-8")

        resp = requests.post(
            f"{self.endpoint.rstrip('/')}/synthesize",
            json={"text": text, "language": language, "speaker": voice_id},
            timeout=20.0,
        )
        if resp.status_code == 200:
            return resp.content
        raise RuntimeError(f"IndicF5 TTS failed: {resp.status_code} - {resp.text}")


def get_voice_provider(provider_name: str) -> BaseVoiceProvider:
    name = (provider_name or "sarvam").lower()
    if name == "elevenlabs":
        return ElevenLabsVoiceProvider()
    if name == "openai":
        return OpenAIVoiceProvider()
    if name == "indicf5":
        return IndicF5VoiceProvider()
    return SarvamVoiceProvider()
