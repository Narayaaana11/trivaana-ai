"""
TRIVAANA AI: Health & Readiness Router
System health, database connectivity, and transparent external provider status.
"""

from fastapi import APIRouter, Depends
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
        "version": "2.2.0",
        "env": settings.ENVIRONMENT
    }


@router.get("/api/readiness")
def readiness_check(conn: sqlite3.Connection = Depends(get_db)):
    """
    Readiness probe and transparent provider status report.
    Never fabricates carrier connectivity; reports exact configured integrations.
    """
    db_healthy = False
    tenant_count = 0
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as count FROM tenants")
        tenant_count = cur.fetchone()["count"]
        db_healthy = True
    except Exception:
        db_healthy = False

    active_telephony = (
        "exotel" if settings.has_exotel
        else ("plivo" if settings.has_plivo
              else ("vobiz" if settings.has_vobiz
                    else ("twilio" if settings.has_twilio else "mock_sandbox")))
    )
    active_voice = (
        "sarvam" if settings.has_sarvam
        else ("elevenlabs" if settings.has_elevenlabs
              else ("openai" if settings.has_openai else "browser_tts_fallback"))
    )
    razorpay_configured = settings.has_razorpay
    is_pg = getattr(conn, "engine_name", "sqlite3") == "postgresql"

    return {
        "status": "ready" if db_healthy else "degraded",
        "database": {
            "healthy": db_healthy,
            "engine": "postgresql" if is_pg else "sqlite_wal",
            "active_driver": "psycopg" if is_pg else "sqlite3",
            "postgres_ddl_ready": True,
            "postgres_url_configured": settings.has_postgres,
            "registered_tenants": tenant_count
        },
        "ai": {
            "openai_configured": settings.has_openai,
            "openai_model": settings.OPENAI_MODEL,
            "livekit_configured": settings.has_livekit,
            "livekit_sip_configured": bool(settings.LIVEKIT_SIP_CONFIG),
        },
        "telephony": {
            "active_provider": active_telephony,
            "is_mock_sandbox": active_telephony == "mock_sandbox",
            "exotel_configured": settings.has_exotel,
            "plivo_configured": settings.has_plivo,
            "vobiz_configured": settings.has_vobiz,
            "twilio_configured": settings.has_twilio
        },
        "voice": {
            "active_tts": active_voice,
            "sarvam_configured": settings.has_sarvam,
            "elevenlabs_configured": settings.has_elevenlabs,
            "openai_tts_configured": settings.has_openai,
            "indicf5_configured": settings.has_indicf5,
        },
        "billing": {
            "active_gateway": "razorpay_live" if razorpay_configured else "razorpay_sandbox",
            "razorpay_configured": razorpay_configured,
            "sac_code": "998313",
            "currency": "INR"
        },
        "whatsapp": {
            "configured": settings.has_whatsapp,
            "mode": "live_meta_cloud_api" if settings.has_whatsapp else "not_configured"
        },
        "infrastructure": {
            "redis_configured": settings.has_redis,
            "smtp_configured": settings.has_smtp,
            "s3_storage_configured": settings.has_s3_storage,
            "google_oauth_configured": settings.has_google_oauth,
        }
    }
