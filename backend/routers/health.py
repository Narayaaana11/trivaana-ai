"""
TRIVAANA AI: Health & Readiness Router
System health, database connectivity, and transparent external provider status.
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any
import sqlite3

from core.config import settings
from core.dependencies import get_db

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check():
    """Liveness probe for load balancers and container orchestrators."""
    return {
        "status": "healthy",
        "service": "Trivaana AI SaaS",
        "version": "1.0.0",
        "env": settings.ENVIRONMENT
    }

@router.get("/api/readiness")
def readiness_check(conn: sqlite3.Connection = Depends(get_db)):
    """
    Readiness probe and transparent provider status report.
    Never fabricates carrier connectivity; reports exact configured integrations.
    """
    # 1. Database check
    db_healthy = False
    tenant_count = 0
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as count FROM tenants")
        tenant_count = cur.fetchone()["count"]
        db_healthy = True
    except Exception:
        db_healthy = False

    # 2. Telephony
    active_telephony = "exotel" if settings.has_exotel else ("twilio" if settings.has_twilio else "mock_sandbox")
    telephony_status = {
        "active_provider": active_telephony,
        "is_mock_sandbox": active_telephony == "mock_sandbox",
        "exotel_configured": settings.has_exotel,
        "twilio_configured": settings.has_twilio
    }

    # 3. Voice Engines
    active_voice = "sarvam" if settings.has_sarvam else ("elevenlabs" if settings.has_elevenlabs else "browser_tts_fallback")
    voice_status = {
        "active_tts": active_voice,
        "sarvam_configured": settings.has_sarvam,
        "elevenlabs_configured": settings.has_elevenlabs
    }

    # 4. Payment Gateway
    razorpay_configured = bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
    billing_status = {
        "active_gateway": "razorpay_live" if razorpay_configured else "razorpay_sandbox",
        "razorpay_configured": razorpay_configured,
        "sac_code": "998313",
        "currency": "INR"
    }

    # 5. WhatsApp API
    whatsapp_configured = bool(settings.WHATSAPP_API_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)

    all_ready = db_healthy

    return {
        "status": "ready" if all_ready else "degraded",
        "database": {
            "healthy": db_healthy,
            "engine": "sqlite_wal",
            "registered_tenants": tenant_count
        },
        "telephony": telephony_status,
        "voice": voice_status,
        "billing": billing_status,
        "whatsapp": {
            "configured": whatsapp_configured,
            "mode": "live_meta_cloud_api" if whatsapp_configured else "not_configured"
        }
    }
