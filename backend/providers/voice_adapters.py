"""
TRIVAANA AI: Multilingual Voice Adapters & Provider Capability Registry
Supports Sarvam AI, ElevenLabs, OpenAI TTS, IndicF5 (local/remote), and Mock fallback.
"""

import base64
import json
import time
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


# Verified Sarvam AI TTS Models & Speakers (from sarvamai 0.1.45 SDK & live API checks)
SARVAM_TTS_LANGUAGES: List[str] = [
    "en-IN", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN",
    "mr-IN", "bn-IN", "gu-IN", "pa-IN", "or-IN",
]

# Sarvam API uses 'od-IN' for Odia; Trivaana uses standard BCP-47 'or-IN'
SARVAM_LOCALE_TO_API: Dict[str, str] = {
    "or-IN": "od-IN",
}

SARVAM_MODELS: List[Dict[str, Any]] = [
    {
        "model_id": "bulbul:v3",
        "provider": "sarvam",
        "name": "Sarvam Bulbul v3",
        "description": "Flagship production multilingual Indian TTS with 37 natural male & female speakers, 11 Indian languages, REST & WebSocket streaming.",
        "can_do_tts": True,
        "languages": ["en", "hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "or"],
        "cost_factor": 1.0,
        "latency_tier": "low",
        "quality_tier": "premium",
        "max_chars_free": 2500,
        "max_chars_subscribed": 2500,
        "streaming_supported": True,
    },
    {
        "model_id": "bulbul:v4-flash",
        "provider": "sarvam",
        "name": "Sarvam Bulbul v4 Flash",
        "description": "Low-latency role-tuned conversational Indian TTS with domain-specific regional speakers (customer, edtech, ads, narration).",
        "can_do_tts": True,
        "languages": ["en", "hi", "te", "ta", "kn", "mr", "bn", "gu", "pa"],
        "cost_factor": 0.9,
        "latency_tier": "ultra_low",
        "quality_tier": "balanced",
        "max_chars_free": 2500,
        "max_chars_subscribed": 2500,
        "streaming_supported": True,
    },
]

# All 37 verified bulbul:v3 speakers + curated regional bulbul:v4-flash speakers
SARVAM_V3_SPEAKERS: List[Dict[str, Any]] = [
    {"id": "shubh", "name": "Shubh (Default)", "gender": "male", "accent": "pan-indian", "desc": "Default Bulbul v3 warm male voice across 11 Indian languages"},
    {"id": "aditya", "name": "Aditya", "gender": "male", "accent": "pan-indian", "desc": "Clear, authoritative male voice for enterprise & support"},
    {"id": "rahul", "name": "Rahul", "gender": "male", "accent": "pan-indian", "desc": "Conversational male voice for sales & onboarding"},
    {"id": "rohan", "name": "Rohan", "gender": "male", "accent": "pan-indian", "desc": "Crisp, energetic male voice for edtech & reminders"},
    {"id": "amit", "name": "Amit", "gender": "male", "accent": "pan-indian", "desc": "Balanced male voice for customer care"},
    {"id": "dev", "name": "Dev", "gender": "male", "accent": "pan-indian", "desc": "Steady male voice for banking & collections"},
    {"id": "ratan", "name": "Ratan", "gender": "male", "accent": "pan-indian", "desc": "Rich, expressive male voice"},
    {"id": "varun", "name": "Varun", "gender": "male", "accent": "pan-indian", "desc": "Engaging male voice for product demos"},
    {"id": "manan", "name": "Manan", "gender": "male", "accent": "pan-indian", "desc": "Friendly male voice for appointment booking"},
    {"id": "sumit", "name": "Sumit", "gender": "male", "accent": "pan-indian", "desc": "Calm male voice for advisory desks"},
    {"id": "kabir", "name": "Kabir", "gender": "male", "accent": "pan-indian", "desc": "Modern conversational male voice"},
    {"id": "aayan", "name": "Aayan", "gender": "male", "accent": "pan-indian", "desc": "Youthful male voice for D2C & e-commerce"},
    {"id": "ashutosh", "name": "Ashutosh", "gender": "male", "accent": "pan-indian", "desc": "Measured male voice for formal outreach"},
    {"id": "advait", "name": "Advait", "gender": "male", "accent": "pan-indian", "desc": "Articulate male voice for SaaS & B2B"},
    {"id": "anand", "name": "Anand", "gender": "male", "accent": "pan-indian", "desc": "Warm male voice suited for North & West Indian locales"},
    {"id": "tarun", "name": "Tarun", "gender": "male", "accent": "south-indian", "desc": "Natural male voice for South & Pan-Indian calls"},
    {"id": "sunny", "name": "Sunny", "gender": "male", "accent": "pan-indian", "desc": "Upbeat male voice for promotions & events"},
    {"id": "mani", "name": "Mani", "gender": "male", "accent": "south-indian", "desc": "Warm male voice tuned for Tamil & South Indian callers"},
    {"id": "gokul", "name": "Gokul", "gender": "male", "accent": "south-indian", "desc": "Clear male voice for Tamil & Malayalam desks"},
    {"id": "vijay", "name": "Vijay", "gender": "male", "accent": "south-indian", "desc": "Confident male voice for Tamil & Telugu real estate"},
    {"id": "mohit", "name": "Mohit", "gender": "male", "accent": "pan-indian", "desc": "Polite male voice for healthcare & clinics"},
    {"id": "rehan", "name": "Rehan", "gender": "male", "accent": "pan-indian", "desc": "Smooth conversational male voice"},
    {"id": "soham", "name": "Soham", "gender": "male", "accent": "west-indian", "desc": "Natural male voice suited for Marathi & Hindi"},
    {"id": "priya", "name": "Priya", "gender": "female", "accent": "pan-indian", "desc": "Empathetic female voice for healthcare & customer support"},
    {"id": "ritu", "name": "Ritu", "gender": "female", "accent": "pan-indian", "desc": "Bright, clear female voice for receptionist desks"},
    {"id": "neha", "name": "Neha", "gender": "female", "accent": "pan-indian", "desc": "Warm female voice for follow-ups & reminders"},
    {"id": "pooja", "name": "Pooja", "gender": "female", "accent": "pan-indian", "desc": "Friendly female voice suited for Hindi, Gujarati & Telugu"},
    {"id": "simran", "name": "Simran", "gender": "female", "accent": "pan-indian", "desc": "Dynamic female voice for sales & edtech"},
    {"id": "kavya", "name": "Kavya", "gender": "female", "accent": "south-indian", "desc": "Poised female voice for financial & South Indian desks"},
    {"id": "ishita", "name": "Ishita", "gender": "female", "accent": "pan-indian", "desc": "Crisp female voice for Indian English & Hindi"},
    {"id": "shreya", "name": "Shreya", "gender": "female", "accent": "pan-indian", "desc": "Clear, professional female voice for announcements"},
    {"id": "roopa", "name": "Roopa", "gender": "female", "accent": "east-indian", "desc": "Warm female voice suited for Bengali & Hindi"},
    {"id": "tanya", "name": "Tanya", "gender": "female", "accent": "pan-indian", "desc": "Approachable female voice for onboarding"},
    {"id": "shruti", "name": "Shruti", "gender": "female", "accent": "south-indian", "desc": "Natural female voice suited for Malayalam & Hindi"},
    {"id": "suhani", "name": "Suhani", "gender": "female", "accent": "pan-indian", "desc": "Lively female voice for D2C outreach"},
    {"id": "kavitha", "name": "Kavitha", "gender": "female", "accent": "south-indian", "desc": "Expressive female voice suited for Telugu & Tamil"},
    {"id": "rupali", "name": "Rupali", "gender": "female", "accent": "west-indian", "desc": "Warm female voice suited for Marathi & Hindi"},
]

SARVAM_V4_FLASH_SPEAKERS: List[Dict[str, Any]] = [
    {"id": "shubh_hi_customer", "name": "Shubh · Hindi Customer", "gender": "male", "accent": "hindi", "langs": ["hi-IN", "en-IN"], "desc": "Bulbul v4 Flash role-tuned Hindi customer support voice"},
    {"id": "simran_hi_customer", "name": "Simran · Hindi Customer", "gender": "female", "accent": "hindi", "langs": ["hi-IN", "en-IN"], "desc": "Bulbul v4 Flash role-tuned Hindi female customer agent"},
    {"id": "ishita_en_customer", "name": "Ishita · Indian English", "gender": "female", "accent": "indian", "langs": ["en-IN", "hi-IN"], "desc": "Bulbul v4 Flash Indian English customer service voice"},
    {"id": "ishita_enhi_customer", "name": "Ishita · Hinglish", "gender": "female", "accent": "hinglish", "langs": ["hi-IN", "en-IN"], "desc": "Bulbul v4 Flash natural Hindi-English code-switching voice"},
    {"id": "kavitha_te_conversation", "name": "Kavitha · Telugu", "gender": "female", "accent": "telugu", "langs": ["te-IN", "en-IN"], "desc": "Bulbul v4 Flash Telugu conversational voice"},
    {"id": "tarun_te_narration", "name": "Tarun · Telugu", "gender": "male", "accent": "telugu", "langs": ["te-IN", "en-IN"], "desc": "Bulbul v4 Flash Telugu male voice"},
    {"id": "aravind_ta_ads", "name": "Aravind · Tamil", "gender": "male", "accent": "tamil", "langs": ["ta-IN", "en-IN"], "desc": "Bulbul v4 Flash Tamil male voice"},
    {"id": "chaitra_kn_conversation", "name": "Chaitra · Kannada", "gender": "female", "accent": "kannada", "langs": ["kn-IN", "en-IN"], "desc": "Bulbul v4 Flash Kannada female conversational voice"},
    {"id": "chetan_kn_conversation", "name": "Chetan · Kannada", "gender": "male", "accent": "kannada", "langs": ["kn-IN", "en-IN"], "desc": "Bulbul v4 Flash Kannada male conversational voice"},
    {"id": "nilesh_mr_conversation", "name": "Nilesh · Marathi", "gender": "male", "accent": "marathi", "langs": ["mr-IN", "en-IN"], "desc": "Bulbul v4 Flash Marathi male conversational voice"},
    {"id": "arnab_bn_conversation", "name": "Arnab · Bengali", "gender": "male", "accent": "bengali", "langs": ["bn-IN", "en-IN"], "desc": "Bulbul v4 Flash Bengali male conversational voice"},
    {"id": "roopa_bn_conversational", "name": "Roopa · Bengali", "gender": "female", "accent": "bengali", "langs": ["bn-IN", "en-IN"], "desc": "Bulbul v4 Flash Bengali female conversational voice"},
    {"id": "bhavik_gu_conversation", "name": "Bhavik · Gujarati", "gender": "male", "accent": "gujarati", "langs": ["gu-IN", "en-IN"], "desc": "Bulbul v4 Flash Gujarati male conversational voice"},
    {"id": "pooja_gu_conversational", "name": "Pooja · Gujarati", "gender": "female", "accent": "gujarati", "langs": ["gu-IN", "en-IN"], "desc": "Bulbul v4 Flash Gujarati female conversational voice"},
    {"id": "anand_pa_conversation", "name": "Anand · Punjabi", "gender": "male", "accent": "punjabi", "langs": ["pa-IN", "en-IN"], "desc": "Bulbul v4 Flash Punjabi male conversational voice"},
]

SARVAM_V3_SPEAKER_IDS = {s["id"] for s in SARVAM_V3_SPEAKERS}
SARVAM_V4_SPEAKER_IDS = {s["id"] for s in SARVAM_V4_FLASH_SPEAKERS}
SARVAM_V4_SPEAKERS_BY_ID = {s["id"]: s for s in SARVAM_V4_FLASH_SPEAKERS}
SUPPORTED_TTS_PROVIDERS = ("sarvam", "elevenlabs", "openai", "indicf5")


class SarvamVoiceProvider(BaseVoiceProvider):
    name = "sarvam"
    _verify_cache: Dict[str, Any] = {"ts": 0.0, "result": None}

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = settings.SARVAM_API_KEY if api_key is None else api_key
        self.endpoint = "https://api.sarvam.ai/text-to-speech"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    @staticmethod
    def map_language_code(language: str) -> str:
        lang = (language or "hi-IN").strip()
        if lang in ("as-IN", "ur-IN"):
            raise VoiceProviderValidationError(
                f"Sarvam AI TTS does not support '{lang}' on this account. "
                "Supported Sarvam languages: en-IN, hi-IN, te-IN, ta-IN, kn-IN, ml-IN, mr-IN, bn-IN, gu-IN, pa-IN, or-IN."
            )
        mapped = SARVAM_LOCALE_TO_API.get(lang, lang)
        if mapped not in ("en-IN", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "od-IN"):
            raise VoiceProviderValidationError(f"Unsupported Sarvam AI language code '{language}'.")
        return mapped

    def verify_credentials(self, force: bool = False) -> Dict[str, Any]:
        """Verify live Sarvam AI API key via a minimal SDK call (cached 60s to avoid credit waste)."""
        if not self.is_configured:
            return {"connected": False, "reason": "SARVAM_API_KEY not configured"}
        now = time.monotonic()
        if not force and self._verify_cache["result"] is not None and (now - self._verify_cache["ts"]) < 60.0:
            return self._verify_cache["result"]
        try:
            from sarvamai import SarvamAI
            client = SarvamAI(api_subscription_key=self.api_key, timeout=10.0)
            res = client.text_to_speech.convert(
                text="Hi",
                language_code="en-IN",
                model="bulbul:v3",
                speaker="shubh",
                output_audio_codec="mp3",
            )
            ok = bool(getattr(res, "audios", None))
            result = {
                "connected": ok,
                "tts_models_count": len(SARVAM_MODELS),
                "speakers_count": len(SARVAM_V3_SPEAKERS) + len(SARVAM_V4_FLASH_SPEAKERS),
                "stt_models": ["saaras:v4", "saaras:v3"],
                "default_model": "bulbul:v3",
            }
            self._verify_cache = {"ts": now, "result": result}
            return result
        except Exception as exc:
            msg = str(getattr(exc, "body", None) or exc)
            status = getattr(exc, "status_code", None)
            if status in (401, 403) or "403" in msg or "401" in msg or "invalid" in msg.lower():
                return {"connected": False, "status_code": status or 403, "reason": "Invalid or unauthorized Sarvam API key"}
            return {"connected": False, "status_code": status, "reason": f"Sarvam verification failed: {msg[:180]}"}

    def discover_models(self) -> List[Dict[str, Any]]:
        return [dict(m) for m in SARVAM_MODELS]

    def discover_voices(self) -> List[Dict[str, Any]]:
        voices: List[Dict[str, Any]] = []
        for s in SARVAM_V3_SPEAKERS:
            voices.append({
                **s,
                "model_id": "bulbul:v3",
                "supported_models": ["bulbul:v3"],
                "supported_languages": list(SARVAM_TTS_LANGUAGES),
            })
        for s in SARVAM_V4_FLASH_SPEAKERS:
            voices.append({
                **s,
                "model_id": "bulbul:v4-flash",
                "supported_models": ["bulbul:v4-flash"],
                "supported_languages": list(s["langs"]),
            })
        return voices

    def synthesize_speech(
        self,
        text: str,
        language: str = "hi-IN",
        voice_id: Optional[str] = "shubh",
        speed: float = 1.0,
        model_id: Optional[str] = None,
        output_audio_codec: str = "mp3",
        speech_sample_rate: int = 22050,
        return_metadata: bool = False,
    ) -> Any:
        if not text or not text.strip():
            raise VoiceProviderValidationError("Text for synthesis cannot be empty.")
        if len(text) > 2500:
            raise VoiceProviderValidationError("Sarvam TTS text exceeds maximum 2,500 character limit.")
        if not self.is_configured:
            raw = b"\xff\xfb\x90\x00" + text.encode("utf-8")
            return (raw, {"cache_hit": False, "model_id": model_id or "sandbox", "provider_characters_reported": 0, "sandbox": True}) if return_metadata else raw

        api_lang = self.map_language_code(language)
        speaker = (voice_id or "shubh").strip()
        if speaker == "meera":
            speaker = "priya"  # legacy default remap only when unmapped default 'meera' is passed
        if speaker not in SARVAM_V3_SPEAKER_IDS and speaker not in SARVAM_V4_SPEAKER_IDS:
            raise VoiceProviderValidationError(f"Unknown Sarvam AI speaker '{speaker}'.")

        chosen_model = model_id or ("bulbul:v4-flash" if speaker in SARVAM_V4_SPEAKER_IDS else "bulbul:v3")
        if chosen_model == "bulbul:v2":
            raise VoiceProviderValidationError("Sarvam 'bulbul:v2' has been deprecated. Please select 'bulbul:v3' or 'bulbul:v4-flash'.")
        if chosen_model not in ("bulbul:v3", "bulbul:v4-flash"):
            raise VoiceProviderValidationError(f"Unsupported Sarvam TTS model '{chosen_model}'.")
        if chosen_model == "bulbul:v3" and speaker in SARVAM_V4_SPEAKER_IDS:
            raise VoiceProviderValidationError(f"Speaker '{speaker}' is only compatible with 'bulbul:v4-flash', not 'bulbul:v3'.")
        if chosen_model == "bulbul:v4-flash" and speaker in SARVAM_V3_SPEAKER_IDS:
            raise VoiceProviderValidationError(f"Speaker '{speaker}' is a 'bulbul:v3' speaker; select 'bulbul:v3' or a 'bulbul:v4-flash' speaker.")
        if speaker in SARVAM_V4_SPEAKERS_BY_ID:
            allowed_langs = SARVAM_V4_SPEAKERS_BY_ID[speaker].get("langs") or []
            if language not in allowed_langs:
                raise VoiceProviderValidationError(
                    f"Sarvam speaker '{speaker}' supports {', '.join(allowed_langs)}, not '{language}'."
                )

        pace = max(0.5, min(2.0, float(speed or 1.0)))
        cache_voice = f"{speaker}:{chosen_model}:{round(pace, 2)}:{output_audio_codec}:{speech_sample_rate}"
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

            from sarvamai import SarvamAI
            last_exc: Optional[Exception] = None
            for attempt in range(2):
                try:
                    client = SarvamAI(api_subscription_key=self.api_key, timeout=15.0)
                    res = client.text_to_speech.convert(
                        text=text,
                        language_code=api_lang,
                        model=chosen_model,
                        speaker=speaker,
                        pace=pace,
                        speech_sample_rate=speech_sample_rate,
                        enable_preprocessing=True,
                        output_audio_codec=output_audio_codec,
                    )
                    audios = getattr(res, "audios", None) or []
                    if not audios:
                        raise RuntimeError("Sarvam TTS returned empty audio list.")
                    audio_bytes = base64.b64decode(audios[0])
                    cache.set(self.name, cache_voice, language, text, audio_bytes)
                    if return_metadata:
                        return audio_bytes, {
                            "cache_hit": False,
                            "model_id": chosen_model,
                            "provider_characters_reported": len(text),
                        }
                    return audio_bytes
                except Exception as exc:
                    last_exc = exc
                    status = getattr(exc, "status_code", None)
                    body = str(getattr(exc, "body", None) or exc)
                    if status in (401, 403):
                        raise VoiceProviderAuthError("Sarvam API key is invalid or unauthorized.") from exc
                    if status == 400:
                        raise VoiceProviderValidationError(f"Sarvam TTS validation error: {body[:240]}") from exc
                    if status == 429:
                        if attempt == 0:
                            time.sleep(0.5)
                            continue
                        raise VoiceProviderRateLimitError("Sarvam rate limit exceeded. Please retry shortly.") from exc
                    if attempt == 0 and (status is None or status >= 500):
                        time.sleep(0.3)
                        continue
                    raise RuntimeError(f"Sarvam AI TTS failed: {body[:240]}") from exc
            raise RuntimeError(f"Sarvam AI TTS failed: {last_exc}")

    async def synthesize_speech_ws(
        self,
        text: str,
        language: str = "hi-IN",
        voice_id: Optional[str] = "shubh",
        speed: float = 1.0,
        model_id: str = "bulbul:v3",
        output_audio_codec: str = "linear16",
        speech_sample_rate: int = 8000,
    ) -> bytes:
        """Low-latency Sarvam WebSocket streaming TTS via official AsyncSarvamAI SDK."""
        if not self.is_configured:
            return b"\xff\xfb\x90\x00" + text.encode("utf-8")

        api_lang = self.map_language_code(language)
        speaker = (voice_id or "shubh").strip()
        if speaker == "meera":
            speaker = "priya"
        pace = max(0.5, min(2.0, float(speed or 1.0)))
        cache_voice = f"{speaker}:{model_id}:{round(pace, 2)}:{output_audio_codec}:{speech_sample_rate}"
        cached = _get_tts_cache().get(self.name, cache_voice, language, text)
        if cached:
            return cached

        from sarvamai import AsyncSarvamAI
        client = AsyncSarvamAI(api_subscription_key=self.api_key, timeout=15.0)
        chunks = bytearray()
        async with client.text_to_speech_streaming.connect(model=model_id, send_completion_event=True) as ws:
            await ws.configure(
                target_language_code=api_lang,
                speaker=speaker,
                pace=pace,
                speech_sample_rate=speech_sample_rate,
                output_audio_codec=output_audio_codec,
                enable_preprocessing=True,
            )
            await ws.convert(text)
            await ws.flush()
            async for msg in ws:
                if getattr(msg, "type", None) == "audio":
                    b64 = getattr(getattr(msg, "data", None), "audio", None)
                    if b64:
                        chunks.extend(base64.b64decode(b64))
                elif getattr(msg, "type", None) == "event":
                    break

        audio_bytes = bytes(chunks)
        if audio_bytes:
            _get_tts_cache().set(self.name, cache_voice, language, text, audio_bytes)
        return audio_bytes


class SarvamSTTProvider:
    """Sarvam AI Speech-to-Text provider using Saaras v4 / v3 across 22 Indian languages + en-IN."""

    name = "sarvam"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = settings.SARVAM_API_KEY if api_key is None else api_key

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def transcribe(
        self,
        audio_bytes: bytes,
        language: str = "unknown",
        model: str = "saaras:v4",
        mode: str = "transcribe",
        filename: str = "audio.wav",
    ) -> Dict[str, Any]:
        if not self.is_configured:
            raise VoiceProviderAuthError("SARVAM_API_KEY is not configured.")
        from sarvamai import SarvamAI
        api_lang = SARVAM_LOCALE_TO_API.get(language, language) if language else "unknown"
        client = SarvamAI(api_subscription_key=self.api_key, timeout=15.0)
        res = client.speech_to_text.transcribe(
            file=(filename, audio_bytes),
            model=model,
            mode=mode,
            language_code=api_lang,
        )
        return {
            "transcript": getattr(res, "transcript", "") or "",
            "language_code": getattr(res, "language_code", api_lang),
            "model": model,
            "mode": mode,
        }


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
            return (raw, {"cache_hit": False, "model_id": model_id or "sandbox", "provider_characters_reported": 0, "sandbox": True}) if return_metadata else raw

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
