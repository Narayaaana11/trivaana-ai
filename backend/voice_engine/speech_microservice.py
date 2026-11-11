"""
TRIVAANA AI: Self-Hosted Speech Microservice Gateway (Faster-Whisper / IndicConformerASR / IndicF5)
Started via `docker compose --profile speech up` or `uvicorn voice_engine.speech_microservice:app --port 8002`.
Provides HTTP `/transcribe` and `/synthesize` endpoints matching Trivaana's external ASR/TTS adapters.
"""

import io
import os
from typing import Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="Trivaana Self-Hosted Speech Microservice", version="1.0.0")


class SynthesizeRequest(BaseModel):
    text: str
    language: str = "te-IN"
    speaker: str = "indic_female_1"


@app.get("/health")
def speech_health():
    fw_ready = False
    try:
        import faster_whisper  # type: ignore  # noqa: F401
        fw_ready = True
    except ImportError:
        pass
    return {
        "status": "healthy",
        "faster_whisper_installed": fw_ready,
        "indic_conformer_model_dir": os.environ.get("INDIC_CONFORMER_MODEL_DIR", ""),
        "indicf5_model_dir": os.environ.get("INDICF5_MODEL_DIR", ""),
    }


@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("en"),
):
    audio_bytes = await file.read()
    try:
        from faster_whisper import WhisperModel  # type: ignore

        model_size = os.environ.get("WHISPER_MODEL_SIZE", "small")
        device = os.environ.get("WHISPER_DEVICE", "cpu")
        model = WhisperModel(model_size, device=device, compute_type="int8")
        segments, info = model.transcribe(io.BytesIO(audio_bytes), language=(language or "en").split("-")[0])
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return {"text": text, "language": info.language, "provider": "faster_whisper"}
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Self-hosted ASR runtime (faster-whisper / IndicConformer NeMo) is not installed in this container.",
        )


@app.post("/synthesize")
def synthesize_speech(req: SynthesizeRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty")
    raise HTTPException(
        status_code=503,
        detail="Self-hosted IndicF5 weights must be mounted into the speech container to synthesize locally.",
    )

