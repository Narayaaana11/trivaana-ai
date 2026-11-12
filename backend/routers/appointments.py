"""
TRIVAANA AI: Smart Appointment Manager Router
Atomic slot reservations (preventing double-booking) and Google Calendar sync hooks.
"""

from datetime import datetime, timezone
import sqlite3
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.dependencies import get_current_tenant, get_db, require_roles, require_scope
from services.action_service import ActionService
from services.call_service import normalize_phone

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


class CreateAppointmentRequest(BaseModel):
    contact_name: str
    phone: str
    email: Optional[str] = None
    title: str = "Product Consultation"
    scheduled_start: str
    scheduled_end: str
    timezone: str = "Asia/Kolkata"
    lead_id: Optional[str] = None
    call_id: Optional[str] = None
    agent_id: Optional[str] = None
    notes: Optional[str] = None


class UpdateAppointmentRequest(BaseModel):
    status: Optional[str] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    notes: Optional[str] = None


@router.get("", dependencies=[Depends(require_scope("appointments:read"))])
def list_appointments(
    status_filter: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    q = "SELECT * FROM appointments WHERE tenant_id = ?"
    params = [tenant["id"]]
    if status_filter:
        q += " AND status = ?"
        params.append(status_filter)
    q += " ORDER BY scheduled_start ASC LIMIT 200"
    cur.execute(q, params)
    return {"appointments": [dict(r) for r in cur.fetchall()]}


@router.post("", dependencies=[Depends(require_scope("appointments:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def create_appointment(
    req: CreateAppointmentRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute(
        "SELECT id FROM appointments WHERE tenant_id = ? AND scheduled_start = ? AND status = 'scheduled'",
        (tenant["id"], req.scheduled_start.strip()),
    )
    if cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Selected appointment slot is already booked for this workspace.",
        )

    appt_id = f"apt_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    clean_phone = normalize_phone(req.phone)
    try:
        cur.execute(
            """
            INSERT INTO appointments (
                id, tenant_id, lead_id, call_id, agent_id, contact_name, phone, email,
                title, scheduled_start, scheduled_end, timezone, status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
            """,
            (
                appt_id,
                tenant["id"],
                req.lead_id,
                req.call_id,
                req.agent_id,
                req.contact_name.strip(),
                clean_phone,
                req.email,
                req.title.strip(),
                req.scheduled_start.strip(),
                req.scheduled_end.strip(),
                req.timezone,
                req.notes,
                now,
                now,
            ),
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Slot reservation conflict: {exc}")

    cur.execute(
        "SELECT 1 FROM integrations WHERE tenant_id = ? AND provider_key = 'google_calendar' AND status = 'connected'",
        (tenant["id"],),
    )
    gcal_connected = bool(cur.fetchone())
    call_is_sandbox = False
    if req.call_id:
        c_row = cur.execute("SELECT is_sandbox FROM calls WHERE id = ? AND tenant_id = ?", (req.call_id, tenant["id"])).fetchone()
        call_is_sandbox = bool(c_row["is_sandbox"]) if c_row else False

    effective_sandbox = call_is_sandbox or not gcal_connected
    cal_args = {
        "operation": "book_appointment",
        "title": req.title.strip(),
        "start": req.scheduled_start.strip(),
        "end": req.scheduled_end.strip(),
        "timezone": req.timezone,
        "notes": req.notes or "",
    }
    if req.call_id:
        calendar_sync = ActionService.execute_action(
            conn=db,
            tenant_id=tenant["id"],
            call_id=req.call_id,
            action_type="google_calendar",
            action_name="Book Appointment",
            arguments=cal_args,
            agent_id=req.agent_id,
            is_sandbox=effective_sandbox,
        )
    elif gcal_connected:
        calendar_sync = ActionService.sync_google_calendar_event(
            conn=db,
            tenant_id=tenant["id"],
            arguments=cal_args,
            is_sandbox=False,
        )
    else:
        calendar_sync = {
            "status": "not_configured",
            "result": {"configured": False, "message": "Google Calendar integration is not connected for this workspace."},
        }

    return {
        "status": "scheduled",
        "appointment_id": appt_id,
        "scheduled_start": req.scheduled_start.strip(),
        "calendar_sync": calendar_sync,
    }


@router.patch("/{appointment_id}", dependencies=[Depends(require_scope("appointments:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def update_appointment(
    appointment_id: str,
    req: UpdateAppointmentRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM appointments WHERE id = ? AND tenant_id = ?", (appointment_id, tenant["id"]))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Appointment not found")

    now = datetime.now(timezone.utc).isoformat()
    fields = ["updated_at = ?"]
    params = [now]
    if req.status is not None:
        fields.append("status = ?")
        params.append(req.status)
    if req.scheduled_start is not None:
        fields.append("scheduled_start = ?")
        params.append(req.scheduled_start)
    if req.scheduled_end is not None:
        fields.append("scheduled_end = ?")
        params.append(req.scheduled_end)
    if req.notes is not None:
        fields.append("notes = ?")
        params.append(req.notes)

    params.extend([appointment_id, tenant["id"]])
    cur.execute(f"UPDATE appointments SET {', '.join(fields)} WHERE id = ? AND tenant_id = ?", params)
    db.commit()
    return {"status": "updated", "appointment_id": appointment_id}

