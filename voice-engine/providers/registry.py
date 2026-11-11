"""
TRIVAANA AI: Voice Provider Registry & Failover Chain
Resolves primary and fallback STT, LLM, and TTS providers per language and tier.
"""

from typing import Dict, List


VOICE_FAILOVER_CHAINS: Dict[str, Dict[str, List[str]]] = {
    "te-IN": {"stt": ["sarvam", "deepgram", "openai_whisper"], "tts": ["sarvam", "elevenlabs", "openai"]},
    "hi-IN": {"stt": ["sarvam", "deepgram", "openai_whisper"], "tts": ["sarvam", "elevenlabs", "openai"]},
    "ta-IN": {"stt": ["sarvam", "indic_conformer", "openai_whisper"], "tts": ["sarvam", "elevenlabs", "openai"]},
    "kn-IN": {"stt": ["sarvam", "indic_conformer", "openai_whisper"], "tts": ["sarvam", "elevenlabs", "openai"]},
    "ml-IN": {"stt": ["sarvam", "indic_conformer", "openai_whisper"], "tts": ["sarvam", "elevenlabs", "openai"]},
    "en-IN": {"stt": ["deepgram", "sarvam", "openai_whisper"], "tts": ["elevenlabs", "sarvam", "openai"]},
}


def get_failover_chain(language: str, modality: str = "tts") -> List[str]:
    lang_cfg = VOICE_FAILOVER_CHAINS.get(language, VOICE_FAILOVER_CHAINS["en-IN"])
    return lang_cfg.get(modality, ["openai"])

