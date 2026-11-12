"""
TRIVAANA AI: Production Deployment Preflight Checker
Evaluates environment security, database/queue infrastructure, and external provider readiness.
Run via CLI: python -m core.preflight
"""

import json
import os
from typing import Any, Dict, List

from core.config import settings


def evaluate_production_preflight() -> Dict[str, Any]:
    checks: List[Dict[str, str]] = []

    is_default_jwt = settings.JWT_SECRET.startswith("trivaana-dev-secret-key")
    checks.append({
        "key": "jwt_secret",
        "label": "JWT Signing Secret",
        "status": "fail" if is_default_jwt else "pass",
        "detail": "Default development JWT secret in use; rotate JWT_SECRET for production." if is_default_jwt else "Custom JWT_SECRET configured.",
    })

    has_enc = bool(settings.ENCRYPTION_MASTER_KEY)
    checks.append({
        "key": "encryption_master_key",
        "label": "Tenant Vault Encryption Key",
        "status": "pass" if has_enc else "warn",
        "detail": "ENCRYPTION_MASTER_KEY configured." if has_enc else "ENCRYPTION_MASTER_KEY missing; tenant credentials use derived fallback.",
    })

    is_https = settings.PUBLIC_BASE_URL.startswith("https://") and "localhost" not in settings.PUBLIC_BASE_URL and "127.0.0.1" not in settings.PUBLIC_BASE_URL
    checks.append({
        "key": "public_base_url",
        "label": "Public HTTPS Webhook Base URL",
        "status": "pass" if is_https else "warn",
        "detail": f"Configured: {settings.PUBLIC_BASE_URL}" if is_https else f"Non-public/HTTP URL ({settings.PUBLIC_BASE_URL}); carrier/Razorpay webhooks require public HTTPS.",
    })

    checks.append({
        "key": "database_url",
        "label": "PostgreSQL + pgvector",
        "status": "pass" if settings.has_postgres else "warn",
        "detail": "DATABASE_URL configured for PostgreSQL." if settings.has_postgres else "Using local SQLite WAL; set DATABASE_URL for multi-pod PostgreSQL.",
    })

    checks.append({
        "key": "redis_url",
        "label": "Redis Rate Limiter & Cache",
        "status": "pass" if settings.has_redis else "warn",
        "detail": "REDIS_URL configured." if settings.has_redis else "Using in-memory single-process rate limiting; set REDIS_URL for multi-pod.",
    })

    has_telephony = any([settings.has_exotel, settings.has_plivo, settings.has_vobiz, settings.has_twilio])
    checks.append({
        "key": "telephony_provider",
        "label": "PSTN Telephony Carrier",
        "status": "pass" if has_telephony else "warn",
        "detail": "At least one live PSTN carrier configured." if has_telephony else "Mock sandbox only; configure Exotel, Plivo, Vobiz, or Twilio.",
    })

    has_voice = any([settings.has_sarvam, settings.has_elevenlabs, settings.has_openai])
    checks.append({
        "key": "voice_provider",
        "label": "AI Voice / TTS Provider",
        "status": "pass" if has_voice else "warn",
        "detail": "Live TTS provider configured." if has_voice else "Browser TTS fallback only; configure Sarvam, ElevenLabs, or OpenAI.",
    })

    has_llm = bool(settings.has_gemini or settings.has_openai)
    checks.append({
        "key": "llm_provider",
        "label": "Primary Conversational LLM",
        "status": "pass" if has_llm else "warn",
        "detail": "Gemini/OpenAI LLM configured." if has_llm else "Deterministic template fallback only; configure GEMINI_API_KEY or OPENAI_API_KEY.",
    })

    checks.append({
        "key": "razorpay",
        "label": "Razorpay Live Checkout",
        "status": "pass" if settings.has_razorpay else "warn",
        "detail": "Razorpay live keys configured." if settings.has_razorpay else "Sandbox top-up mode; configure RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET.",
    })

    checks.append({
        "key": "ncpr_api",
        "label": "National NCPR / DND Scrubbing",
        "status": "pass" if bool(os.environ.get("NCPR_API_URL")) else "warn",
        "detail": "External NCPR_API_URL configured." if bool(os.environ.get("NCPR_API_URL")) else "Local workspace DNC/opt-out registry active; configure NCPR_API_URL for national feed.",
    })

    is_registered_entity = settings.COMPANY_ENTITY_STATUS != "pre_incorporation_beta" and bool(settings.COMPANY_GSTIN)
    checks.append({
        "key": "legal_entity",
        "label": "Indian Legal Entity & GSTIN",
        "status": "pass" if is_registered_entity else "warn",
        "detail": (
            f"{settings.COMPANY_LEGAL_NAME} (GSTIN: {settings.COMPANY_GSTIN})"
            if is_registered_entity
            else f"{settings.COMPANY_LEGAL_NAME} running in '{settings.COMPANY_ENTITY_STATUS}' mode; update COMPANY_ENTITY_STATUS and COMPANY_GSTIN upon incorporation/GST registration."
        ),
    })

    has_fail = any(c["status"] == "fail" for c in checks)
    has_warn = any(c["status"] == "warn" for c in checks)
    return {
        "environment": settings.ENVIRONMENT,
        "ready_for_production": not has_fail and not has_warn,
        "security_baseline_ok": not has_fail,
        "summary": {
            "pass": sum(1 for c in checks if c["status"] == "pass"),
            "warn": sum(1 for c in checks if c["status"] == "warn"),
            "fail": sum(1 for c in checks if c["status"] == "fail"),
        },
        "checks": checks,
    }


if __name__ == "__main__":
    print(json.dumps(evaluate_production_preflight(), indent=2))

