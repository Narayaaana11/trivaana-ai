"""
TRIVAANA AI: Customer Support Ticketing & Internal Staff Operations Portal Router
Separates tenant self-service tickets (/api/support/*) from internal staff portal (/api/staff/*).
"""

from datetime import datetime, timezone
import sqlite3
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.dependencies import get_current_tenant, get_current_user, get_db, require_roles, require_scope, require_staff
from services.audit_service import AuditService

router = APIRouter(prefix="/api", tags=["Support & Staff Portal"])


class CreateTicketRequest(BaseModel):
    subject: str
    description: str
    category: str = "technical"
    priority: str = "medium"


class UpdateTicketStaffRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_staff_id: Optional[str] = None
    resolution_notes: Optional[str] = None


class KycReviewRequest(BaseModel):
    kyc_status: str  # 'verified', 'rejected', 'pending_review'
    notes: Optional[str] = None


@router.get("/support/tickets", dependencies=[Depends(require_scope("support:read"))])
def list_tenant_tickets(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute(
        "SELECT * FROM support_tickets WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 100",
        (tenant["id"],),
    )
    return {"tickets": [dict(r) for r in cur.fetchall()]}


@router.post("/support/tickets", dependencies=[Depends(require_scope("support:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def create_support_ticket(
    req: CreateTicketRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    tkt_id = f"tkt_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO support_tickets (
            id, tenant_id, created_by_user_id, subject, description, category, priority, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
        """,
        (tkt_id, tenant["id"], current_user["id"], req.subject.strip(), req.description.strip(), req.category, req.priority, now, now),
    )
    AuditService.log_event(
        db,
        action="support_ticket.created",
        resource_type="support_ticket",
        resource_id=tkt_id,
        tenant_id=tenant["id"],
        actor_user_id=current_user["id"],
        metadata={"category": req.category, "priority": req.priority},
    )
    db.commit()
    return {"status": "open", "ticket_id": tkt_id}


# --- Internal Staff Portal (/api/staff/*) ---
@router.get("/staff/tickets")
def staff_list_all_tickets(
    status_filter: Optional[str] = None,
    staff_user: dict = Depends(require_staff),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    q = """
    SELECT st.*, t.name as tenant_name
    FROM support_tickets st
    JOIN tenants t ON st.tenant_id = t.id
    """
    params = []
    if status_filter:
        q += " WHERE st.status = ?"
        params.append(status_filter)
    q += " ORDER BY st.updated_at DESC LIMIT 200"
    cur.execute(q, params)
    return {"tickets": [dict(r) for r in cur.fetchall()]}


@router.patch("/staff/tickets/{ticket_id}")
def staff_update_ticket(
    ticket_id: str,
    req: UpdateTicketStaffRequest,
    staff_user: dict = Depends(require_staff),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM support_tickets WHERE id = ?", (ticket_id,))
    ticket = cur.fetchone()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = datetime.now(timezone.utc).isoformat()
    fields = ["updated_at = ?"]
    params = [now]
    if req.status is not None:
        if req.status not in ("open", "in_progress", "resolved", "closed"):
            raise HTTPException(status_code=400, detail="Invalid ticket status")
        fields.append("status = ?")
        params.append(req.status)
    if req.priority is not None:
        if req.priority not in ("low", "medium", "high", "urgent"):
            raise HTTPException(status_code=400, detail="Invalid ticket priority")
        fields.append("priority = ?")
        params.append(req.priority)
    if req.assigned_staff_id is not None:
        fields.append("assigned_staff_id = ?")
        params.append(req.assigned_staff_id)
    if req.resolution_notes is not None:
        fields.append("resolution_notes = ?")
        params.append(req.resolution_notes)

    params.append(ticket_id)
    cur.execute(f"UPDATE support_tickets SET {', '.join(fields)} WHERE id = ?", params)
    AuditService.log_event(
        db,
        action="staff.ticket_updated",
        resource_type="support_ticket",
        resource_id=ticket_id,
        tenant_id=ticket["tenant_id"],
        actor_user_id=staff_user["id"],
        actor_email=staff_user.get("email"),
        metadata=req.model_dump(exclude_none=True),
    )
    db.commit()
    return {"status": "updated", "ticket_id": ticket_id}


@router.get("/staff/kyc-queue")
def staff_list_kyc_queue(
    staff_user: dict = Depends(require_staff),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute(
        """
        SELECT p.id, p.tenant_id, t.name as tenant_name, p.phone_number, p.provider, p.kyc_status, p.compliance_category, p.status, p.created_at
        FROM phone_numbers p
        JOIN tenants t ON p.tenant_id = t.id
        ORDER BY CASE WHEN p.kyc_status != 'verified' THEN 0 ELSE 1 END, p.created_at DESC
        LIMIT 100
        """
    )
    return {"kyc_items": [dict(r) for r in cur.fetchall()]}


@router.post("/staff/kyc-queue/{number_id}/review")
def staff_review_kyc(
    number_id: str,
    req: KycReviewRequest,
    staff_user: dict = Depends(require_staff),
    db: sqlite3.Connection = Depends(get_db),
):
    if req.kyc_status not in ("verified", "rejected", "pending_review"):
        raise HTTPException(status_code=400, detail="Invalid kyc_status; expected verified, rejected, or pending_review")
    cur = db.cursor()
    cur.execute("SELECT * FROM phone_numbers WHERE id = ?", (number_id,))
    num = cur.fetchone()
    if not num:
        raise HTTPException(status_code=404, detail="Phone number not found")
    new_status = "active" if req.kyc_status == "verified" else ("rejected" if req.kyc_status == "rejected" else "pending_kyc")
    cur.execute("UPDATE phone_numbers SET kyc_status = ?, status = ? WHERE id = ?", (req.kyc_status, new_status, number_id))
    AuditService.log_event(
        db,
        action="staff.kyc_reviewed",
        resource_type="phone_number",
        resource_id=number_id,
        tenant_id=num["tenant_id"],
        actor_user_id=staff_user["id"],
        actor_email=staff_user.get("email"),
        metadata={"kyc_status": req.kyc_status, "notes": req.notes},
    )
    db.commit()
    return {"status": "reviewed", "number_id": number_id, "kyc_status": req.kyc_status}


@router.get("/staff/tenants/{tenant_id}/summary")
def staff_audited_tenant_summary(
    tenant_id: str,
    staff_user: dict = Depends(require_staff),
    db: sqlite3.Connection = Depends(get_db),
):
    """Audited read-only customer workspace inspection (does not expose private transcripts)."""
    cur = db.cursor()
    cur.execute("SELECT id, name, plan, status, wallet_balance_paise, concurrency_limit, created_at FROM tenants WHERE id = ?", (tenant_id,))
    tenant = cur.fetchone()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    cur.execute("SELECT COUNT(*) as agents FROM agents WHERE tenant_id = ?", (tenant_id,))
    ag_cnt = cur.fetchone()["agents"]
    cur.execute("SELECT COUNT(*) as calls, COALESCE(SUM(cost_paise),0) as spend_paise FROM calls WHERE tenant_id = ?", (tenant_id,))
    c_stats = dict(cur.fetchone())

    AuditService.log_event(
        db,
        action="staff.viewed_tenant_summary",
        resource_type="tenant",
        resource_id=tenant_id,
        tenant_id=tenant_id,
        actor_user_id=staff_user["id"],
        actor_email=staff_user.get("email"),
        commit=True,
    )
    return {
        "tenant": dict(tenant),
        "agent_count": ag_cnt,
        "call_stats": c_stats,
    }


class DltReviewRequest(BaseModel):
    status: str  # 'approved', 'rejected', 'pending_review'
    notes: Optional[str] = None


@router.get("/staff/dlt-queue")
def staff_list_dlt_queue(
    staff_user: dict = Depends(require_staff),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute(
        """
        SELECT d.*, t.name as tenant_name
        FROM dlt_registrations d
        JOIN tenants t ON d.tenant_id = t.id
        ORDER BY CASE WHEN d.status = 'pending_review' THEN 0 ELSE 1 END, d.created_at DESC
        LIMIT 100
        """
    )
    return {"dlt_items": [dict(r) for r in cur.fetchall()]}


@router.post("/staff/dlt-queue/{dlt_id}/review")
def staff_review_dlt(
    dlt_id: str,
    req: DltReviewRequest,
    staff_user: dict = Depends(require_staff),
    db: sqlite3.Connection = Depends(get_db),
):
    if req.status not in ("approved", "rejected", "pending_review"):
        raise HTTPException(status_code=400, detail="Invalid status; expected approved, rejected, or pending_review")
    cur = db.cursor()
    cur.execute("SELECT * FROM dlt_registrations WHERE id = ?", (dlt_id,))
    item = cur.fetchone()
    if not item:
        raise HTTPException(status_code=404, detail="DLT registration not found")
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "UPDATE dlt_registrations SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
        (req.status, req.notes, staff_user["id"], now, dlt_id),
    )
    AuditService.log_event(
        db,
        action="staff.dlt_reviewed",
        resource_type="dlt_registration",
        resource_id=dlt_id,
        tenant_id=item["tenant_id"],
        actor_user_id=staff_user["id"],
        actor_email=staff_user.get("email"),
        metadata={"status": req.status, "notes": req.notes},
    )
    db.commit()
    return {"status": req.status, "dlt_id": dlt_id}

