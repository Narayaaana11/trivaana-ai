"""Minimal first-call verification script for Sarvam AI Python SDK (Text-to-Speech)."""

import os
from pathlib import Path
from dotenv import load_dotenv
from sarvamai import SarvamAI
from sarvamai.play import save

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

api_key = os.getenv("SARVAM_API_KEY")
if not api_key:
    raise RuntimeError("SARVAM_API_KEY is missing from environment / .env")

client = SarvamAI(api_subscription_key=api_key)

response = client.text_to_speech.convert(
    text="नमस्ते! ट्रिवाना एआई में आपका स्वागत है।",
    language_code="hi-IN",
    model="bulbul:v3",
    speaker="shubh",
)

out_file = Path(__file__).resolve().parent / "sarvam_first_call.wav"
save(response, str(out_file))
print(f"Sarvam TTS success: saved {out_file.stat().st_size} bytes to {out_file.name}")
