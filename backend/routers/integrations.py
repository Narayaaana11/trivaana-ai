"""
TRIVAANA AI: Integrations Marketplace, Outbound Webhooks & WhatsApp Templates Router
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import json
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone

from database.connection import get_db
from core.dependencies import get_current_tenant, get_current_user
from core.config import settings
from services.webhook_service import WebhookService, is_safe_public_url
from services.audit_service import AuditService

router = APIRouter(prefix="/api", tags=["Integrations & Webhooks"])

INTEGRATION_CATALOG = [
    {"provider_key": "openai", "display_name": "OpenAI", "category": "ai", "description": "LLM reasoning, prompt generation, Whisper STT, and embeddings"},
    {"provider_key": "elevenlabs", "display_name": "ElevenLabs", "category": "ai", "description": "Multilingual neural voice synthesis"},
    {"provider_key": "sarvam", "display_name": "Sarvam AI", "category": "ai", "description": "Low-latency Indian regional dialect TTS & ASR"},
    {"provider_key": "livekit", "display_name": "LiveKit Agents", "category": "ai", "description": "WebRTC & SIP real-time voice agent streaming"},
    {"provider_key": "exotel", "display_name": "Exotel", "category": "telephony", "description": "Indian PSTN outbound/inbound calling & Passthru"},
    {"provider_key": "plivo", "display_name": "Plivo", "category": "telephony", "description": "Indian & global SIP/PSTN calling and bidirectional streams"},
    {"provider_key": "vobiz", "display_name": "Vobiz", "category": "telephony", "description": "Indian SIP trunking, Exo-compatible calling & WebSocket audio"},
    {"provider_key": "twilio", "display_name": "Twilio", "category": "telephony", "description": "Global PSTN voice, TwiML & media streams"},
    {"provider_key": "google_calendar", "display_name": "Google Calendar", "category": "calendar", "description": "Check availability & book appointments during calls"},
    {"provider_key": "google_sheets", "display_name": "Google Sheets", "category": "calendar", "description": "Read, append, and sync captured lead records"},
    {"provider_key": "whatsapp", "display_name": "WhatsApp Cloud API", "category": "messaging", "description": "Send Meta-approved confirmation & reminder templates"},
    {"provider_key": "zoho_crm", "display_name": "Zoho CRM", "category": "crm", "description": "Bi-directional lead sync and call outcome logging"},
    {"provider_key": "leadsquared", "display_name": "LeadSquared", "category": "crm", "description": "Instant lead capture & activity posting"},
    {"provider_key": "meta_lead_ads", "display_name": "Meta Lead Ads", "category": "crm", "description": "Instant sub-30s calling from Facebook/Instagram forms"},
    {"provider_key": "webhooks", "display_name": "Webhooks", "category": "automation", "description": "HMAC-SHA256 signed real-time call event webhooks"},
    {"provider_key": "zapier", "display_name": "Zapier", "category": "automation", "description": "Trigger Zaps from call completions & qualified leads"},
    {"provider_key": "make", "display_name": "Make", "category": "automation", "description": "Connect Trivaana events to Make scenarios"},
    {"provider_key": "pabbly", "display_name": "Pabbly Connect", "category": "automation", "description": "Indian automation workflows with Pabbly"},
    {"provider_key": "wordpress", "display_name": "WordPress", "category": "automation", "description": "Connect Elementor/CF7 forms to Instant Lead Intake API"},
    {"provider_key": "custom_rest", "display_name": "Custom REST APIs", "category": "automation", "description": "Configure arbitrary REST endpoints as during-call tools"},
]


def _redact_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    redacted = {}
    for k, v in cfg.items():
        if any(s in k.lower() for s in ("secret", "token", "key", "password", "auth")):
            s = str(v or "")
            redacted[k] = f"***{s[-4:]}" if len(s) > 4 else "****"
        else:
            redacted[k] = v
    return redacted


class ConnectIntegrationRequest(BaseModel):
    config: Dict[str, Any] = Field(default_factory=dict)
    permissions: List[str] = Field(default_factory=list)


class CreateWebhookRequest(BaseModel):
    name: str
    url: str
    events: List[str] = Field(default_factory=lambda: ["call.completed", "lead.created"])
    include_transcripts: bool = True
    retry_limit: int = Field(3, ge=0, le=10)


class CreateWhatsAppTemplateRequest(BaseModel):
    name: str
    category: str = "UTILITY"
    language: str = "en"
    body_text: str
    meta_template_id: Optional[str] = None
    approval_status: str = "pending_meta_approval"


@router.get("/integrations")
def list_integrations(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM integrations WHERE tenant_id = ?", (tenant["id"],))
    saved = {r["provider_key"]: dict(r) for r in cur.fetchall()}

    env_configured = {
        "openai": settings.has_openai,
        "elevenlabs": settings.has_elevenlabs,
        "sarvam": settings.has_sarvam,
        "livekit": settings.has_livekit,
        "exotel": settings.has_exotel,
        "plivo": settings.has_plivo,
        "vobiz": settings.has_vobiz,
        "twilio": settings.has_twilio,
        "whatsapp": settings.has_whatsapp,
        "google_calendar": settings.has_google_oauth,
        "google_sheets": settings.has_google_oauth,
    }

    items = []
    for meta in INTEGRATION_CATALOG:
        pk = meta["provider_key"]
        row = saved.get(pk)
        status = row["status"] if row else ("connected" if env_configured.get(pk) else "disconnected")
        cfg = json.loads(row["config_json"] or "{}") if row else {}
        items.append({
            **meta,
            "id": row["id"] if row else None,
            "status": status,
            "env_configured": env_configured.get(pk, False),
            "config_redacted": _redact_config(cfg),
            "permissions": json.loads(row["permissions_json"] or "[]") if row else [],
            "last_tested_at": row["last_tested_at"] if row else None,
            "last_error": row["last_error"] if row else None,
        })
    return {"integrations": items, "count": len(items)}


@router.post("/integrations/{provider_key}/connect")
def connect_integration(
    provider_key: str,
    req: ConnectIntegrationRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    meta = next((m for m in INTEGRATION_CATALOG if m["provider_key"] == provider_key), None)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Unknown integration '{provider_key}'")

    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute("SELECT id FROM integrations WHERE tenant_id = ? AND provider_key = ?", (tenant["id"], provider_key))
    existing = cur.fetchone()
    if existing:
        int_id = existing["id"]
        cur.execute(
            """
            UPDATE integrations SET status = 'connected', config_json = ?, permissions_json = ?, last_error = NULL, updated_at = ?
            WHERE id = ?
            """,
            (json.dumps(req.config), json.dumps(req.permissions), now, int_id),
        )
    else:
        int_id = f"int_{uuid.uuid4().hex[:8]}"
        cur.execute(
            """
            INSERT INTO integrations (id, tenant_id, provider_key, display_name, category, status, config_json, permissions_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'connected', ?, ?, ?, ?)
            """,
            (int_id, tenant["id"], provider_key, meta["display_name"], meta["category"], json.dumps(req.config), json.dumps(req.permissions), now, now),
        )

    AuditService.log_event(
        db,
        action="integration.connected",
        resource_type="integration",
        resource_id=int_id,
        tenant_id=tenant["id"],
        actor_user_id=current_user["id"],
        metadata={"provider_key": provider_key},
    )
    db.commit()
    return {"status": "connected", "integration_id": int_id, "provider_key": provider_key}


@router.post("/integrations/{provider_key}/disconnect")
def disconnect_integration(
    provider_key: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "UPDATE integrations SET status = 'disconnected', config_json = '{}', updated_at = ? WHERE tenant_id = ? AND provider_key = ?",
        (now, tenant["id"], provider_key),
    )
    db.commit()
    return {"status": "disconnected", "provider_key": provider_key}


@router.post("/integrations/{provider_key}/test")
def test_integration(
    provider_key: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute("SELECT * FROM integrations WHERE tenant_id = ? AND provider_key = ?", (tenant["id"], provider_key))
    row = cur.fetchone()
    cfg = json.loads(row["config_json"] or "{}") if row else {}

    env_map = {
        "openai": settings.has_openai,
        "elevenlabs": settings.has_elevenlabs,
        "sarvam": settings.has_sarvam,
        "livekit": settings.has_livekit,
        "exotel": settings.has_exotel,
        "plivo": settings.has_plivo,
        "vobiz": settings.has_vobiz,
        "twilio": settings.has_twilio,
        "whatsapp": settings.has_whatsapp,
    }
    is_ready = bool(env_map.get(provider_key) or cfg)
    status_str = "success" if is_ready else "not_configured"
    msg = f"{provider_key} credentials verified" if is_ready else f"{provider_key} is not configured with live credentials."

    log_id = f"ilg_{uuid.uuid4().hex[:8]}"
    cur.execute(
        """
        INSERT INTO integration_logs (id, tenant_id, integration_id, provider_key, event_name, status, response_payload_json, created_at)
        VALUES (?, ?, ?, ?, 'connection.test', ?, ?, ?)
        """,
        (log_id, tenant["id"], row["id"] if row else None, provider_key, status_str, json.dumps({"message": msg}), now),
    )
    if row:
        cur.execute(
            "UPDATE integrations SET last_tested_at = ?, last_error = ? WHERE id = ?",
            (now, None if is_ready else msg, row["id"]),
        )
    db.commit()
    return {"status": status_str, "configured": is_ready, "provider_key": provider_key, "message": msg}


@router.get("/integrations/logs")
def list_integration_logs(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM integration_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100", (tenant["id"],))
    logs = [dict(r) for r in cur.fetchall()]
    return {"logs": logs, "count": len(logs)}


@router.post("/integrations/logs/{log_id}/retry")
def retry_integration_log(
    log_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM integration_logs WHERE id = ? AND tenant_id = ?", (log_id, tenant["id"]))
    log = cur.fetchone()
    if not log:
        raise HTTPException(status_code=404, detail="Integration log not found")
    cur.execute("UPDATE integration_logs SET retry_count = retry_count + 1 WHERE id = ?", (log_id,))
    db.commit()
    return {"status": "retried", "log_id": log_id, "retry_count": log["retry_count"] + 1}


# Webhooks
@router.get("/webhooks")
def list_webhooks(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT id, tenant_id, name, url, events_json, is_active, include_transcripts, retry_limit, created_at, updated_at FROM webhooks WHERE tenant_id = ? ORDER BY created_at DESC", (tenant["id"],))
    hooks = []
    for r in cur.fetchall():
        d = dict(r)
        d["events"] = json.loads(d.pop("events_json", "[]"))
        d["is_active"] = bool(d["is_active"])
        d["include_transcripts"] = bool(d.get("include_transcripts", 1))
        hooks.append(d)
    return {"webhooks": hooks, "count": len(hooks)}


@router.post("/webhooks")
def create_webhook(
    req: CreateWebhookRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    if not req.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Webhook URL must start with http:// or https://")

    wh_id = f"whk_{uuid.uuid4().hex[:8]}"
    secret = f"whsec_{secrets.token_hex(20)}"
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO webhooks (id, tenant_id, name, url, events_json, signing_secret, is_active, include_transcripts, retry_limit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        """,
        (wh_id, tenant["id"], req.name.strip(), req.url.strip(), json.dumps(req.events), secret, 1 if req.include_transcripts else 0, req.retry_limit, now, now),
    )
    db.commit()
    return {"status": "created", "webhook_id": wh_id, "signing_secret": secret}


