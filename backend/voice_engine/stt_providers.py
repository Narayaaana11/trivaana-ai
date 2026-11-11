"""
TRIVAANA AI: Pluggable Speech-to-Text (STT) Providers
Supports OpenAI Whisper API, Faster-Whisper (local), AI4Bharat IndicConformer, and Mock STT.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import os
import requests
from core.config import settings


class BaseSTTProvider(ABC):
    name: str

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        pass

    @abstractmethod
    def transcribe(self, audio_bytes: bytes, language: str = "en", filename: str = "audio.wav") -> Dict[str, Any]:
        pass


class OpenAIWhisperSTT(BaseSTTProvider):
    name = "openai_whisper"

    @property
    def is_configured(self) -> bool:
        return bool(settings.OPENAI_API_KEY)

    def transcribe(self, audio_bytes: bytes, language: str = "en", filename: str = "audio.wav") -> Dict[str, Any]:
        if not self.is_configured:
            return {"text": "", "provider": self.name, "configured": False, "error": "OPENAI_API_KEY not configured"}

        lang_iso = (language or "en").split("-")[0]
        resp = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            files={"file": (filename, audio_bytes, "audio/wav")},
            data={"model": "whisper-1", "language": lang_iso},
            timeout=15.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"text": data.get("text", ""), "provider": self.name, "configured": True}
        raise RuntimeError(f"OpenAI Whisper STT failed: {resp.status_code} - {resp.text}")


class FasterWhisperSTT(BaseSTTProvider):
    name = "faster_whisper"

    def __init__(self):
        self.endpoint = os.environ.get("FASTER_WHISPER_ENDPOINT", "")

    @property
    def is_configured(self) -> bool:
        if self.endpoint:
            return True
        try:
            import faster_whisper  # type: ignore  # noqa: F401
            return True
        except ImportError:
            return False

    def transcribe(self, audio_bytes: bytes, language: str = "en", filename: str = "audio.wav") -> Dict[str, Any]:
        if self.endpoint:
            resp = requests.post(
                f"{self.endpoint.rstrip('/')}/transcribe",
                files={"file": (filename, audio_bytes, "audio/wav")},
                data={"language": (language or "en").split("-")[0]},
                timeout=15.0,
            )
            resp.raise_for_status()
            return {"text": resp.json().get("text", ""), "provider": self.name, "configured": True}
        return {"text": "", "provider": self.name, "configured": self.is_configured, "error": "Local faster-whisper requires temp file streaming"}


class IndicConformerSTT(BaseSTTProvider):
    name = "indic_conformer"

    def __init__(self):
        self.endpoint = os.environ.get("INDIC_CONFORMER_ENDPOINT", "")

    @property
    def is_configured(self) -> bool:
        return bool(self.endpoint)

    def transcribe(self, audio_bytes: bytes, language: str = "te-IN", filename: str = "audio.wav") -> Dict[str, Any]:
        if not self.is_configured:
            return {"text": "", "provider": self.name, "configured": False, "error": "INDIC_CONFORMER_ENDPOINT not configured"}
        resp = requests.post(
            f"{self.endpoint.rstrip('/')}/transcribe",
            files={"file": (filename, audio_bytes, "audio/wav")},
            data={"language": language},
            timeout=15.0,
        )
        resp.raise_for_status()
        return {"text": resp.json().get("text", ""), "provider": self.name, "configured": True}


def get_stt_provider(name: Optional[str] = None) -> BaseSTTProvider:
    target = (name or "").lower()
    if target == "faster_whisper":
        return FasterWhisperSTT()
    if target == "indic_conformer":
        return IndicConformerSTT()
    return OpenAIWhisperSTT()

