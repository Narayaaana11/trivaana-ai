"""
TRIVAANA AI: Public Instant Lead Intake API
Per-agent secret authentication, rate limiting, duplicate checks, compliance gates, and instant call dispatch.
"""

from collections import defaultdict, deque
from datetime import datetime, timezone
import json
import sqlite3
import time
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from database.connection import get_db
from core.security import hash_api_key
from services.call_service import CallService, normalize_phone
from services.compliance_service import ComplianceService
from services.webhook_service import WebhookService

router = APIRouter(prefix="/api/public", tags=["Public Developer API"])

# Simple per-agent sliding window rate limiter (60 req/min default)
_RATE_BUCKETS: Dict[str, deque] = defaultdict(deque)
RATE_LIMIT_PER_MIN = 60


def _check_rate_limit(agent_slug: str):
    now = time.time()
    q = _RATE_BUCKETS[agent_slug]
    while q and q[0] < now - 60:
        q.popleft()
    if len(q) >= RATE_LIMIT_PER_MIN:
        raise HTTPException(status_code=429, detail="Rate limit exceeded for this lead intake endpoint")
    q.append(now)


def _extract_intake_secret(x_intake_secret: Optional[str], authorization: Optional[str]) -> Optional[str]:
    if x_intake_secret:
        return x_intake_secret.strip()
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


class PublicLeadIntakeRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    city: Optional[str] = None
    consent_confirmed: bool = True
    consent_source: str = "api_lead_intake"
    call_category: str = "service"
    delay_seconds: int = Field(0, ge=0, le=3600)
    bypass_calling_hours: bool = False
    is_sandbox: bool = False
    custom_fields: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "allow"}


@router.get("/lead-intake/{agent_slug}/schema")
def get_lead_intake_schema(
    agent_slug: str,
    x_intake_secret: Optional[str] = Header(None, alias="X-Intake-Secret"),
    authorization: Optional[str] = Header(None),
    db: sqlite3.Connection = Depends(get_db),
):
    secret = _extract_intake_secret(x_intake_secret, authorization)
    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE slug = ?", (agent_slug,))
    agent = cur.fetchone()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent intake endpoint not found")

    if not secret or not agent["intake_secret_hash"] or hash_api_key(secret) != agent["intake_secret_hash"]:
        raise HTTPException(status_code=401, detail="Invalid or missing intake secret")

    extraction = json.loads(agent["extraction_schema_json"] or "[]")
    return {
        "agent_slug": agent_slug,
        "agent_name": agent["name"],
        "language": agent["language"],
        "required_fields": ["name", "phone"],
        "optional_fields": ["email", "city", "consent_confirmed", "call_category", "delay_seconds", "custom_fields"],
        "extraction_schema": extraction,
        "endpoint": f"/api/public/lead-intake/{agent_slug}",
    }


