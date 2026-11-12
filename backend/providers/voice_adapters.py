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


class VoiceProviderAuthError(RuntimeError):
    """Raised when provider API credentials are invalid or unauthorized (401/403)."""
    pass


class VoiceProviderRateLimitError(RuntimeError):
    """Raised when provider rate limits are exceeded (429)."""
    pass


class VoiceProviderValidationError(ValueError):
    """Raised when request text, voice ID, model ID, or length fails validation."""
    pass


SUPPORTED_LANGUAGES: List[Dict[str, Any]] = [
    {"code": "en-IN", "iso": "en", "name": "English (India)", "native": "English", "script": "Latin", "regions": "Pan-India & Global"},
    {"code": "hi-IN", "iso": "hi", "name": "Hindi", "native": "हिन्दी", "script": "Devanagari", "regions": "North & Central India"},
    {"code": "te-IN", "iso": "te", "name": "Telugu", "native": "తెలుగు", "script": "Telugu", "regions": "Andhra Pradesh & Telangana"},
    {"code": "ta-IN", "iso": "ta", "name": "Tamil", "native": "தமிழ்", "script": "Tamil", "regions": "Tamil Nadu & Puducherry"},
    {"code": "kn-IN", "iso": "kn", "name": "Kannada", "native": "ಕನ್ನಡ", "script": "Kannada", "regions": "Karnataka"},
    {"code": "ml-IN", "iso": "ml", "name": "Malayalam", "native": "മലയാളം", "script": "Malayalam", "regions": "Kerala"},
    {"code": "mr-IN", "iso": "mr", "name": "Marathi", "native": "मराठी", "script": "Devanagari", "regions": "Maharashtra"},
    {"code": "bn-IN", "iso": "bn", "name": "Bengali", "native": "বাংলা", "script": "Bengali", "regions": "West Bengal & Tripura"},
    {"code": "gu-IN", "iso": "gu", "name": "Gujarati", "native": "ગુજરાતી", "script": "Gujarati", "regions": "Gujarat"},
    {"code": "pa-IN", "iso": "pa", "name": "Punjabi", "native": "ਪੰਜਾਬੀ", "script": "Gurmukhi", "regions": "Punjab & Chandigarh"},
    {"code": "or-IN", "iso": "or", "name": "Odia", "native": "ଓଡ଼ିଆ", "script": "Odia", "regions": "Odisha"},
    {"code": "as-IN", "iso": "as", "name": "Assamese", "native": "অসমীয়া", "script": "Bengali-Assamese", "regions": "Assam"},
    {"code": "ur-IN", "iso": "ur", "name": "Urdu", "native": "اردو", "script": "Perso-Arabic", "regions": "Telangana, UP, Bihar & J&K"},
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
    base_url = "https://api.elevenlabs.io/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = settings.ELEVENLABS_API_KEY if api_key is None else api_key

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _headers(self, json_body: bool = False) -> Dict[str, str]:
        h = {"xi-api-key": self.api_key}
        if json_body:
            h["Content-Type"] = "application/json"
        return h

    def verify_credentials(self) -> Dict[str, Any]:
        """Verify live ElevenLabs API key via authenticated GET /v1/models (+ optional /v1/user/subscription)."""
        if not self.is_configured:
            return {"connected": False, "reason": "ELEVENLABS_API_KEY not configured"}
        try:
            resp = requests.get(f"{self.base_url}/models", headers=self._headers(), timeout=10.0)
            if resp.status_code in (401, 403):
                return {"connected": False, "status_code": resp.status_code, "reason": "Invalid or unauthorized ElevenLabs API key"}
            if resp.status_code != 200:
                return {"connected": False, "status_code": resp.status_code, "reason": f"HTTP {resp.status_code}"}
            models = resp.json()
            sub_info: Dict[str, Any] = {}
            try:
                sub_resp = requests.get(f"{self.base_url}/user/subscription", headers=self._headers(), timeout=8.0)
                if sub_resp.status_code == 200:
                    sub_json = sub_resp.json()
                    sub_info = {k: sub_json.get(k) for k in ("tier", "character_count", "character_limit", "voice_limit", "status") if sub_json.get(k) is not None}
            except Exception:
                pass
            return {
                "connected": True,
                "tts_models_count": sum(1 for m in models if m.get("can_do_text_to_speech")),
                "subscription": sub_info,
            }
        except requests.RequestException as exc:
            return {"connected": False, "reason": f"Network error: {type(exc).__name__}"}

    def discover_models(self) -> List[Dict[str, Any]]:
        """Fetch official ElevenLabs speech models from GET /v1/models."""
        if not self.is_configured:
            raise VoiceProviderAuthError("ELEVENLABS_API_KEY is not configured")
        resp = requests.get(f"{self.base_url}/models", headers=self._headers(), timeout=15.0)
        if resp.status_code in (401, 403):
            raise VoiceProviderAuthError("Invalid or unauthorized ElevenLabs API key")
        if resp.status_code != 200:
            raise RuntimeError(f"ElevenLabs /v1/models failed: {resp.status_code} - {resp.text[:200]}")
        return resp.json()

    def discover_voices(self) -> List[Dict[str, Any]]:
        """Fetch accessible voices and metadata from GET /v1/voices."""
        if not self.is_configured:
            raise VoiceProviderAuthError("ELEVENLABS_API_KEY is not configured")
        resp = requests.get(f"{self.base_url}/voices", headers=self._headers(), timeout=15.0)
        if resp.status_code in (401, 403):
            raise VoiceProviderAuthError("Invalid or unauthorized ElevenLabs API key")
        if resp.status_code != 200:
            raise RuntimeError(f"ElevenLabs /v1/voices failed: {resp.status_code} - {resp.text[:200]}")
        return resp.json().get("voices", [])

    @staticmethod
    def _resolve_default_model(language: str) -> str:
        iso = (language or "en-IN").split("-")[0].lower()
        if iso in ("en", "hi", "ta"):
            return "eleven_flash_v2_5"
        return "eleven_v4_turbo"

    def _build_tts_payload(
        self,
        text: str,
        language: str,
        model_id: str,
        stability: float,
        similarity_boost: float,
        style: float,
        speed: float,
        use_speaker_boost: bool,
    ) -> Dict[str, Any]:
        voice_settings: Dict[str, Any] = {
            "stability": max(0.0, min(1.0, float(stability))),
            "similarity_boost": max(0.0, min(1.0, float(similarity_boost))),
        }
        # eleven_v4 / eleven_v3 / multilingual_v2 support style & speaker boost; flash/turbo v2.5 accept speed
        if model_id in ("eleven_multilingual_v2", "eleven_v4", "eleven_v4_turbo"):
            voice_settings["style"] = max(0.0, min(1.0, float(style)))
            voice_settings["use_speaker_boost"] = bool(use_speaker_boost)
        if abs(float(speed) - 1.0) > 0.01:
            voice_settings["speed"] = max(0.7, min(1.2, float(speed)))

        payload: Dict[str, Any] = {
            "text": text,
            "model_id": model_id,
            "voice_settings": voice_settings,
        }
        iso = (language or "").split("-")[0].lower()
        if iso and model_id in ("eleven_flash_v2_5", "eleven_turbo_v2_5", "eleven_v4", "eleven_v4_turbo"):
            payload["language_code"] = iso
        return payload

    def _handle_error_response(self, resp: requests.Response) -> None:
        if resp.status_code in (401, 403):
            raise VoiceProviderAuthError("ElevenLabs API key is invalid or lacks TTS permission.")
        if resp.status_code == 402:
            raise VoiceProviderPlanError(
                "ElevenLabs free-tier plans cannot synthesize shared library voices or exceed plan quota. "
                "Select an accessible premade/custom voice or upgrade your ElevenLabs plan."
            )
        if resp.status_code == 429:
            raise VoiceProviderRateLimitError("ElevenLabs rate limit exceeded. Please retry shortly.")
        if resp.status_code in (400, 422):
            raise VoiceProviderValidationError(f"ElevenLabs validation error: {resp.text[:240]}")
        raise RuntimeError(f"ElevenLabs TTS failed: {resp.status_code} - {resp.text[:240]}")

    def synthesize_speech(
        self,
        text: str,
        language: str = "en-IN",
        voice_id: Optional[str] = None,
        stability: float = 0.55,
        similarity_boost: float = 0.78,
        style: float = 0.0,
        speed: float = 1.0,
        use_speaker_boost: bool = True,
        model_id: Optional[str] = None,
        output_format: Optional[str] = None,
        return_metadata: bool = False,
    ) -> Any:
        if not text or not text.strip():
            raise VoiceProviderValidationError("Text for synthesis cannot be empty.")
        if len(text) > 10000:
            raise VoiceProviderValidationError("Text exceeds maximum single-request character limit (10,000).")
        if not self.is_configured:
            raw = b"\xff\xfb\x90\x00" + text.encode("utf-8")
            return (raw, {"cache_hit": False, "model_id": model_id or "sandbox", "provider_characters_reported": 0}) if return_metadata else raw

        target_voice = voice_id or "EXAVITQu4vr4xnSDxMaL"  # Sarah (premade, accessible)
        chosen_model = model_id or self._resolve_default_model(language)
        cache_voice = f"{target_voice}:{chosen_model}:{round(speed, 2)}:{round(stability, 2)}:{output_format or 'mp3'}"
        cache = _get_tts_cache()
        cached = cache.get(self.name, cache_voice, language, text)
        if cached:
            if return_metadata:
                return cached, {"cache_hit": True, "model_id": chosen_model, "provider_characters_reported": 0}
            return cached

        inflight_lock = cache.get_inflight_lock(self.name, cache_voice, language, text)
        with inflight_lock:
            cached = cache.get(self.name, cache_voice, language, text)
            if cached:
                if return_metadata:
                    return cached, {"cache_hit": True, "model_id": chosen_model, "provider_characters_reported": 0}
                return cached

            url = f"{self.base_url}/text-to-speech/{target_voice}"
            if output_format:
                url += f"?output_format={output_format}"
            payload = self._build_tts_payload(
                text=text,
                language=language,
                model_id=chosen_model,
                stability=stability,
                similarity_boost=similarity_boost,
                style=style,
                speed=speed,
                use_speaker_boost=use_speaker_boost,
            )

            resp = requests.post(url, headers=self._headers(json_body=True), json=payload, timeout=18.0)
            if resp.status_code == 200:
                cache.set(self.name, cache_voice, language, text, resp.content)
                if return_metadata:
                    char_hdr = resp.headers.get("character-cost") or resp.headers.get("x-character-count")
                    reported = int(char_hdr) if char_hdr and str(char_hdr).isdigit() else len(text)
                    return resp.content, {"cache_hit": False, "model_id": chosen_model, "provider_characters_reported": reported}
                return resp.content
            self._handle_error_response(resp)

    def synthesize_stream(
        self,
        text: str,
        language: str = "en-IN",
        voice_id: Optional[str] = None,
        stability: float = 0.55,
        similarity_boost: float = 0.78,
        style: float = 0.0,
        speed: float = 1.0,
        use_speaker_boost: bool = True,
        model_id: Optional[str] = None,
        output_format: str = "mp3_44100_128",
        chunk_size: int = 4096,
    ):
        """Stream synthesized audio chunks from ElevenLabs /v1/text-to-speech/{voice_id}/stream."""
        if not text or not text.strip():
            raise VoiceProviderValidationError("Text for synthesis cannot be empty.")
        if not self.is_configured:
            yield b"\xff\xfb\x90\x00" + text.encode("utf-8")
            return
        target_voice = voice_id or "EXAVITQu4vr4xnSDxMaL"
        chosen_model = model_id or self._resolve_default_model(language)
        url = f"{self.base_url}/text-to-speech/{target_voice}/stream?output_format={output_format}"
        payload = self._build_tts_payload(
            text=text,
            language=language,
            model_id=chosen_model,
            stability=stability,
            similarity_boost=similarity_boost,
            style=style,
            speed=speed,
            use_speaker_boost=use_speaker_boost,
        )
        with requests.post(url, headers=self._headers(json_body=True), json=payload, stream=True, timeout=20.0) as resp:
            if resp.status_code != 200:
                self._handle_error_response(resp)
            for chunk in resp.iter_content(chunk_size=chunk_size):
                if chunk:
                    yield chunk


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
        response_format: str = "mp3",
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
            "response_format": response_format or "mp3",
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
