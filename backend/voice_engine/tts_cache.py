"""
TRIVAANA AI: Content-Addressed TTS Cache (Dograh Pattern)
Caches synthesized TTS audio by (provider, voice_id, language, text) in memory and disk
to eliminate repeated synthesis latency and API spend on standard greetings and disclosures.
"""

from collections import OrderedDict
import hashlib
from pathlib import Path
from typing import Optional
from core.config import settings


class TTSCache:
    _MAX_MEMORY_ITEMS = 256

    def __init__(self, cache_dir: Optional[Path] = None):
        self.cache_dir = Path(cache_dir or (settings.LOCAL_STORAGE_PATH / "tts_cache"))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._mem: "OrderedDict[str, bytes]" = OrderedDict()

    @staticmethod
    def build_key(provider: str, voice_id: str, language: str, text: str) -> str:
        raw = f"{provider.lower()}|{voice_id}|{language}|{text.strip()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, provider: str, voice_id: str, language: str, text: str) -> Optional[bytes]:
        if not text or not text.strip():
            return None
        key = self.build_key(provider, voice_id, language, text)
        if key in self._mem:
            self._mem.move_to_end(key)
            return self._mem[key]
        disk_path = self.cache_dir / f"{key}.bin"
        if disk_path.is_file():
            data = disk_path.read_bytes()
            self._put_mem(key, data)
            return data
        return None

    def set(self, provider: str, voice_id: str, language: str, text: str, audio_bytes: bytes) -> None:
        if not text or not text.strip() or not audio_bytes:
            return
        key = self.build_key(provider, voice_id, language, text)
        self._put_mem(key, audio_bytes)
        try:
            disk_path = self.cache_dir / f"{key}.bin"
            disk_path.write_bytes(audio_bytes)
        except OSError:
            pass

    def _put_mem(self, key: str, audio_bytes: bytes) -> None:
        self._mem[key] = audio_bytes
        self._mem.move_to_end(key)
        while len(self._mem) > self._MAX_MEMORY_ITEMS:
            self._mem.popitem(last=False)


tts_cache = TTSCache()

