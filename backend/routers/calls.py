"""
TRIVAANA AI: Calls Router
Outbound dialing, call history, structured transcripts, recordings, AI post-call analysis,
CSV exports, carrier callback authentication, TwiML, Exotel Passthru, and media streams.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import csv
import io
import json
import sqlite3
import uuid
from datetime import datetime, timezone
import requests

from core.dependencies import get_current_tenant, get_db
from core.config import settings
from services.call_service import CallService
from services.billing_service import InsufficientBalanceError
from services.compliance_service import ComplianceService
from providers import get_telephony_provider

router = APIRouter(prefix="/api/calls", tags=["Calls"])


class InstantCallRequest(BaseModel):
    name: str = Field(..., description="Recipient contact name")
    phone: str = Field(..., description="Recipient phone number")
    vertical: Optional[str] = Field("Real Estate", description="Industry vertical")
    language: Optional[str] = Field("te-IN", description="Language code (e.g., te-IN, hi-IN, en-IN)")
    agent_id: Optional[str] = Field(None, description="Assigned Agent ID")
    call_category: Optional[str] = Field("service", description="service, transactional, or promotional")
    bypass_calling_hours: Optional[bool] = Field(False)
    is_sandbox: Optional[bool] = Field(False, description="Preview sandbox mode")


def format_call_log(row: sqlite3.Row) -> Dict[str, Any]:
    keys = row.keys()
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "campaign_id": row["campaign_id"] if "campaign_id" in keys else None,
        "agent_id": row["agent_id"] if "agent_id" in keys else None,
        "lead_id": row["lead_id"] if "lead_id" in keys else None,
        "contact_name": row["contact_name"],
        "phone": row["phone"],
        "direction": row["direction"],
        "call_category": row["call_category"] if "call_category" in keys else "service",
        "provider": row["provider"],
        "provider_call_id": row["provider_call_id"] if "provider_call_id" in keys else None,
        "duration": row["duration_seconds"],
        "duration_seconds": row["duration_seconds"],
        "billable_duration_seconds": row["billable_duration_seconds"],
        "cost": row["cost_paise"] / 100.0,
        "cost_paise": row["cost_paise"],
        "status": row["status"],
        "language": row["language"],
        "outcome": row["outcome"] or "Pending",
        "summary": row["summary"] if "summary" in keys else None,
        "sentiment": row["sentiment"] if "sentiment" in keys else "neutral",
        "extracted_data": json.loads(row["extracted_data_json"] or "{}") if "extracted_data_json" in keys else {},
        "transcript": row["transcript"] or "",
        "recording_url": row["recording_url"],
        "is_sandbox": bool(row["is_sandbox"]) if "is_sandbox" in keys else False,
        "latency_ms": row["latency_ms"] if "latency_ms" in keys else None,
        "created_at": row["created_at"],
        "ended_at": row["ended_at"] if "ended_at" in keys else None
    }


def _parse_transcript_lines(raw_transcript: str) -> List[Dict[str, Any]]:
    turns = []
    for idx, line in enumerate((raw_transcript or "").splitlines()):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.lower().startswith(("agent:", "ai:")):
            speaker = "ai"
            msg = stripped.split(":", 1)[1].strip()
        elif stripped.lower().startswith(("lead:", "user:", "caller:")):
            speaker = "caller"
            msg = stripped.split(":", 1)[1].strip()
        else:
            speaker = "system"
            msg = stripped
        turns.append({"id": f"turn_{idx}", "speaker": speaker, "message": msg, "timestamp_ms": idx * 4500})
    return turns


@router.get("")
def list_calls(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    direction: Optional[str] = None,
    agent_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    outcome: Optional[str] = None,
    search: Optional[str] = None,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    where = "WHERE tenant_id = ?"
    params: List[Any] = [current_tenant["id"]]

    if status_filter:
        where += " AND status = ?"
        params.append(status_filter)
    if direction:
        where += " AND direction = ?"
        params.append(direction)
    if agent_id:
        where += " AND agent_id = ?"
        params.append(agent_id)
    if campaign_id:
        where += " AND campaign_id = ?"
        params.append(campaign_id)
    if outcome:
        where += " AND outcome LIKE ?"
        params.append(f"%{outcome}%")
    if search:
        where += " AND (contact_name LIKE ? OR phone LIKE ? OR COALESCE(transcript,'') LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    cur.execute(f"SELECT COUNT(*) as total FROM calls {where}", params)
    count = cur.fetchone()["total"]

    cur.execute(f"SELECT * FROM calls {where} ORDER BY created_at DESC LIMIT ? OFFSET ?", [*params, limit, offset])
    rows = cur.fetchall()
    calls = [format_call_log(r) for r in rows]

    return {"calls": calls, "count": count, "limit": limit, "offset": offset}


@router.get("/active")
def list_active_calls(
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM calls WHERE tenant_id = ? AND status IN ('initiated', 'ringing', 'connected') ORDER BY created_at DESC LIMIT 50",
        (current_tenant["id"],),
    )
    active = [format_call_log(r) for r in cur.fetchall()]
    return {"active_calls": active, "count": len(active)}


@router.get("/export")
def export_calls_csv(
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1000", (current_tenant["id"],))
    rows = cur.fetchall()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Call ID", "Contact Name", "Phone", "Direction", "Status", "Outcome", "Sentiment", "Duration (s)", "Cost (INR)", "Language", "Provider", "Created At", "Summary"])
    for r in rows:
        writer.writerow([
            r["id"], r["contact_name"], r["phone"], r["direction"], r["status"],
            r["outcome"], r["sentiment"] if "sentiment" in r.keys() else "",
            r["duration_seconds"], round(r["cost_paise"] / 100.0, 2),
            r["language"], r["provider"], r["created_at"],
            r["summary"] if "summary" in r.keys() else "",
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="trivaana_call_history.csv"'},
    )


@router.get("/{call_id}")
def get_call(
    call_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ? AND tenant_id = ?", (call_id, current_tenant["id"]))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call record not found")

    data = format_call_log(row)

    cur.execute("SELECT * FROM call_transcripts WHERE call_id = ? AND tenant_id = ? ORDER BY timestamp_ms ASC, created_at ASC", (call_id, current_tenant["id"]))
    turns = [dict(r) for r in cur.fetchall()]
    if not turns and row["transcript"]:
        turns = _parse_transcript_lines(row["transcript"])
    data["transcript_messages"] = turns

    cur.execute("SELECT * FROM call_actions WHERE call_id = ? AND tenant_id = ? ORDER BY created_at ASC", (call_id, current_tenant["id"]))
    actions = []
    for a in cur.fetchall():
        ad = dict(a)
        ad["arguments"] = json.loads(ad.pop("arguments_json", "{}") or "{}")
        ad["result"] = json.loads(ad.pop("result_json", "{}") or "{}")
        actions.append(ad)
    data["actions_performed"] = actions

    cur.execute("SELECT * FROM call_events WHERE call_id = ? AND tenant_id = ? ORDER BY created_at ASC", (call_id, current_tenant["id"]))
    data["events"] = [dict(e) for e in cur.fetchall()]
    return data


@router.get("/{call_id}/transcript")
def get_call_transcript(
    call_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT id, contact_name, phone, transcript, language FROM calls WHERE id = ? AND tenant_id = ?", (call_id, current_tenant["id"]))
    call = cur.fetchone()
    if not call:
        raise HTTPException(status_code=404, detail="Call record not found")

    cur.execute("SELECT * FROM call_transcripts WHERE call_id = ? AND tenant_id = ? ORDER BY timestamp_ms ASC, created_at ASC", (call_id, current_tenant["id"]))
    messages = [dict(r) for r in cur.fetchall()]
    if not messages and call["transcript"]:
        messages = _parse_transcript_lines(call["transcript"])

    return {
        "call_id": call_id,
        "contact_name": call["contact_name"],
        "phone": call["phone"],
        "language": call["language"],
        "messages": messages,
        "raw_transcript": call["transcript"] or "\n".join(f"{m['speaker'].upper()}: {m['message']}" for m in messages),
    }


@router.get("/{call_id}/recording")
def get_call_recording(
    call_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT id, recording_url, duration_seconds, is_sandbox FROM calls WHERE id = ? AND tenant_id = ?", (call_id, current_tenant["id"]))
    call = cur.fetchone()
    if not call:
        raise HTTPException(status_code=404, detail="Call record not found")

    cur.execute("SELECT * FROM call_recordings WHERE call_id = ? AND tenant_id = ? LIMIT 1", (call_id, current_tenant["id"]))
    rec = cur.fetchone()
    return {
        "call_id": call_id,
        "recording_url": rec["url"] if rec else call["recording_url"],
        "duration_seconds": rec["duration_seconds"] if rec else call["duration_seconds"],
        "format": rec["format"] if rec else "mp3",
        "is_simulated": bool(rec["is_simulated"]) if rec else bool(call["is_sandbox"]),
        "available": bool(rec["url"] if rec else call["recording_url"]),
    }


@router.post("/{call_id}/analyze")
def analyze_call_post_processing(
    call_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Generate post-call summary, sentiment, and structured field extraction."""
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ? AND tenant_id = ?", (call_id, current_tenant["id"]))
    call = cur.fetchone()
    if not call:
        raise HTTPException(status_code=404, detail="Call record not found")

    cur.execute("SELECT speaker, message FROM call_transcripts WHERE call_id = ? ORDER BY timestamp_ms ASC", (call_id,))
    rows = cur.fetchall()
    transcript_text = "\n".join(f"{r['speaker']}: {r['message']}" for r in rows) if rows else (call["transcript"] or "")

    summary = call["summary"] or f"Conversation with {call['contact_name']} ({call['phone']})."
    sentiment = "neutral"
    outcome = call["outcome"] or "Completed"
    extracted: Dict[str, Any] = {"contact_name": call["contact_name"], "phone": call["phone"], "language": call["language"]}
    mode = "deterministic"

    if settings.has_openai and transcript_text:
        try:
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": settings.OPENAI_MODEL,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": "Analyze this telecalling transcript and return JSON with keys: summary (string), sentiment ('positive'|'neutral'|'negative'), outcome (string), qualification_score (0-100 int), extracted_fields (object), next_action (string)."},
                        {"role": "user", "content": transcript_text},
                    ],
                },
                timeout=15.0,
            )
            if resp.status_code == 200:
                parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
                summary = parsed.get("summary", summary)
                sentiment = parsed.get("sentiment", sentiment)
                outcome = parsed.get("outcome", outcome)
                extracted = parsed.get("extracted_fields", extracted)
                mode = "openai"
        except Exception:
            pass
    elif transcript_text:
        lower = transcript_text.lower()
        if any(w in lower for w in ("yes", "interested", "saturday", "sunday", "book", "schedule", "అవును", "हाँ", "సరే")):
            sentiment = "positive"
            outcome = "Interested / Appointment Discussed"
            summary = f"Caller {call['contact_name']} expressed positive interest and discussed scheduling."
        elif any(w in lower for w in ("not interested", "no", "stop", "busy")):
            sentiment = "negative"
            outcome = "Not Interested"
            summary = f"Caller {call['contact_name']} declined or requested no follow-up."

    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "UPDATE calls SET summary = ?, sentiment = ?, outcome = ?, extracted_data_json = ? WHERE id = ?",
        (summary, sentiment, outcome, json.dumps(extracted), call_id),
    )
    cur.execute(
        """
        INSERT INTO call_extractions (id, call_id, tenant_id, summary, sentiment, qualification_score, extracted_fields_json, next_action, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (f"ext_{uuid.uuid4().hex[:8]}", call_id, current_tenant["id"], summary, sentiment, 80 if sentiment == "positive" else 40, json.dumps(extracted), outcome, now),
    )
    conn.commit()
    return {"status": "analyzed", "mode": mode, "call_id": call_id, "summary": summary, "sentiment": sentiment, "outcome": outcome, "extracted_data": extracted}


@router.post("/instant")
def trigger_instant_call(
    req: InstantCallRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    # Pre-call compliance gate
    compliance = ComplianceService.evaluate_pre_call(
        conn=conn,
        tenant_id=current_tenant["id"],
        phone=req.phone,
        call_category=req.call_category or "service",
        bypass_calling_hours=bool(req.bypass_calling_hours or req.is_sandbox),
        is_sandbox=req.is_sandbox or False,
    )
    if not compliance["allowed"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=compliance["reason"])

    agent_id = req.agent_id
    if not agent_id:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM agents WHERE tenant_id = ? AND language = ? LIMIT 1",
            (current_tenant["id"], req.language)
        )
        agent_row = cur.fetchone()
        if agent_row:
            agent_id = agent_row["id"]

    try:
        call_res = CallService.initiate_call(
            conn=conn,
            tenant_id=current_tenant["id"],
            contact_name=req.name,
            phone=req.phone,
            language=req.language or "te-IN",
            agent_id=agent_id,
            is_sandbox=req.is_sandbox or False,
            call_category=req.call_category or "service",
        )
        return {
            "success": True,
            "call_id": call_res["call_id"],
            "status": call_res["status"],
            "provider": call_res["provider"],
            "provider_call_id": call_res["provider_call_id"],
            "is_sandbox": call_res["is_sandbox"],
            "phone": call_res["phone"],
            "contact_name": call_res["contact_name"],
            "message": f"Outbound call initiated via {call_res['provider'].upper()}"
        }
    except InsufficientBalanceError as e:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to initiate call: {str(e)}")


@router.post("/callback/{call_id}")
async def carrier_callback(
    call_id: str,
    request: Request,
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ? OR provider_call_id = ?", (call_id, call_id))
    call = cur.fetchone()
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call record not found.")

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    provider_name = call["provider"]
    provider = get_telephony_provider(provider_name)

    if provider_name == "twilio":
        sig = request.headers.get("X-Twilio-Signature") or request.headers.get("x-twilio-signature", "")
        url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/calls/callback/{call['id']}"
        if not provider.verify_request(url, payload, sig):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Carrier verification failed: Invalid Twilio request signature.")
    elif provider_name == "exotel":
        verify_params = {**dict(request.query_params), **payload, "_call_id": call["id"]}
        if not provider.verify_request(dict(request.headers), verify_params):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Carrier verification failed: Invalid Exotel authentication.")
    elif provider_name == "plivo":
        verify_params = {**dict(request.query_params), **payload, "_call_id": call["id"]}
        cb_url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/calls/callback/{call['id']}"
        if not provider.verify_request(dict(request.headers), verify_params, url=cb_url):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Carrier verification failed: Invalid Plivo signature.")
    elif provider_name == "vobiz":
        verify_params = {**dict(request.query_params), **payload, "_call_id": call["id"]}
        if not provider.verify_request(dict(request.headers), verify_params):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Carrier verification failed: Invalid Vobiz authentication.")
    elif provider_name == "mock":
        if settings.ENVIRONMENT.lower() in ("production", "prod"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mock carrier events are strictly prohibited in production.")

    incoming_sid = payload.get("CallSid") or payload.get("Sid")
    if incoming_sid and incoming_sid not in (call["provider_call_id"], call["id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider Call SID mismatch with recorded call session.")

    event = provider.parse_status_callback(payload)
    event.provider_call_id = call["id"]
    return CallService.process_call_event(conn, event)


@router.api_route("/twiml/{call_id}", methods=["GET", "POST"])
def get_twiml_instructions(call_id: str, conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ?", (call_id,))
    call = cur.fetchone()
    language = call["language"] if call else "te-IN"
    from providers.twilio_adapter import TwilioTelephonyProvider
    twiml_xml = TwilioTelephonyProvider.generate_twiml(call_id=call_id, language=language)
    return Response(content=twiml_xml, media_type="application/xml")


@router.post("/twiml-gather/{call_id}")
async def handle_twiml_gather(call_id: str, request: Request, conn: sqlite3.Connection = Depends(get_db)):
    form = await request.form()
    payload = dict(form)
    if settings.has_twilio or settings.ENVIRONMENT.lower() in ("production", "prod"):
        sig = request.headers.get("X-Twilio-Signature") or request.headers.get("x-twilio-signature", "")
        url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/calls/twiml-gather/{call_id}"
        provider = get_telephony_provider("twilio")
        if not provider.verify_request(url, payload, sig):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Twilio signature")

    speech_result = payload.get("SpeechResult", "")
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ?", (call_id,))
    call = cur.fetchone()

    if call and speech_result:
        existing_transcript = call["transcript"] or ""
        updated_transcript = f"{existing_transcript}\nUser: {speech_result}\nAgent: ధన్యవాదాలు! మీ వినతి స్వీకరించబడింది."
        cur.execute("UPDATE calls SET transcript = ? WHERE id = ?", (updated_transcript.strip(), call_id))
        conn.commit()

    closing_twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<Response>\n'
        '    <Say voice="Polly.Aditi" language="te-IN">ధన్యవాదాలు! మీ సమాచారం స్వీకరించబడింది. త్రివాణా ఏఐ మీకు శుభదినం కోరుకుంటోంది.</Say>\n'
        '    <Hangup/>\n'
        '</Response>'
    )
    return Response(content=closing_twiml, media_type="application/xml")


@router.api_route("/exotel-passthru/{call_id}", methods=["GET", "POST"])
def get_exotel_passthru(call_id: str, conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ?", (call_id,))
    call = cur.fetchone()
    language = call["language"] if call else "te-IN"
    from providers.exotel_adapter import ExotelTelephonyProvider
    return ExotelTelephonyProvider.generate_passthru_response(call_id=call_id, language=language)


@router.api_route("/plivo-xml/{call_id}", methods=["GET", "POST"])
def get_plivo_stream_xml(call_id: str, conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ?", (call_id,))
    call = cur.fetchone()
    language = call["language"] if call else "te-IN"
    from providers.plivo_adapter import PlivoTelephonyProvider
    xml = PlivoTelephonyProvider().generate_stream_xml(call_id=call_id, language=language)
    return Response(content=xml, media_type="application/xml")


@router.api_route("/vobiz-xml/{call_id}", methods=["GET", "POST"])
def get_vobiz_stream_xml(call_id: str, conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ?", (call_id,))
    call = cur.fetchone()
    language = call["language"] if call else "te-IN"
    from providers.vobiz_adapter import VobizTelephonyProvider
    xml = VobizTelephonyProvider().generate_stream_xml(call_id=call_id, language=language)
    return Response(content=xml, media_type="application/xml")


class WarmTransferRequest(BaseModel):
    target_phone: str = Field(..., description="Human agent / supervisor E.164 phone number")
    reason: Optional[str] = Field("Caller requested human escalation")


@router.post("/{call_id}/transfer")
def transfer_call_to_human(
    call_id: str,
    req: WarmTransferRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db),
):
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ? AND tenant_id = ?", (call_id, current_tenant["id"]))
    call = cur.fetchone()
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call record not found")

    from xml.sax.saxutils import escape as xml_escape
    from services.call_service import normalize_phone

    safe_phone = normalize_phone(req.target_phone)
    digits = "".join(ch for ch in safe_phone if ch.isdigit())
    if len(digits) < 10 or len(digits) > 15:
        raise HTTPException(status_code=400, detail="Invalid target_phone; expected E.164 phone number")

    now = datetime.now(timezone.utc).isoformat()
    transfer_id = f"xfer_{uuid.uuid4().hex[:8]}"
    provider_name = (call["provider"] or "mock").lower()
    twiml_transfer = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<Response>\n"
        '    <Say language="en-IN">Connecting you with our specialist now.</Say>\n'
        f'    <Dial>{xml_escape(safe_phone)}</Dial>\n'
        "</Response>"
    )
    cur.execute(
        "UPDATE calls SET outcome = ?, summary = COALESCE(summary, ?) WHERE id = ?",
        ("Transferred", f"Transferred to {req.target_phone}: {req.reason}", call_id),
    )
    cur.execute(
        "INSERT INTO call_events (id, call_id, tenant_id, event_type, payload_json, created_at) VALUES (?, ?, ?, 'call.transfer_initiated', ?, ?)",
        (
            f"cev_{uuid.uuid4().hex[:8]}",
            call_id,
            current_tenant["id"],
            json.dumps({"transfer_id": transfer_id, "target_phone": req.target_phone, "reason": req.reason, "provider": provider_name}),
            now,
        ),
    )
    conn.commit()
    return {
        "status": "transfer_initiated",
        "transfer_id": transfer_id,
        "call_id": call_id,
        "target_phone": req.target_phone,
        "provider": provider_name,
        "control_xml": twiml_transfer,
    }


@router.websocket("/stream/{call_id}")
async def websocket_call_stream(
    websocket: WebSocket,
    call_id: str,
    token: Optional[str] = Query(None),
    provider: str = Query("exotel"),
    conn: sqlite3.Connection = Depends(get_db),
):
    import hmac as _hmac
    prov = (provider or "exotel").lower()
    is_prod = settings.ENVIRONMENT.lower() in ("production", "prod")
    if prov == "exotel" and (settings.has_exotel or is_prod):
        from providers.exotel_adapter import ExotelTelephonyProvider
        if not ExotelTelephonyProvider.verify_stream_token(call_id, token):
            await websocket.close(code=1008)
            return
    elif prov == "plivo" and (settings.has_plivo or is_prod):
        from providers.plivo_adapter import PlivoTelephonyProvider
        expected = PlivoTelephonyProvider().build_stream_token(call_id)
        if not token or not _hmac.compare_digest(expected, str(token)):
            await websocket.close(code=1008)
            return
    elif prov == "vobiz" and (settings.has_vobiz or is_prod):
        from providers.vobiz_adapter import VobizTelephonyProvider
        expected = VobizTelephonyProvider().build_stream_token(call_id)
        if not token or not _hmac.compare_digest(expected, str(token)):
            await websocket.close(code=1008)
            return
    elif is_prod:
        # In production, any non-carrier-verified stream requires an authenticated tenant token
        from routers.voice_engine import _resolve_ws_tenant_id
        tenant_id = _resolve_ws_tenant_id(websocket, conn, token=token)
        if not tenant_id:
            await websocket.close(code=1008)
            return
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM calls WHERE id = ? AND tenant_id = ?", (call_id, tenant_id))
        if not cur.fetchone():
            await websocket.close(code=1008)
            return

    await websocket.accept()
    from voice_engine.telephony_stream import TelephonyStreamSession

    session = TelephonyStreamSession(conn=conn, call_id=call_id, provider=prov)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            result = session.handle_event(msg)
            for out_frame in result.get("outbound", []):
                await websocket.send_text(json.dumps(out_frame))
            if result.get("should_close"):
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_text(json.dumps({"event": "error", "detail": str(exc)}))
        except Exception:
            pass


@router.post("/{call_id}/whatsapp")
def send_post_call_whatsapp(
    call_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ? AND tenant_id = ?", (call_id, current_tenant["id"]))
    call = cur.fetchone()
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call record not found")

    if not settings.has_whatsapp:
        return {
            "status": "not_configured",
            "call_id": call_id,
            "configured": False,
            "message": "WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN / WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID) are not configured. To send automated post-call summaries via WhatsApp, please configure the credentials in backend/.env."
        }

    url = f"https://graph.facebook.com/v19.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": call["phone"].replace("+", ""),
        "type": "text",
        "text": {
            "body": f"Namaskaram {call['contact_name']}, thank you for speaking with Trivaana AI. Your call summary has been logged."
        }
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10.0)
        if resp.status_code in (200, 201):
            return {"status": "sent", "call_id": call_id, "configured": True, "whatsapp_response": resp.json()}
        return {"status": "error", "call_id": call_id, "configured": True, "error": resp.text}
    except Exception as e:
        return {"status": "failed", "call_id": call_id, "configured": True, "error": str(e)}
