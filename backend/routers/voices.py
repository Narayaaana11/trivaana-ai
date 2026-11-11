"""
TRIVAANA AI: Voice Library & Provider Capability Router
Manages voice profiles, language filters, previews, and provider verification tests.
Never marks voices as live-verified until tested with configured provider credentials.
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from typing import Optional
import sqlite3
import base64
from datetime import datetime, timezone

from database.connection import get_db
from core.dependencies import get_current_tenant
from core.config import settings
from providers.voice_adapters import SUPPORTED_LANGUAGES, VoiceProviderPlanError, get_voice_provider

router = APIRouter(prefix="/api/voices", tags=["Voice Management"])


class VoicePreviewRequest(BaseModel):
    voice_id: str = "meera"
    provider: str = "sarvam"
    language: str = "te-IN"
    text: str = "Namaskaram! Welcome to Trivaana AI voice calling platform."
    speed: float = Field(1.0, ge=0.5, le=2.0)
    stability: float = Field(0.6, ge=0.0, le=1.0)


@router.get("/languages")
def list_supported_languages(db: sqlite3.Connection = Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT language, COUNT(*) as total, SUM(CASE WHEN verified_status = 'verified' THEN 1 ELSE 0 END) as verified_count FROM voice_profiles GROUP BY language")
    counts = {r["language"]: dict(r) for r in cur.fetchall()}

    languages = []
    for lang in SUPPORTED_LANGUAGES:
        c = counts.get(lang["code"], {"total": 0, "verified_count": 0})
        languages.append({
            **lang,
            "voice_count": c["total"],
            "verified_voice_count": c["verified_count"] or 0,
            "provider_ready": bool(settings.has_sarvam or settings.has_elevenlabs or settings.has_openai or settings.has_indicf5),
        })
    return {"languages": languages}


@router.get("")
def list_voices(
    language: Optional[str] = None,
    gender: Optional[str] = None,
    provider: Optional[str] = None,
    verified_only: bool = False,
    db: sqlite3.Connection = Depends(get_db),
    tenant: dict = Depends(get_current_tenant),
):
    cur = db.cursor()
    q = "SELECT * FROM voice_profiles WHERE 1=1"
    params = []
    if language:
        q += " AND language = ?"
        params.append(language)
    if gender:
        q += " AND gender = ?"
        params.append(gender.lower())
    if provider:
        q += " AND provider = ?"
        params.append(provider.lower())
    if verified_only:
        q += " AND verified_status = 'verified'"
    q += " ORDER BY provider ASC, language ASC, name ASC"
    cur.execute(q, params)
    voices = []
    for r in cur.fetchall():
        d = dict(r)
        prov = d["provider"]
        d["provider_configured"] = {
            "openai": settings.has_openai,
            "elevenlabs": settings.has_elevenlabs,
            "sarvam": settings.has_sarvam,
            "indicf5": settings.has_indicf5,
        }.get(prov, False)
        voices.append(d)

    return {
        "voices": voices,
        "count": len(voices),
        "providers": {
            "openai": settings.has_openai,
            "elevenlabs": settings.has_elevenlabs,
            "sarvam": settings.has_sarvam,
            "indicf5": settings.has_indicf5,
        }
    }


@router.post("/preview")
def preview_voice(
    req: VoicePreviewRequest,
    tenant: dict = Depends(get_current_tenant),
):
    provider = get_voice_provider(req.provider)
    configured = getattr(provider, "is_configured", False)

    if not configured:
        return {
            "status": "sandbox_only",
            "configured": False,
            "provider": req.provider,
            "voice_id": req.voice_id,
            "language": req.language,
            "message": f"{req.provider.title()} API credentials are not configured. Browser speech synthesis preview may be used locally; server synthesis requires provider credentials.",
            "audio_base64": None,
        }

    try:
        if req.provider == "elevenlabs":
            audio_bytes = provider.synthesize_speech(req.text, language=req.language, voice_id=req.voice_id, stability=req.stability)
        elif req.provider in ("sarvam", "openai"):
            audio_bytes = provider.synthesize_speech(req.text, language=req.language, voice_id=req.voice_id, speed=req.speed)
        else:
            audio_bytes = provider.synthesize_speech(req.text, language=req.language, voice_id=req.voice_id)

        return {
            "status": "synthesized",
            "configured": True,
            "provider": req.provider,
            "voice_id": req.voice_id,
            "language": req.language,
            "content_type": "audio/mpeg",
            "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
            "byte_length": len(audio_bytes),
        }
    except VoiceProviderPlanError as e:
        return {
            "status": "plan_upgrade_required",
            "configured": True,
            "verified": False,
            "requires_paid_plan_or_custom_voice": True,
            "provider": req.provider,
            "voice_id": req.voice_id,
            "language": req.language,
            "message": str(e),
            "audio_base64": None,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice preview failed: {str(e)}")


@router.post("/{voice_profile_id}/test")
def test_voice_profile(
    voice_profile_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM voice_profiles WHERE id = ?", (voice_profile_id,))
    profile = cur.fetchone()
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")

    provider = get_voice_provider(profile["provider"])
    now = datetime.now(timezone.utc).isoformat()

    if not getattr(provider, "is_configured", False):
        cur.execute(
            "UPDATE voice_profiles SET verified_status = 'sandbox_only', last_tested_at = ? WHERE id = ?",
            (now, voice_profile_id)
        )
        db.commit()
        return {
            "status": "sandbox_only",
            "verified": False,
            "voice_profile_id": voice_profile_id,
            "provider": profile["provider"],
            "message": f"Provider '{profile['provider']}' is not configured. Marked as sandbox_only until live credentials pass synthesis test."
        }

    try:
        audio = provider.synthesize_speech(
            "Testing Trivaana AI voice verification.",
            language=profile["language"],
            voice_id=profile["provider_voice_id"],
        )
        verified = len(audio) > 32
        new_status = "verified" if verified else "failed"
        cur.execute(
            "UPDATE voice_profiles SET verified_status = ?, last_tested_at = ? WHERE id = ?",
            (new_status, now, voice_profile_id)
        )
        db.commit()
        return {
            "status": new_status,
            "verified": verified,
            "voice_profile_id": voice_profile_id,
            "byte_length": len(audio),
            "last_tested_at": now,
        }
    except VoiceProviderPlanError as e:
        cur.execute(
            "UPDATE voice_profiles SET verified_status = 'plan_upgrade_required', last_tested_at = ? WHERE id = ?",
            (now, voice_profile_id)
        )
        db.commit()
        return {
            "status": "plan_upgrade_required",
            "verified": False,
            "requires_paid_plan_or_custom_voice": True,
            "voice_profile_id": voice_profile_id,
            "message": str(e),
            "error": str(e),
        }
    except Exception as e:
        cur.execute(
            "UPDATE voice_profiles SET verified_status = 'failed', last_tested_at = ? WHERE id = ?",
            (now, voice_profile_id)
        )
        db.commit()
        return {
            "status": "failed",
            "verified": False,
            "voice_profile_id": voice_profile_id,
            "error": str(e),
        }

