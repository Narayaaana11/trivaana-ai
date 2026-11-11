"""
TRIVAANA AI: Inbound Calling Router
Handles incoming calls from Exotel/Twilio or sandbox simulation, routes to configured AI Employee,
evaluates business hours vs after-hours behavior, recognizes returning callers, and records transcripts.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Optional
import json
import sqlite3
import uuid
from datetime import datetime, timezone

from database.connection import get_db
from core.dependencies import get_current_tenant
from core.config import settings
from services.call_service import normalize_phone
from services.compliance_service import ComplianceService
from services.knowledge_service import KnowledgeService
from providers.twilio_adapter import TwilioTelephonyProvider
from providers.exotel_adapter import ExotelTelephonyProvider

router = APIRouter(prefix="/api/inbound", tags=["Inbound Calling"])


class SimulateInboundRequest(BaseModel):
    to_number: str
    from_number: str
    caller_name: Optional[str] = None
    initial_query: Optional[str] = None


def _process_inbound_routing(
    conn: sqlite3.Connection,
    to_number: str,
    from_number: str,
    provider: str,
    provider_call_id: Optional[str] = None,
    caller_name: Optional[str] = None,
    is_sandbox: bool = False,
):
    cur = conn.cursor()
    norm_to = normalize_phone(to_number)
    norm_from = normalize_phone(from_number)

    cur.execute(
        "SELECT * FROM phone_numbers WHERE phone_number = ? OR phone_number = ? LIMIT 1",
        (norm_to, to_number),
    )
    num_row = cur.fetchone()
    if not num_row:
        raise HTTPException(status_code=404, detail=f"No inbound routing configured for business number '{to_number}'")

    tenant_id = num_row["tenant_id"]
    agent_id = num_row["inbound_agent_id"] or num_row["assigned_agent_id"]
    if not agent_id:
        raise HTTPException(status_code=400, detail="Business number has no AI Employee assigned for inbound calls")

    cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant_id))
    agent = cur.fetchone()
    if not agent:
        raise HTTPException(status_code=404, detail="Assigned inbound AI Employee not found")

    biz_hours = json.loads(num_row["business_hours_json"] or '{"start":"09:00","end":"20:00"}')
    in_hours = ComplianceService.is_within_calling_hours(biz_hours.get("start", "09:00"), biz_hours.get("end", "20:00"))
    after_hours_mode = num_row["after_hours_mode"] or "voicemail_callback"

    # Returning caller memory check
    returning_memory = None
    if agent["caller_memory_enabled"]:
        cur.execute("SELECT * FROM caller_memories WHERE tenant_id = ? AND phone = ?", (tenant_id, norm_from))
        mem = cur.fetchone()
        if mem:
            returning_memory = dict(mem)

    display_name = caller_name or (returning_memory["caller_name"] if returning_memory else None) or f"Inbound Caller ({norm_from[-4:]})"
    greeting = agent["greeting_message"] or f"Hello {display_name}! Welcome to {agent['business_name'] or 'Trivaana AI'}."
    if returning_memory and returning_memory.get("caller_name"):
        greeting = f"Welcome back {returning_memory['caller_name']}! How can I assist you today?"

    if not in_hours and after_hours_mode == "voicemail_callback":
        greeting = (
            f"Thank you for calling {agent['business_name'] or 'us'}. Our team is currently outside business hours "
            f"({biz_hours.get('start')}-{biz_hours.get('end')} IST). We have logged a priority callback request for you."
        )

    call_id = f"call_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        """
        INSERT INTO calls (
            id, tenant_id, agent_id, contact_name, phone, direction, call_category,
            provider, provider_call_id, status, language, outcome, transcript, is_sandbox, created_at
        ) VALUES (?, ?, ?, ?, ?, 'inbound', 'service', ?, ?, 'connected', ?, ?, ?, ?, ?)
        """,
        (
            call_id,
            tenant_id,
            agent["id"],
            display_name,
            norm_from,
            provider,
            provider_call_id or f"inb_{call_id}",
            agent["language"],
            "After-Hours Callback Requested" if (not in_hours and after_hours_mode == "voicemail_callback") else "Inbound Answered",
            f"Agent: {greeting}",
            1 if is_sandbox else 0,
            now,
        ),
    )
    cur.execute(
        "INSERT INTO call_transcripts (id, call_id, tenant_id, speaker, message, timestamp_ms, language, created_at) VALUES (?, ?, ?, 'ai', ?, 0, ?, ?)",
        (f"trn_{uuid.uuid4().hex[:8]}", call_id, tenant_id, greeting, agent["language"], now),
    )
    conn.commit()

    return {
        "call_id": call_id,
        "tenant_id": tenant_id,
        "agent_id": agent["id"],
        "agent_name": agent["name"],
        "language": agent["language"],
        "within_business_hours": in_hours,
        "after_hours_mode": after_hours_mode,
        "returning_caller": bool(returning_memory),
        "greeting": greeting,
    }


@router.post("/twilio")
async def inbound_twilio_webhook(request: Request, db: sqlite3.Connection = Depends(get_db)):
    form = await request.form()
    payload = dict(form)
    if settings.has_twilio or settings.ENVIRONMENT.lower() in ("production", "prod"):
        sig = request.headers.get("X-Twilio-Signature") or request.headers.get("x-twilio-signature", "")
        url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/inbound/twilio"
        if not TwilioTelephonyProvider().verify_request(url, payload, sig):
            raise HTTPException(status_code=401, detail="Invalid Twilio inbound signature")
    to_number = payload.get("To", "")
    from_number = payload.get("From", "")
    call_sid = payload.get("CallSid", "")
    routing = _process_inbound_routing(db, to_number=to_number, from_number=from_number, provider="twilio", provider_call_id=call_sid)
    twiml = TwilioTelephonyProvider.generate_twiml(call_id=routing["call_id"], language=routing["language"], prompt_text=routing["greeting"])
    return Response(content=twiml, media_type="application/xml")


@router.api_route("/exotel", methods=["GET", "POST"])
async def inbound_exotel_webhook(request: Request, db: sqlite3.Connection = Depends(get_db)):
    params = dict(request.query_params)
    if request.method == "POST":
        try:
            form = await request.form()
            params.update(dict(form))
        except Exception:
            pass
    if settings.has_exotel or settings.ENVIRONMENT.lower() in ("production", "prod"):
        verify_params = {**params, "_call_id": params.get("CallSid", "inbound")}
        if not ExotelTelephonyProvider().verify_request(dict(request.headers), verify_params):
            raise HTTPException(status_code=401, detail="Invalid Exotel inbound authentication")
    to_number = params.get("To") or params.get("CallTo") or ""
    from_number = params.get("From") or params.get("CallFrom") or ""
    call_sid = params.get("CallSid", "")
    routing = _process_inbound_routing(db, to_number=to_number, from_number=from_number, provider="exotel", provider_call_id=call_sid)
    return {"select": "passthru", **routing}


@router.post("/simulate")
def simulate_inbound_call(
    req: SimulateInboundRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    routing = _process_inbound_routing(
        db,
        to_number=req.to_number,
        from_number=req.from_number,
        provider="mock",
        caller_name=req.caller_name,
        is_sandbox=True,
    )
    if routing["tenant_id"] != tenant["id"]:
        raise HTTPException(status_code=403, detail="Number belongs to another workspace")

    kb_hits = []
    if req.initial_query:
        kb_hits = KnowledgeService.search(db, tenant["id"], req.initial_query, agent_id=routing["agent_id"], top_k=2)

    return {**routing, "is_sandbox": True, "kb_hits": kb_hits}

