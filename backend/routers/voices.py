"""
TRIVAANA AI: Voice Library, ElevenLabs Discovery, Intelligent Selection & Usage Router
Manages multi-language Indian voice catalog, live ElevenLabs sync, Economy/Balanced/Premium
model selection, calibrated speech previews, favorites, and character-level cost metering.
"""

from collections import deque
from datetime import datetime, timezone
import base64
import json
import sqlite3
import threading
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.config import settings
from core.dependencies import get_current_tenant, get_current_user, require_roles, require_scope
from database.connection import get_db
from providers.voice_adapters import (
    SUPPORTED_LANGUAGES,
    VoiceProviderAuthError,
    VoiceProviderPlanError,
    VoiceProviderRateLimitError,
    VoiceProviderValidationError,
    get_voice_provider,
)
from services.voice_ecosystem_service import (
    LANGUAGE_DEFAULT_TUNING,
    VOICE_PERSONALITIES,
    VoiceSelectionService,
    VoiceSyncService,
    VoiceUsageService,
)

router = APIRouter(prefix="/api/voices", tags=["Voice Management"])

_PREVIEW_RATE_LOCK = threading.Lock()
_PREVIEW_RATE_BUCKETS: Dict[str, deque] = {}
_PREVIEW_RATE_LIMIT = 40
_PREVIEW_RATE_WINDOW_SEC = 60.0


def _enforce_preview_rate_limit(tenant_id: str) -> None:
    now = time.monotonic()
    with _PREVIEW_RATE_LOCK:
        bucket = _PREVIEW_RATE_BUCKETS.setdefault(tenant_id, deque())
        while bucket and (now - bucket[0]) > _PREVIEW_RATE_WINDOW_SEC:
            bucket.popleft()
        if len(bucket) >= _PREVIEW_RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="Voice preview rate limit exceeded (40 requests/minute). Please wait a moment and retry.",
            )
        bucket.append(now)


class VoicePreviewRequest(BaseModel):
    voice_id: str = Field("EXAVITQu4vr4xnSDxMaL", min_length=1, max_length=120)
    provider: str = "elevenlabs"
    language: str = "en-IN"
    text: str = Field("Namaskaram! Welcome to Trivaana AI voice calling platform.", min_length=1, max_length=1500)
    quality_profile: str = "balanced"
    personality: str = "professional"
    model_id: Optional[str] = None
    speed: Optional[float] = Field(None, ge=0.7, le=1.2)
    stability: Optional[float] = Field(None, ge=0.0, le=1.0)
    similarity_boost: Optional[float] = Field(None, ge=0.0, le=1.0)
    style: Optional[float] = Field(None, ge=0.0, le=1.0)
    agent_id: Optional[str] = None


class VoiceBenchmarkRequest(BaseModel):
    voice_id: str = "EXAVITQu4vr4xnSDxMaL"
    quality_profile: str = "balanced"
    personality: str = "professional"
    languages: Optional[List[str]] = None


@router.get("/languages")
def list_supported_languages(db: sqlite3.Connection = Depends(get_db)):
    cur = db.cursor()
    cur.execute(
        "SELECT language, COUNT(*) as total, SUM(CASE WHEN verified_status = 'verified' THEN 1 ELSE 0 END) as verified_count "
        "FROM voice_profiles GROUP BY language"
    )
    counts = {r["language"]: dict(r) for r in cur.fetchall()}
    model_catalog = VoiceSelectionService.get_model_catalog(db)

    languages = []
    for lang in SUPPORTED_LANGUAGES:
        code = lang["code"]
        iso = lang.get("iso") or code.split("-")[0]
        c = counts.get(code, {"total": 0, "verified_count": 0})
        supporting_models = [
            mid for mid, spec in model_catalog.items() if iso in (spec.get("languages") or [])
        ]
        tuning = LANGUAGE_DEFAULT_TUNING.get(code, {})
        languages.append({
            **lang,
            "voice_count": c["total"],
            "verified_voice_count": c["verified_count"] or 0,
            "supporting_models": supporting_models,
            "elevenlabs_supported": len(supporting_models) > 0,
            "recommended_balanced_model": VoiceSelectionService.select_model_and_settings(code, "balanced", conn=db)["model_id"],
            "recommended_economy_model": VoiceSelectionService.select_model_and_settings(code, "economy", conn=db)["model_id"],
            "recommended_premium_model": VoiceSelectionService.select_model_and_settings(code, "premium", conn=db)["model_id"],
            "tuning_notes": tuning.get("notes", ""),
            "provider_ready": bool(settings.has_elevenlabs or settings.has_sarvam or settings.has_openai or settings.has_indicf5),
        })
    return {"languages": languages, "count": len(languages)}