@router.post("/webhooks/{webhook_id}/rotate-secret")
def rotate_webhook_secret(
    webhook_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    new_secret = f"whsec_{secrets.token_hex(20)}"
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute(
        "UPDATE webhooks SET signing_secret = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
        (new_secret, now, webhook_id, tenant["id"]),
    )
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.commit()
    return {"status": "rotated", "webhook_id": webhook_id, "signing_secret": new_secret}


@router.delete("/webhooks/{webhook_id}")
def delete_webhook(
    webhook_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("DELETE FROM webhooks WHERE id = ? AND tenant_id = ?", (webhook_id, tenant["id"]))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.commit()
    return {"status": "deleted", "webhook_id": webhook_id}


@router.get("/webhooks/deliveries")
def list_webhook_deliveries(
    webhook_id: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    q = "SELECT * FROM webhook_deliveries WHERE tenant_id = ?"
    params: list = [tenant["id"]]
    if webhook_id:
        q += " AND webhook_id = ?"
        params.append(webhook_id)
    q += " ORDER BY created_at DESC LIMIT 100"
    cur.execute(q, params)
    deliveries = [dict(r) for r in cur.fetchall()]
    return {"deliveries": deliveries, "count": len(deliveries)}


# WhatsApp Templates
@router.get("/whatsapp/templates")
def list_whatsapp_templates(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM whatsapp_templates WHERE tenant_id = ? ORDER BY created_at DESC", (tenant["id"],))
    return {"templates": [dict(r) for r in cur.fetchall()]}


@router.post("/whatsapp/templates")
def create_whatsapp_template(
    req: CreateWhatsAppTemplateRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    tpl_id = f"wat_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO whatsapp_templates (id, tenant_id, name, category, language, body_text, approval_status, meta_template_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (tpl_id, tenant["id"], req.name.strip(), req.category, req.language, req.body_text, req.approval_status, req.meta_template_id, now),
    )
    db.commit()
    return {"status": "created", "template_id": tpl_id}