@router.post("/lead-intake/{agent_slug}")
def public_lead_intake(
    agent_slug: str,
    req: PublicLeadIntakeRequest,
    x_intake_secret: Optional[str] = Header(None, alias="X-Intake-Secret"),
    authorization: Optional[str] = Header(None),
    db: sqlite3.Connection = Depends(get_db),
):
    _check_rate_limit(agent_slug)
    secret = _extract_intake_secret(x_intake_secret, authorization)
    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE slug = ?", (agent_slug,))
    agent = cur.fetchone()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent intake endpoint not found")

    if not secret or not agent["intake_secret_hash"] or hash_api_key(secret) != agent["intake_secret_hash"]:
        raise HTTPException(status_code=401, detail="Invalid or missing intake secret")

    if agent["status"] in ("paused", "archived"):
        raise HTTPException(status_code=400, detail=f"AI Employee is currently '{agent['status']}' and cannot accept calls")

    tenant_id = agent["tenant_id"]
    clean_phone = normalize_phone(req.phone)
    digits = "".join(ch for ch in clean_phone if ch.isdigit())
    if len(digits) < 10 or len(digits) > 15:
        raise HTTPException(status_code=400, detail=f"Invalid phone number: '{req.phone}'")

    # Merge any extra top-level fields (e.g. property, budget, location) into custom_fields
    extra_fields = dict(req.model_extra or {})
    merged_custom = {**extra_fields, **(req.custom_fields or {})}
    if req.city:
        merged_custom.setdefault("city", req.city)

    now = datetime.now(timezone.utc).isoformat()

    # Duplicate contact detection
    cur.execute("SELECT * FROM leads WHERE tenant_id = ? AND phone = ?", (tenant_id, clean_phone))
    existing_lead = cur.fetchone()
    duplicate_detected = bool(existing_lead)
    if existing_lead:
        lead_id = existing_lead["id"]
        cur.execute(
            "UPDATE leads SET custom_fields_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(merged_custom), now, lead_id),
        )
    else:
        lead_id = f"lead_{uuid.uuid4().hex[:8]}"
        cur.execute(
            """
            INSERT INTO leads (
                id, tenant_id, name, phone, email, city, vertical, status, lead_status,
                source, consent_status, call_category, opt_out, custom_fields_json, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'new', 'Public Intake API', ?, ?, 0, ?, ?, ?, ?)
            """,
            (
                lead_id, tenant_id, req.name.strip(), clean_phone, req.email,
                req.city or merged_custom.get("location") or "Hyderabad", agent["vertical"],
                "opted_in" if req.consent_confirmed else "pending", req.call_category,
                json.dumps(merged_custom), f"Captured via {agent_slug}", now, now,
            ),
        )

    # Record consent
    if req.consent_confirmed:
        cur.execute(
            """
            INSERT INTO consent_records (id, tenant_id, lead_id, phone, consent_status, consent_source, consent_purpose, call_category, recorded_at)
            VALUES (?, ?, ?, ?, 'opted_in', ?, 'instant_lead_callback', ?, ?)
            """,
            (f"cns_{uuid.uuid4().hex[:8]}", tenant_id, lead_id, clean_phone, req.consent_source, req.call_category, now),
        )
    db.commit()

    # Pre-call compliance gate (must pass BEFORE dialing!)
    if not req.consent_confirmed:
        return {
            "status": "blocked_consent_missing",
            "lead_id": lead_id,
            "duplicate_detected": duplicate_detected,
            "call_initiated": False,
            "reason": "Explicit consent_confirmed=true is required before automated calling.",
        }

    compliance = ComplianceService.evaluate_pre_call(
        conn=db,
        tenant_id=tenant_id,
        phone=clean_phone,
        call_category=req.call_category,
        bypass_calling_hours=req.bypass_calling_hours,
        is_sandbox=req.is_sandbox,
    )
    if not compliance["allowed"]:
        return {
            "status": "blocked_compliance",
            "code": compliance["code"],
            "lead_id": lead_id,
            "duplicate_detected": duplicate_detected,
            "call_initiated": False,
            "reason": compliance["reason"],
        }

    # Schedule via worker if delay_seconds > 0, else initiate immediately
    if req.delay_seconds and req.delay_seconds > 0:
        from worker.tasks import schedule_delayed_intake_call
        sched = schedule_delayed_intake_call(
            delay_seconds=req.delay_seconds,
            tenant_id=tenant_id,
            lead_id=lead_id,
            contact_name=req.name.strip(),
            phone=clean_phone,
            language=agent["language"],
            agent_id=agent["id"],
            call_category=req.call_category,
            is_sandbox=req.is_sandbox,
        )
        return {
            "status": "call_scheduled",
            "lead_id": lead_id,
            "duplicate_detected": duplicate_detected,
            "call_initiated": False,
            "scheduled": True,
            "task_id": sched.get("task_id"),
            "scheduler_backend": sched.get("backend"),
            "delay_seconds": req.delay_seconds,
        }

    # Initiate call immediately
    call_res = CallService.initiate_call(
        conn=db,
        tenant_id=tenant_id,
        contact_name=req.name.strip(),
        phone=clean_phone,
        language=agent["language"],
        agent_id=agent["id"],
        is_sandbox=req.is_sandbox,
    )

    cur.execute("UPDATE calls SET lead_id = ?, call_category = ?, is_sandbox = ? WHERE id = ?", (lead_id, req.call_category, 1 if req.is_sandbox else 0, call_res["call_id"]))
    db.commit()

    WebhookService.dispatch_event(
        conn=db,
        tenant_id=tenant_id,
        event_type="lead.intake_called",
        payload={"lead_id": lead_id, "call_id": call_res["call_id"], "agent_slug": agent_slug, "custom_fields": merged_custom},
    )

    return {
        "status": "call_initiated",
        "lead_id": lead_id,
        "duplicate_detected": duplicate_detected,
        "call_initiated": True,
        "call_id": call_res["call_id"],
        "call_status": call_res["status"],
        "provider": call_res["provider"],
        "is_sandbox": call_res["is_sandbox"],
        "delay_seconds": req.delay_seconds,
    }


@router.get("/calls/{call_id}/status")
def get_public_call_status(
    call_id: str,
    x_intake_secret: Optional[str] = Header(None, alias="X-Intake-Secret"),
    authorization: Optional[str] = Header(None),
    db: sqlite3.Connection = Depends(get_db),
):
    secret = _extract_intake_secret(x_intake_secret, authorization)
    cur = db.cursor()
    cur.execute(
        """
        SELECT c.*, a.intake_secret_hash
        FROM calls c
        LEFT JOIN agents a ON c.agent_id = a.id
        WHERE c.id = ?
        """,
        (call_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")

    if not secret or not row["intake_secret_hash"] or hash_api_key(secret) != row["intake_secret_hash"]:
        raise HTTPException(status_code=401, detail="Invalid or missing intake secret")

    return {
        "call_id": row["id"],
        "status": row["status"],
        "outcome": row["outcome"],
        "duration_seconds": row["duration_seconds"],
        "summary": row["summary"],
        "extracted_data": json.loads(row["extracted_data_json"] or "{}"),
        "is_sandbox": bool(row["is_sandbox"]),
        "created_at": row["created_at"],
        "ended_at": row["ended_at"],
    }