@router.get("/models", dependencies=[Depends(require_scope("agents:read"))])
def list_voice_models(
    db: sqlite3.Connection = Depends(get_db),
    tenant: dict = Depends(get_current_tenant),
):
    catalog = VoiceSelectionService.get_model_catalog(db)
    models = []
    for mid, spec in catalog.items():
        models.append({"model_id": mid, **spec})
    return {
        "models": models,
        "profiles": {
            "economy": "Lowest cost & ultra-low latency (eleven_flash_v2_5 for en/hi/ta, eleven_v4_turbo for other Indian languages).",
            "balanced": "Default AI Employee profile balancing naturalness, Indian pronunciation, speed, and cost (eleven_v4_turbo).",
            "premium": "Highest fidelity & conversational expressiveness (eleven_v4 / eleven_v3_conversational).",
        },
    }


@router.get("/personalities", dependencies=[Depends(require_scope("agents:read"))])
def list_voice_personalities(tenant: dict = Depends(get_current_tenant)):
    return {
        "personalities": [
            {"id": pid, **cfg} for pid, cfg in VOICE_PERSONALITIES.items()
        ]
    }


@router.get("/verify", dependencies=[Depends(require_scope("agents:read"))])
def verify_elevenlabs_connection(tenant: dict = Depends(get_current_tenant)):
    provider = get_voice_provider("elevenlabs")
    return provider.verify_credentials()


@router.post("/sync", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def sync_elevenlabs_catalog(
    db: sqlite3.Connection = Depends(get_db),
    tenant: dict = Depends(get_current_tenant),
):
    try:
        return VoiceSyncService.sync_elevenlabs_catalog(db)
    except VoiceProviderAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ElevenLabs catalog sync failed: {str(e)}")


@router.get("", dependencies=[Depends(require_scope("agents:read"))])
def list_voices(
    language: Optional[str] = None,
    gender: Optional[str] = None,
    provider: Optional[str] = None,
    category: Optional[str] = None,
    accent: Optional[str] = None,
    model_id: Optional[str] = None,
    search: Optional[str] = None,
    favorites_only: bool = False,
    available_only: bool = False,
    verified_only: bool = False,
    db: sqlite3.Connection = Depends(get_db),
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    cur = db.cursor()
    fav_rows = cur.execute(
        "SELECT voice_profile_id FROM voice_favorites WHERE tenant_id = ? AND user_id = ?",
        (tenant["id"], current_user["id"]),
    ).fetchall()
    fav_ids = {r["voice_profile_id"] for r in fav_rows}

    q = "SELECT * FROM voice_profiles WHERE 1=1"
    params: List[Any] = []
    if gender:
        q += " AND LOWER(gender) = ?"
        params.append(gender.lower())
    if provider:
        q += " AND LOWER(provider) = ?"
        params.append(provider.lower())
    if category:
        q += " AND LOWER(COALESCE(category, '')) = ?"
        params.append(category.lower())
    if accent:
        q += " AND LOWER(COALESCE(accent, '')) = ?"
        params.append(accent.lower())
    if verified_only:
        q += " AND verified_status = 'verified'"
    if available_only:
        q += " AND COALESCE(access_status, 'available') = 'available'"
    q += " ORDER BY CASE WHEN provider = 'elevenlabs' THEN 0 ELSE 1 END, COALESCE(access_status, 'available') ASC, name ASC"

    cur.execute(q, params)
    voices: List[Dict[str, Any]] = []
    search_q = (search or "").strip().lower()
    for r in cur.fetchall():
        d = dict(r)
        prov = d["provider"]
        supported_langs = json.loads(d.get("supported_languages_json") or "[]")
        supported_models = json.loads(d.get("supported_models_json") or "[]")
        labels = json.loads(d.get("labels_json") or "{}")

        if language and d["language"] != language and language not in supported_langs:
            continue
        if model_id and model_id not in supported_models and d.get("model_id") != model_id:
            continue
        if search_q and search_q not in f"{d['name']} {d.get('description') or ''} {d.get('accent') or ''} {d['provider_voice_id']}".lower():
            continue
        is_fav = d["id"] in fav_ids
        if favorites_only and not is_fav:
            continue

        d["labels"] = labels
        d["supported_models"] = supported_models
        d["supported_languages"] = supported_langs
        d["is_favorite"] = is_fav
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
        },
    }


