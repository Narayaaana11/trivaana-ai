"""
TRIVAANA AI: Calls Router
Outbound dialing, live call logs, carrier webhook ingestion, and truthful WhatsApp triggers.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import sqlite3
import requests

from core.dependencies import get_current_tenant, get_db
from core.config import settings
from services.call_service import CallService
from services.billing_service import InsufficientBalanceError
from providers import get_telephony_provider
from providers.base import CallStatusEvent

router = APIRouter(prefix="/api/calls", tags=["Calls"])

class InstantCallRequest(BaseModel):
    name: str = Field(..., description="Recipient contact name")
    phone: str = Field(..., description="Recipient phone number")
    vertical: Optional[str] = Field("Real Estate", description="Industry vertical")
    language: Optional[str] = Field("te-IN", description="Language code (e.g., te-IN, hi-IN, en-IN)")
    agent_id: Optional[str] = Field(None, description="Assigned Agent ID")
    is_sandbox: Optional[bool] = Field(False, description="Preview sandbox mode")

def format_call_log(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "contact_name": row["contact_name"],
        "phone": row["phone"],
        "direction": row["direction"],
        "duration": row["duration_seconds"],
        "duration_seconds": row["duration_seconds"],
        "billable_duration_seconds": row["billable_duration_seconds"],
        "cost": row["cost_paise"] / 100.0,
        "cost_paise": row["cost_paise"],
        "status": row["status"],
        "language": row["language"],
        "outcome": row["outcome"] or "Pending",
        "transcript": row["transcript"] or "",
        "recording_url": row["recording_url"],
        "created_at": row["created_at"],
        "ended_at": row["ended_at"] if "ended_at" in row.keys() else None
    }

@router.get("")
def list_calls(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Retrieve call history for the active authenticated tenant."""
    cur = conn.cursor()
    query = "SELECT * FROM calls WHERE tenant_id = ?"
    params: List[Any] = [current_tenant["id"]]

    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cur.execute(query, params)
    rows = cur.fetchall()

    calls = [format_call_log(r) for r in rows]

    # Total count for pagination
    cur.execute("SELECT COUNT(*) as total FROM calls WHERE tenant_id = ?", (current_tenant["id"],))
    count = cur.fetchone()["total"]

    return {"calls": calls, "count": count}

@router.get("/{call_id}")
def get_call(
    call_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Retrieve details for a specific call."""
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ? AND tenant_id = ?", (call_id, current_tenant["id"]))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call record not found")
    return format_call_log(row)

@router.post("/instant")
def trigger_instant_call(
    req: InstantCallRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Trigger an instant outbound call for the authenticated tenant.
    Validates wallet balance and dispatches to configured telephony carrier (or mock in sandbox).
    """
    # If agent_id is not specified, select default agent for language/vertical
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
            is_sandbox=req.is_sandbox or False
        )
        return {
            "success": True,
            "call_id": call_res["call_id"],
            "status": call_res["status"],
            "provider": call_res["provider"],
            "is_sandbox": call_res["is_sandbox"],
            "phone": call_res["phone"],
            "contact_name": call_res["contact_name"],
            "message": f"Outbound call initiated via {call_res['provider'].upper()}"
        }
    except InsufficientBalanceError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate call: {str(e)}"
        )

@router.post("/callback/{call_id}")
async def carrier_callback(
    call_id: str,
    request: Request,
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Universal carrier callback endpoint for Exotel, Twilio, and Mock providers.
    Parses status change, duration, and settles ledger charges atomically.
    """
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    # Determine provider from call record
    cur = conn.cursor()
    cur.execute("SELECT id, provider FROM calls WHERE id = ? OR provider_call_id = ?", (call_id, call_id))
    call = cur.fetchone()
    provider_name = call["provider"] if call else "mock"

    provider = get_telephony_provider(provider_name)
    event = provider.parse_status_callback(payload)
    if call:
        event.provider_call_id = call["id"]
    elif not event.provider_call_id:
        event.provider_call_id = call_id

    result = CallService.process_call_event(conn, event)
    return result

@router.post("/{call_id}/whatsapp")
def send_post_call_whatsapp(
    call_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Truthful WhatsApp Follow-up.
    Checks Meta Cloud API credentials; if absent, returns clear not_configured status.
    """
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ? AND tenant_id = ?", (call_id, current_tenant["id"]))
    call = cur.fetchone()
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call record not found")

    has_whatsapp = bool(settings.WHATSAPP_API_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)

    if not has_whatsapp:
        return {
            "status": "not_configured",
            "call_id": call_id,
            "configured": False,
            "message": "WhatsApp Cloud API credentials (WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID) are not configured. To send automated post-call summaries via WhatsApp, please configure the credentials in backend/.env."
        }

    # If configured, send via Meta Cloud API
    url = f"https://graph.facebook.com/v19.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_API_TOKEN}",
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
            return {
                "status": "sent",
                "call_id": call_id,
                "configured": True,
                "whatsapp_response": resp.json()
            }
        else:
            return {
                "status": "error",
                "call_id": call_id,
                "configured": True,
                "error": resp.text
            }
    except Exception as e:
        return {
            "status": "failed",
            "call_id": call_id,
            "configured": True,
            "error": str(e)
        }
