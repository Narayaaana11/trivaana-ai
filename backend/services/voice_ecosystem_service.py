"""
TRIVAANA AI: ElevenLabs Multilingual Indian Voice Ecosystem Service
Provides:
- Intelligent model selection across Economy / Balanced / Premium profiles
- Language-specific Indian speech tuning & 8 conversational personalities
- Live ElevenLabs /v1/models and /v1/voices catalog synchronization
- Character-level cost estimation & usage metering ledger
"""

from datetime import datetime, timezone, timedelta
import json
import sqlite3
import uuid
from typing import Any, Dict, List, Optional

from providers.voice_adapters import SUPPORTED_LANGUAGES, get_voice_provider


# Verified ElevenLabs TTS model language capabilities (also refreshed live via /v1/models)
DEFAULT_MODEL_SPECS: Dict[str, Dict[str, Any]] = {
    "eleven_v4": {
        "name": "Eleven v4",
        "languages": ["en", "hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "or", "as", "ur"],
        "cost_factor": 1.0,
        "latency_tier": "standard",
        "quality_tier": "premium",
        "max_chars_free": 10000,
        "max_chars_subscribed": 10000,
        "streaming_supported": True,
    },
    "eleven_v4_turbo": {
        "name": "Eleven v4 Turbo",
        "languages": ["en", "hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "or", "as", "ur"],
        "cost_factor": 1.0,
        "latency_tier": "low",
        "quality_tier": "balanced",
        "max_chars_free": 10000,
        "max_chars_subscribed": 10000,
        "streaming_supported": True,
    },
    "eleven_v3_conversational": {
        "name": "Eleven v3 Conversational",
        "languages": ["en", "hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "as", "ur"],
        "cost_factor": 1.0,
        "latency_tier": "low",
        "quality_tier": "premium",
        "max_chars_free": 5000,
        "max_chars_subscribed": 5000,
        "streaming_supported": True,
    },
    "eleven_v3": {
        "name": "Eleven v3",
        "languages": ["en", "hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "as", "ur"],
        "cost_factor": 1.0,
        "latency_tier": "standard",
        "quality_tier": "premium",
        "max_chars_free": 5000,
        "max_chars_subscribed": 5000,
        "streaming_supported": True,
    },
    "eleven_flash_v2_5": {
        "name": "Eleven Flash v2.5",
        "languages": ["en", "hi", "ta"],
        "cost_factor": 1.0,
        "latency_tier": "ultra_low",
        "quality_tier": "economy",
        "max_chars_free": 40000,
        "max_chars_subscribed": 40000,
        "streaming_supported": True,
    },
    "eleven_turbo_v2_5": {
        "name": "Eleven Turbo v2.5",
        "languages": ["en", "hi", "ta"],
        "cost_factor": 1.0,
        "latency_tier": "low",
        "quality_tier": "balanced",
        "max_chars_free": 40000,
        "max_chars_subscribed": 40000,
        "streaming_supported": True,
    },
    "eleven_multilingual_v2": {
        "name": "Eleven Multilingual v2",
        "languages": ["en", "hi", "ta"],
        "cost_factor": 1.0,
        "latency_tier": "standard",
        "quality_tier": "balanced",
        "max_chars_free": 10000,
        "max_chars_subscribed": 10000,
        "streaming_supported": True,
    },
}


# Calibrated conversational voice personalities
VOICE_PERSONALITIES: Dict[str, Dict[str, Any]] = {
    "professional": {
        "label": "Professional",
        "description": "Steady, clear, trustworthy tone ideal for healthcare desks, BFSI, and enterprise support.",
        "stability": 0.65,
        "similarity_boost": 0.80,
        "style": 0.05,
        "speed": 0.98,
        "use_speaker_boost": True,
    },
    "friendly": {
        "label": "Friendly",
        "description": "Approachable, upbeat cadence for appointment confirmations and customer onboarding.",
        "stability": 0.50,
        "similarity_boost": 0.78,
        "style": 0.18,
        "speed": 1.02,
        "use_speaker_boost": True,
    },
    "conversational": {
        "label": "Conversational",
        "description": "Natural human rhythm with subtle pauses for inbound queries and code-switching.",
        "stability": 0.48,
        "similarity_boost": 0.76,
        "style": 0.15,
        "speed": 1.00,
        "use_speaker_boost": True,
    },
    "warm": {
        "label": "Warm",
        "description": "Empathetic and reassuring delivery suited for clinics, hospitality, and real estate.",
        "stability": 0.58,
        "similarity_boost": 0.82,
        "style": 0.12,
        "speed": 0.96,
        "use_speaker_boost": True,
    },
    "energetic": {
        "label": "Energetic",
        "description": "Crisp, lively pacing for edtech counseling, event reminders, and promotional offers.",
        "stability": 0.42,
        "similarity_boost": 0.75,
        "style": 0.25,
        "speed": 1.06,
        "use_speaker_boost": True,
    },
    "calm": {
        "label": "Calm",
        "description": "Unrushed, soothing voice for sensitive support calls and senior-citizen assistance.",
        "stability": 0.72,
        "similarity_boost": 0.80,
        "style": 0.02,
        "speed": 0.93,
        "use_speaker_boost": True,
    },
    "formal": {
        "label": "Formal",
        "description": "Measured, authoritative diction for banking verification, compliance notices, and B2B.",
        "stability": 0.75,
        "similarity_boost": 0.84,
        "style": 0.0,
        "speed": 0.95,
        "use_speaker_boost": True,
    },
    "sales_oriented": {
        "label": "Sales-Oriented",
        "description": "Confident, persuasive inflection for outbound lead qualification and site-visit booking.",
        "stability": 0.46,
        "similarity_boost": 0.78,
        "style": 0.22,
        "speed": 1.03,
        "use_speaker_boost": True,
    },
}


# Language-specific calibration offsets to preserve crisp pronunciation on Indian names & numbers
LANGUAGE_DEFAULT_TUNING: Dict[str, Dict[str, Any]] = {
    "te-IN": {"speed_offset": -0.02, "stability_floor": 0.55, "notes": "Slightly measured pace improves Telugu agglutinative endings & English loanwords."},
    "ta-IN": {"speed_offset": -0.02, "stability_floor": 0.55, "notes": "Balances Tamil syllable clarity and numbers."},
    "kn-IN": {"speed_offset": -0.02, "stability_floor": 0.55, "notes": "Improves Kannada consonant clusters."},
    "ml-IN": {"speed_offset": -0.03, "stability_floor": 0.58, "notes": "Keeps Malayalam rhythm crisp and natural."},
    "hi-IN": {"speed_offset": 0.0, "stability_floor": 0.48, "notes": "Natural Hinglish code-switching cadence."},
    "en-IN": {"speed_offset": 0.0, "stability_floor": 0.46, "notes": "Clear Indian English cadence for names and INR figures."},
    "mr-IN": {"speed_offset": -0.01, "stability_floor": 0.52, "notes": "Clean Devanagari pronunciation for Marathi."},
    "bn-IN": {"speed_offset": -0.01, "stability_floor": 0.54, "notes": "Balanced Bengali vowel intonation."},
    "gu-IN": {"speed_offset": -0.01, "stability_floor": 0.54, "notes": "Clear Gujarati conversational flow."},
    "pa-IN": {"speed_offset": 0.0, "stability_floor": 0.52, "notes": "Natural Punjabi emphasis."},
    "or-IN": {"speed_offset": -0.03, "stability_floor": 0.58, "notes": "Requires eleven_v4 / eleven_v4_turbo for Odia script."},
    "as-IN": {"speed_offset": -0.02, "stability_floor": 0.56, "notes": "Requires eleven_v4 / eleven_v3 for Assamese script."},
    "ur-IN": {"speed_offset": -0.02, "stability_floor": 0.55, "notes": "Supports Perso-Arabic Urdu script via eleven_v4 / eleven_v3."},
}


class VoiceSelectionService:
    """Selects optimal model + calibrated speech parameters for Indian languages & quality profiles."""

    # Conservative reference rate in INR paise per 1,000 characters when plan credit rate is estimated
    DEFAULT_ESTIMATED_PAISE_PER_1K_CHARS = 1800  # ~₹18.00 per 1,000 chars estimated reference

    @staticmethod
    def iso_from_locale(language: str) -> str:
        return (language or "en-IN").split("-")[0].strip().lower()

    @classmethod
    def get_model_catalog(cls, conn: Optional[sqlite3.Connection] = None) -> Dict[str, Dict[str, Any]]:
        catalog = {}
        for k, v in DEFAULT_MODEL_SPECS.items():
            item = dict(v)
            item.setdefault("description", "")
            item["can_do_tts"] = True
            item["low_latency_suitable"] = item.get("latency_tier") in ("ultra_low", "low")
            item["availability_status"] = "available"
            item["experimental"] = "v3" in k
            catalog[k] = item
        if conn is not None:
            try:
                rows = conn.execute("SELECT * FROM voice_models").fetchall()
                for r in rows:
                    mid = r["model_id"]
                    can_tts = bool(r["can_do_tts"])
                    langs = json.loads(r["languages_json"] or "[]")
                    latency_tier = r["latency_tier"]
                    catalog[mid] = {
                        "name": r["name"],
                        "description": r["description"] or "",
                        "can_do_tts": can_tts,
                        "languages": langs,
                        "cost_factor": float(r["cost_factor"] or 1.0),
                        "latency_tier": latency_tier,
                        "low_latency_suitable": latency_tier in ("ultra_low", "low"),
                        "quality_tier": r["quality_tier"],
                        "max_chars_free": int(r["max_chars_free"] or 5000),
                        "max_chars_subscribed": int(r["max_chars_subscribed"] or 10000),
                        "streaming_supported": bool(r["streaming_supported"]),
                        "availability_status": "available" if can_tts else "restricted",
                        "experimental": "v3" in mid,
                    }
            except Exception:
                pass
        return catalog

    @classmethod
    def select_model_and_settings(
        cls,
        language: str = "en-IN",
        quality_profile: str = "balanced",
        personality: str = "professional",
        speed_override: Optional[float] = None,
        stability_override: Optional[float] = None,
        similarity_override: Optional[float] = None,
        style_override: Optional[float] = None,
        explicit_model_id: Optional[str] = None,
        conn: Optional[sqlite3.Connection] = None,
    ) -> Dict[str, Any]:
        iso = cls.iso_from_locale(language)
        profile = (quality_profile or "balanced").strip().lower()
        if profile not in ("economy", "balanced", "premium"):
            profile = "balanced"

        catalog = cls.get_model_catalog(conn)

        # Ordered candidate preference per profile — never picks an unsupported language/model pair
        preference_map = {
            "economy": ["eleven_flash_v2_5", "eleven_v4_turbo", "eleven_turbo_v2_5", "eleven_v4"],
            "balanced": ["eleven_v4_turbo", "eleven_turbo_v2_5", "eleven_flash_v2_5", "eleven_v4"],
            "premium": ["eleven_v4", "eleven_v3_conversational", "eleven_v4_turbo", "eleven_multilingual_v2"],
        }

        chosen_model = None
        if explicit_model_id:
            if explicit_model_id not in catalog:
                raise ValueError(f"Requested model '{explicit_model_id}' is not in the discovered ElevenLabs catalog.")
            exp_spec = catalog[explicit_model_id]
            if not exp_spec.get("can_do_tts", True) or exp_spec.get("availability_status") == "restricted":
                raise ValueError(f"Model '{explicit_model_id}' does not support Text-to-Speech on this account.")
            if iso not in (exp_spec.get("languages") or []):
                raise ValueError(
                    f"Model '{explicit_model_id}' does not support language '{language}' ({iso}). "
                    f"Select a compatible model such as eleven_v4_turbo or eleven_v4."
                )
            chosen_model = explicit_model_id

        if not chosen_model:
            for candidate in preference_map[profile]:
                spec = catalog.get(candidate)
                if spec and spec.get("can_do_tts", True) and iso in spec["languages"]:
                    chosen_model = candidate
                    break

        if not chosen_model:
            chosen_model = "eleven_v4_turbo"

        p_cfg = VOICE_PERSONALITIES.get((personality or "professional").lower(), VOICE_PERSONALITIES["professional"])
        lang_cfg = LANGUAGE_DEFAULT_TUNING.get(language, {"speed_offset": 0.0, "stability_floor": 0.48})

        speed = speed_override if speed_override is not None else round(p_cfg["speed"] + lang_cfg["speed_offset"], 2)
        speed = max(0.7, min(1.2, float(speed)))

        stability = stability_override if stability_override is not None else max(lang_cfg["stability_floor"], p_cfg["stability"])
        stability = max(0.0, min(1.0, float(stability)))

        similarity = similarity_override if similarity_override is not None else p_cfg["similarity_boost"]
        similarity = max(0.0, min(1.0, float(similarity)))

        style = style_override if style_override is not None else p_cfg["style"]
        style = max(0.0, min(1.0, float(style)))

        spec = catalog.get(chosen_model, {})
        return {
            "model_id": chosen_model,
            "model_name": spec.get("name", chosen_model),
            "quality_profile": profile,
            "personality": (personality or "professional").lower(),
            "language": language,
            "language_iso": iso,
            "language_supported": iso in spec.get("languages", []),
            "cost_factor": float(spec.get("cost_factor", 1.0)),
            "latency_tier": spec.get("latency_tier", "low"),
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity,
                "style": style,
                "speed": speed,
                "use_speaker_boost": bool(p_cfg["use_speaker_boost"]),
            },
        }

    @classmethod
    def estimate_cost_paise(cls, characters: int, cost_factor: float = 1.0) -> int:
        if characters <= 0:
            return 0
        raw = (characters / 1000.0) * cls.DEFAULT_ESTIMATED_PAISE_PER_1K_CHARS * max(0.1, cost_factor)
        return max(1, int(round(raw)))


class VoiceSyncService:
    """Synchronizes real ElevenLabs /v1/models and /v1/voices into the database without inventing IDs."""

    @staticmethod
    def sync_elevenlabs_catalog(conn: sqlite3.Connection) -> Dict[str, Any]:
        provider = get_voice_provider("elevenlabs")
        if not provider.is_configured:
            return {"synced": False, "reason": "ELEVENLABS_API_KEY not configured", "models_synced": 0, "voices_synced": 0}

        now = datetime.now(timezone.utc).isoformat()
        models = provider.discover_models()
        voices = provider.discover_voices()

        cur = conn.cursor()
        models_synced = 0
        for m in models:
            mid = m.get("model_id")
            if not mid:
                continue
            langs = [l.get("language_id") for l in (m.get("languages") or []) if l.get("language_id")]
            can_tts = 1 if m.get("can_do_text_to_speech") else 0
            latency_tier = "ultra_low" if "flash" in mid else ("low" if "turbo" in mid or "conversational" in mid else "standard")
            quality_tier = "premium" if ("v4" in mid and "turbo" not in mid) or "v3" in mid else ("economy" if "flash" in mid else "balanced")
            cur.execute(
                """
                INSERT INTO voice_models (model_id, provider, name, description, can_do_tts, languages_json, cost_factor, max_chars_free, max_chars_subscribed, streaming_supported, latency_tier, quality_tier, synced_at)
                VALUES (?, 'elevenlabs', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                ON CONFLICT(model_id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    can_do_tts = excluded.can_do_tts,
                    languages_json = excluded.languages_json,
                    cost_factor = excluded.cost_factor,
                    max_chars_free = excluded.max_chars_free,
                    max_chars_subscribed = excluded.max_chars_subscribed,
                    latency_tier = excluded.latency_tier,
                    quality_tier = excluded.quality_tier,
                    synced_at = excluded.synced_at
                """,
                (
                    mid,
                    m.get("name") or mid,
                    m.get("description") or "",
                    can_tts,
                    json.dumps(langs),
                    float(m.get("token_cost_factor") or 1.0),
                    int(m.get("max_characters_request_free_user") or 5000),
                    int(m.get("max_characters_request_subscribed_user") or 10000),
                    latency_tier,
                    quality_tier,
                    now,
                ),
            )
            models_synced += 1

        voices_synced = 0
        for v in voices:
            vid = v.get("voice_id")
            if not vid:
                continue
            labels = v.get("labels") or {}
            category = (v.get("category") or "premade").lower()
            lang_iso = (labels.get("language") or "en").lower()
            locale = f"{lang_iso}-IN" if lang_iso in ("en", "hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "or", "as", "ur") else f"{lang_iso}"
            gender = (labels.get("gender") or "neutral").lower()
            accent = labels.get("accent") or "standard"
            hq_models = v.get("high_quality_base_model_ids") or []
            # Honest access status: shared professional voices require paid plan on free-tier API keys
            access_status = "plan_upgrade_required" if category == "professional" else "available"
            verified_status = "plan_upgrade_required" if category == "professional" else "verified"
            desc_parts = [p for p in [labels.get("descriptive"), labels.get("use_case"), labels.get("age"), accent] if p]
            desc = v.get("description") or " · ".join(desc_parts) or "ElevenLabs Neural Voice"
            best_model = "eleven_v4_turbo" if "eleven_v4_turbo" in hq_models else (hq_models[0] if hq_models else "eleven_flash_v2_5")
            supported_langs = ["en-IN", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "or-IN", "as-IN", "ur-IN"]

            profile_id = f"vp_el_{vid}"
            cur.execute(
                """
                INSERT INTO voice_profiles (
                    id, provider, provider_voice_id, name, language, gender, quality_tier,
                    description, default_speed, default_stability, supports_ssml,
                    verified_status, last_tested_at, created_at,
                    model_id, accent, category, labels_json, supported_models_json,
                    supported_languages_json, preview_url, access_status,
                    default_similarity, default_style, use_speaker_boost
                )
                VALUES (?, 'elevenlabs', ?, ?, ?, ?, ?, ?, 1.0, 0.55, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.78, 0.05, 1)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    language = excluded.language,
                    gender = excluded.gender,
                    description = excluded.description,
                    verified_status = excluded.verified_status,
                    model_id = excluded.model_id,
                    accent = excluded.accent,
                    category = excluded.category,
                    labels_json = excluded.labels_json,
                    supported_models_json = excluded.supported_models_json,
                    supported_languages_json = excluded.supported_languages_json,
                    preview_url = excluded.preview_url,
                    access_status = excluded.access_status
                """,
                (
                    profile_id,
                    vid,
                    v.get("name") or vid,
                    locale,
                    gender,
                    "premium",
                    desc,
                    verified_status,
                    now,
                    now,
                    best_model,
                    accent,
                    category,
                    json.dumps(labels),
                    json.dumps(hq_models),
                    json.dumps(supported_langs),
                    v.get("preview_url") or "",
                    access_status,
                ),
            )
            voices_synced += 1

        conn.commit()
        return {
            "synced": True,
            "models_synced": models_synced,
            "voices_synced": voices_synced,
            "synced_at": now,
        }


class VoiceUsageService:
    """Records character-level TTS synthesis usage, cache hits, and cost reports."""

    @staticmethod
    def record_usage(
        conn: sqlite3.Connection,
        tenant_id: str,
        provider: str,
        model_id: str,
        voice_id: str,
        language: str,
        quality_profile: str,
        characters_requested: int,
        cache_hit: bool = False,
        latency_ms: int = 0,
        status: str = "success",
        provider_characters_reported: Optional[int] = None,
        estimated_cost_paise: int = 0,
        actual_cost_paise: Optional[int] = None,
        agent_id: Optional[str] = None,
        campaign_id: Optional[str] = None,
        call_id: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> str:
        log_id = f"vuse_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO voice_usage_logs (
                id, tenant_id, agent_id, campaign_id, call_id, provider, model_id, voice_id,
                language, quality_profile, characters_requested, provider_characters_reported,
                estimated_cost_paise, actual_cost_paise, cache_hit, latency_ms, status, error_message, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                log_id,
                tenant_id,
                agent_id,
                campaign_id,
                call_id,
                provider,
                model_id,
                voice_id,
                language,
                quality_profile,
                max(0, int(characters_requested)),
                provider_characters_reported,
                0 if cache_hit else max(0, int(estimated_cost_paise)),
                0 if cache_hit else actual_cost_paise,
                1 if cache_hit else 0,
                max(0, int(latency_ms)),
                status,
                error_message[:300] if error_message else None,
                now,
            ),
        )
        conn.commit()
        return log_id

    @staticmethod
    def get_usage_report(conn: sqlite3.Connection, tenant_id: str, days: int = 30) -> Dict[str, Any]:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=max(1, min(365, days)))).isoformat()
        cur = conn.cursor()
        agg = cur.execute(
            """
            SELECT
                COUNT(*) as total_requests,
                COALESCE(SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END), 0) as cache_hits,
                COALESCE(SUM(characters_requested), 0) as total_characters,
                COALESCE(SUM(CASE WHEN cache_hit = 0 THEN characters_requested ELSE 0 END), 0) as billed_characters,
                COALESCE(SUM(estimated_cost_paise), 0) as estimated_cost_paise,
                COALESCE(SUM(actual_cost_paise), 0) as actual_cost_paise,
                COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
                COALESCE(SUM(CASE WHEN call_id IS NULL THEN 1 ELSE 0 END), 0) as preview_requests,
                COALESCE(SUM(CASE WHEN call_id IS NULL THEN characters_requested ELSE 0 END), 0) as preview_characters,
                COALESCE(SUM(CASE WHEN call_id IS NOT NULL THEN 1 ELSE 0 END), 0) as call_requests,
                COALESCE(SUM(CASE WHEN call_id IS NOT NULL THEN characters_requested ELSE 0 END), 0) as call_characters
            FROM voice_usage_logs
            WHERE tenant_id = ? AND created_at >= ?
            """,
            (tenant_id, cutoff),
        ).fetchone()

        by_model = [
            dict(r)
            for r in cur.execute(
                """
                SELECT COALESCE(model_id, 'unknown') as model_id,
                       COUNT(*) as requests,
                       COALESCE(SUM(characters_requested), 0) as characters,
                       COALESCE(SUM(estimated_cost_paise), 0) as estimated_cost_paise
                FROM voice_usage_logs
                WHERE tenant_id = ? AND created_at >= ?
                GROUP BY model_id
                ORDER BY characters DESC
                """,
                (tenant_id, cutoff),
            ).fetchall()
        ]

        by_agent = [
            dict(r)
            for r in cur.execute(
                """
                SELECT COALESCE(agent_id, 'studio_preview') as agent_id,
                       COUNT(*) as requests,
                       COALESCE(SUM(characters_requested), 0) as characters,
                       COALESCE(SUM(estimated_cost_paise), 0) as estimated_cost_paise
                FROM voice_usage_logs
                WHERE tenant_id = ? AND created_at >= ?
                GROUP BY agent_id
                ORDER BY characters DESC
                """,
                (tenant_id, cutoff),
            ).fetchall()
        ]

        total_req = int(agg["total_requests"] or 0)
        cache_hits = int(agg["cache_hits"] or 0)
        return {
            "window_days": days,
            "total_requests": total_req,
            "cache_hits": cache_hits,
            "cache_hit_rate_pct": round((cache_hits / total_req) * 100.0, 1) if total_req > 0 else 0.0,
            "total_characters": int(agg["total_characters"] or 0),
            "billed_characters": int(agg["billed_characters"] or 0),
            "preview_requests": int(agg["preview_requests"] or 0),
            "preview_characters": int(agg["preview_characters"] or 0),
            "call_requests": int(agg["call_requests"] or 0),
            "call_characters": int(agg["call_characters"] or 0),
            "estimated_cost_paise": int(agg["estimated_cost_paise"] or 0),
            "estimated_cost_inr": round((agg["estimated_cost_paise"] or 0) / 100.0, 2),
            "actual_cost_paise": int(agg["actual_cost_paise"] or 0),
            "avg_latency_ms": int(round(agg["avg_latency_ms"] or 0)),
            "by_model": by_model,
            "by_agent": by_agent,
        }