@router.post("/{voice_profile_id}/favorite", dependencies=[Depends(require_scope("agents:write"))])
def add_favorite_voice(
    voice_profile_id: str,
    db: sqlite3.Connection = Depends(get_db),
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        """
        INSERT OR IGNORE INTO voice_favorites (id, tenant_id, user_id, voice_profile_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (f"vfav_{uuid.uuid4().hex[:8]}", tenant["id"], current_user["id"], voice_profile_id, now),
    )
    db.commit()
    return {"status": "favorited", "voice_profile_id": voice_profile_id}


@router.delete("/{voice_profile_id}/favorite", dependencies=[Depends(require_scope("agents:write"))])
def remove_favorite_voice(
    voice_profile_id: str,
    db: sqlite3.Connection = Depends(get_db),
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    db.execute(
        "DELETE FROM voice_favorites WHERE tenant_id = ? AND user_id = ? AND voice_profile_id = ?",
        (tenant["id"], current_user["id"], voice_profile_id),
    )
    db.commit()
    return {"status": "unfavorited", "voice_profile_id": voice_profile_id}


@router.get("/usage", dependencies=[Depends(require_scope("agents:read"))])
def get_voice_usage(
    days: int = 30,
    db: sqlite3.Connection = Depends(get_db),
    tenant: dict = Depends(get_current_tenant),
):
    return VoiceUsageService.get_usage_report(db, tenant["id"], days=days)


@router.post("/preview", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def preview_voice(
    req: VoicePreviewRequest,
    db: sqlite3.Connection = Depends(get_db),
    tenant: dict = Depends(get_current_tenant),
):
    _enforce_preview_rate_limit(tenant["id"])
    provider = get_voice_provider(req.provider)
    configured = getattr(provider, "is_configured", False)

    try:
        selection = VoiceSelectionService.select_model_and_settings(
            language=req.language,
            quality_profile=req.quality_profile,
            personality=req.personality,
            speed_override=req.speed,
            stability_override=req.stability,
            similarity_override=req.similarity_boost,
            style_override=req.style,
            explicit_model_id=req.model_id,
            conn=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    est_paise = VoiceSelectionService.estimate_cost_paise(len(req.text), selection["cost_factor"])

    if not configured:
        return {
            "status": "sandbox_only",
            "configured": False,
            "provider": req.provider,
            "voice_id": req.voice_id,
            "language": req.language,
            "selection": selection,
            "estimated_cost_paise": est_paise,
            "message": f"{req.provider.title()} API credentials are not configured. Server synthesis requires provider credentials.",
            "audio_base64": None,
        }

    t0 = time.perf_counter()
    try:
        cache_hit = False
        reported_chars = len(req.text)
        if req.provider == "elevenlabs":
            vs = selection["voice_settings"]
            audio_bytes, meta = provider.synthesize_speech(
                req.text,
                language=req.language,
                voice_id=req.voice_id,
                stability=vs["stability"],
                similarity_boost=vs["similarity_boost"],
                style=vs["style"],
                speed=vs["speed"],
                use_speaker_boost=vs["use_speaker_boost"],
                model_id=selection["model_id"],
                return_metadata=True,
            )
            cache_hit = bool(meta.get("cache_hit"))
            reported_chars = int(meta.get("provider_characters_reported") or len(req.text))
        elif req.provider in ("sarvam", "openai"):
            audio_bytes = provider.synthesize_speech(
                req.text,
                language=req.language,
                voice_id=req.voice_id,
                speed=req.speed or 1.0,
            )
        else:
            audio_bytes = provider.synthesize_speech(req.text, language=req.language, voice_id=req.voice_id)

        latency_ms = int((time.perf_counter() - t0) * 1000)
        VoiceUsageService.record_usage(
            conn=db,
            tenant_id=tenant["id"],
            provider=req.provider,
            model_id=selection["model_id"],
            voice_id=req.voice_id,
            language=req.language,
            quality_profile=selection["quality_profile"],
            characters_requested=len(req.text),
            cache_hit=cache_hit,
            latency_ms=latency_ms,
            provider_characters_reported=reported_chars,
            estimated_cost_paise=est_paise,
            agent_id=req.agent_id,
        )

        return {
            "status": "synthesized",
            "configured": True,
            "provider": req.provider,
            "voice_id": req.voice_id,
            "language": req.language,
            "model_used": selection["model_id"],
            "quality_profile": selection["quality_profile"],
            "personality": selection["personality"],
            "voice_settings": selection["voice_settings"],
            "cache_hit": cache_hit,
            "latency_ms": latency_ms,
            "characters_requested": len(req.text),
            "estimated_cost_paise": 0 if cache_hit else est_paise,
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
    except (VoiceProviderAuthError, VoiceProviderRateLimitError, VoiceProviderValidationError) as e:
        status_code = 401 if isinstance(e, VoiceProviderAuthError) else (429 if isinstance(e, VoiceProviderRateLimitError) else 400)
        raise HTTPException(status_code=status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice preview failed: {str(e)}")


@router.post("/{voice_profile_id}/test", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin", "operator"]))])
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
            (now, voice_profile_id),
        )
        db.commit()
        return {
            "status": "sandbox_only",
            "verified": False,
            "voice_profile_id": voice_profile_id,
            "provider": profile["provider"],
            "message": f"Provider '{profile['provider']}' is not configured. Marked as sandbox_only until live credentials pass synthesis test.",
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
            "UPDATE voice_profiles SET verified_status = ?, access_status = 'available', last_tested_at = ? WHERE id = ?",
            (new_status, now, voice_profile_id),
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
            "UPDATE voice_profiles SET verified_status = 'plan_upgrade_required', access_status = 'plan_upgrade_required', last_tested_at = ? WHERE id = ?",
            (now, voice_profile_id),
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
            (now, voice_profile_id),
        )
        db.commit()
        return {
            "status": "failed",
            "verified": False,
            "voice_profile_id": voice_profile_id,
            "error": str(e),
        }
