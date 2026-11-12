"""
TRIVAANA AI: Campaigns Router
Batch outbound campaign management, per-contact progress, retries, CSV export, TRAI windows, and kill switch.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import csv
import io
import sqlite3
from datetime import datetime, timezone

from core.dependencies import get_current_tenant, get_current_user, get_db, require_roles, require_scope
from services.campaign_service import CampaignService
from services.call_service import CallService
from providers.base import CallStatusEvent

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])


class CreateCampaignRequest(BaseModel):
    name: str = Field(..., description="Campaign name")
    agent_id: Optional[str] = Field(None, description="Assigned agent ID")
    list_id: Optional[str] = Field(None, description="Optional Contact List ID")
    suppression_list_id: Optional[str] = Field(None, description="Optional Suppression List ID")
    concurrency: Optional[int] = Field(5, ge=1, le=50, description="Concurrent calling lines")
    retry_attempts: int = Field(2, ge=0, le=5)
    retry_delay_minutes: int = Field(30, ge=1, le=1440)
    calling_hours: Optional[Dict[str, Any]] = None
    calling_days: Optional[List[str]] = None
    scheduled_at: Optional[str] = None
    is_sandbox: bool = False


class StartCampaignRequest(BaseModel):
    campaign_id: Optional[str] = Field(None, description="Campaign ID to start (uses latest if empty)")
    concurrency: Optional[int] = Field(5, ge=1, le=50, description="Max concurrent lines")
    max_calls: Optional[int] = Field(20, ge=1, le=500, description="Max leads to dial in batch")
    bypass_trai: Optional[bool] = Field(False, description="Bypass TRAI 10am-6pm IST calling window guard")
    is_sandbox: Optional[bool] = None


class CampaignActionRequest(BaseModel):
    campaign_id: str = Field(..., description="Target Campaign ID")


@router.get("", dependencies=[Depends(require_scope("campaigns:read"))])
def list_campaigns(
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("""
    SELECT c.*, a.name as agent_name,
        (SELECT COUNT(*) FROM campaign_jobs WHERE campaign_id = c.id AND status = 'pending') as pending_jobs,
        (SELECT COUNT(*) FROM campaign_jobs WHERE campaign_id = c.id AND status = 'calling') as calling_jobs,
        (SELECT COUNT(*) FROM campaign_jobs WHERE campaign_id = c.id AND status IN ('completed', 'connected', 'interested', 'not_interested', 'callback_requested')) as completed_jobs
    FROM campaigns c
    LEFT JOIN agents a ON c.agent_id = a.id
    WHERE c.tenant_id = ?
    ORDER BY c.created_at DESC
    """, (current_tenant["id"],))
    rows = cur.fetchall()

    campaigns = []
    for r in rows:
        remaining = (r["pending_jobs"] or 0) + (r["calling_jobs"] or 0)
        conc = max(1, r["concurrency"] or 1)
        est_remaining_sec = int((remaining / conc) * 90)
        campaigns.append({
            "id": r["id"],
            "tenant_id": r["tenant_id"],
            "name": r["name"],
            "agent_id": r["agent_id"],
            "agent_name": r["agent_name"],
            "list_id": r["list_id"] if "list_id" in r.keys() else None,
            "status": r["status"],
            "concurrency": r["concurrency"],
            "retry_attempts": r["retry_attempts"] if "retry_attempts" in r.keys() else 2,
            "retry_delay_minutes": r["retry_delay_minutes"] if "retry_delay_minutes" in r.keys() else 30,
            "total_contacts": r["total_contacts"],
            "placed": r["placed"],
            "answered": r["connected"] if "connected" in r.keys() else 0,
            "connected": r["connected"] if "connected" in r.keys() else 0,
            "failed": r["failed"] if "failed" in r.keys() else 0,
            "qualified": r["demos"] if "demos" in r.keys() else 0,
            "demos": r["demos"] if "demos" in r.keys() else 0,
            "interested_count": r["interested_count"] if "interested_count" in r.keys() else 0,
            "not_interested_count": r["not_interested_count"] if "not_interested_count" in r.keys() else 0,
            "callback_count": r["callback_count"] if "callback_count" in r.keys() else 0,
            "no_answer_count": r["no_answer_count"] if "no_answer_count" in r.keys() else 0,
            "pending_jobs": r["pending_jobs"],
            "completed_jobs": r["completed_jobs"],
            "remaining_contacts": remaining,
            "estimated_remaining_seconds": est_remaining_sec,
            "is_sandbox": bool(r["is_sandbox"]) if "is_sandbox" in r.keys() else False,
            "created_at": r["created_at"]
        })
    return {"campaigns": campaigns, "count": len(campaigns)}


@router.get("/{campaign_id}", dependencies=[Depends(require_scope("campaigns:read"))])
def get_campaign_detail(
    campaign_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?", (campaign_id, current_tenant["id"]))
    c = cur.fetchone()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    cur.execute(
        """
        SELECT cj.*, l.name as lead_name, l.phone as lead_phone, l.city as lead_city,
               cl.status as call_status, cl.outcome as call_outcome, cl.duration_seconds as call_duration
        FROM campaign_jobs cj
        LEFT JOIN leads l ON cj.lead_id = l.id
        LEFT JOIN calls cl ON cj.call_id = cl.id
        WHERE cj.campaign_id = ? AND cj.tenant_id = ?
        ORDER BY cj.created_at ASC
        """,
        (campaign_id, current_tenant["id"]),
    )
    contacts = [dict(r) for r in cur.fetchall()]
    return {"campaign": dict(c), "contacts": contacts, "contact_count": len(contacts)}


@router.get("/{campaign_id}/export", dependencies=[Depends(require_scope("campaigns:read"))])
def export_campaign_csv(
    campaign_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM campaigns WHERE id = ? AND tenant_id = ?", (campaign_id, current_tenant["id"]))
    c = cur.fetchone()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    cur.execute(
        """
        SELECT cj.id as job_id, COALESCE(cj.contact_name, l.name) as name, COALESCE(cj.phone, l.phone) as phone,
               cj.status as job_status, cj.retry_count, cl.outcome, cl.duration_seconds, cl.summary
        FROM campaign_jobs cj
        LEFT JOIN leads l ON cj.lead_id = l.id
        LEFT JOIN calls cl ON cj.call_id = cl.id
        WHERE cj.campaign_id = ? AND cj.tenant_id = ?
        """,
        (campaign_id, current_tenant["id"]),
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Job ID", "Contact Name", "Phone", "Status", "Retries", "Outcome", "Duration (s)", "Summary"])
    for r in cur.fetchall():
        writer.writerow([r["job_id"], r["name"], r["phone"], r["job_status"], r["retry_count"], r["outcome"] or "", r["duration_seconds"] or 0, r["summary"] or ""])

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="campaign_{campaign_id}.csv"'},
    )


@router.post("", dependencies=[Depends(require_scope("campaigns:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def create_campaign(
    req: CreateCampaignRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    return CampaignService.create_campaign(
        conn=conn,
        tenant_id=current_tenant["id"],
        name=req.name,
        agent_id=req.agent_id,
        concurrency=req.concurrency or 5,
        list_id=req.list_id,
        suppression_list_id=req.suppression_list_id,
        retry_attempts=req.retry_attempts,
        retry_delay_minutes=req.retry_delay_minutes,
        calling_hours=req.calling_hours,
        calling_days=req.calling_days,
        scheduled_at=req.scheduled_at,
        is_sandbox=req.is_sandbox,
    )


@router.post("/start", dependencies=[Depends(require_scope("campaigns:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def start_campaign(
    req: StartCampaignRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    if req.bypass_trai and not (current_user.get("is_super_admin") or current_user.get("role") in ("owner", "admin")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owners or admins can enable bypass_trai.",
        )
    cur = conn.cursor()
    campaign_id = req.campaign_id

    if not campaign_id:
        cur.execute(
            "SELECT id FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
            (current_tenant["id"],)
        )
        row = cur.fetchone()
        if not row:
            created = CampaignService.create_campaign(
                conn=conn,
                tenant_id=current_tenant["id"],
                name="Primary Outbound Campaign",
                concurrency=req.concurrency or 5
            )
            campaign_id = created["campaign_id"]
        else:
            campaign_id = row["id"]

    try:
        return CampaignService.start_campaign(
            conn=conn,
            tenant_id=current_tenant["id"],
            campaign_id=campaign_id,
            concurrency=req.concurrency or 5,
            max_calls=req.max_calls or 20,
            bypass_trai=req.bypass_trai or False,
            is_sandbox=req.is_sandbox,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Campaign start failed: {str(e)}")


@router.post("/{campaign_id}/simulate-progress", dependencies=[Depends(require_scope("campaigns:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def simulate_campaign_progress(
    campaign_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Advance sandbox/test campaign jobs deterministically for testing without carrier webhooks."""
    cur = conn.cursor()
    cur.execute("SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?", (campaign_id, current_tenant["id"]))
    cmp = cur.fetchone()
    if not cmp:
        raise HTTPException(status_code=404, detail="Campaign not found")

    cur.execute(
        "SELECT * FROM campaign_jobs WHERE campaign_id = ? AND tenant_id = ? AND status = 'calling'",
        (campaign_id, current_tenant["id"]),
    )
    calling_jobs = cur.fetchall()
    now = datetime.now(timezone.utc).isoformat()
    completed_now = 0

    for idx, job in enumerate(calling_jobs):
        if job["call_id"]:
            CallService.process_call_event(
                conn,
                CallStatusEvent(
                    provider="mock",
                    provider_call_id=job["call_id"],
                    status="completed",
                    duration_seconds=60 if idx % 2 == 0 else 45,
                ),
            )
            outcome_status = "interested" if idx % 2 == 0 else "callback_requested"
            cur.execute("UPDATE campaign_jobs SET status = ?, updated_at = ? WHERE id = ?", (outcome_status, now, job["id"]))
            cur.execute(
                "UPDATE calls SET outcome = ?, summary = ?, is_sandbox = 1 WHERE id = ?",
                ("Interested" if outcome_status == "interested" else "Callback Requested", "Sandbox simulated campaign call outcome.", job["call_id"]),
            )
            if outcome_status == "interested":
                cur.execute("UPDATE campaigns SET connected = connected + 1, interested_count = interested_count + 1, demos = demos + 1 WHERE id = ?", (campaign_id,))
            else:
                cur.execute("UPDATE campaigns SET connected = connected + 1, callback_count = callback_count + 1 WHERE id = ?", (campaign_id,))
            completed_now += 1

    conn.commit()
    return {"status": "simulated", "campaign_id": campaign_id, "completed_now": completed_now}


@router.post("/pause", dependencies=[Depends(require_scope("campaigns:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def pause_campaign(
    req: CampaignActionRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    return CampaignService.pause_campaign(conn, current_tenant["id"], req.campaign_id)


@router.post("/{campaign_id}/pause", dependencies=[Depends(require_scope("campaigns:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def pause_campaign_by_id(
    campaign_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    return CampaignService.pause_campaign(conn, current_tenant["id"], campaign_id)


@router.post("/resume", dependencies=[Depends(require_scope("campaigns:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def resume_campaign(
    req: CampaignActionRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    return CampaignService.resume_campaign(conn, current_tenant["id"], req.campaign_id)


@router.post("/{campaign_id}/resume", dependencies=[Depends(require_scope("campaigns:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def resume_campaign_by_id(
    campaign_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    return CampaignService.resume_campaign(conn, current_tenant["id"], campaign_id)


@router.post("/kill", dependencies=[Depends(require_scope("campaigns:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def kill_campaign(
    req: Optional[CampaignActionRequest] = None,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    target_id = req.campaign_id if req else None
    return CampaignService.kill_campaign(conn, current_tenant["id"], target_id)


@router.post("/{campaign_id}/process-retries", dependencies=[Depends(require_scope("campaigns:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def process_campaign_retries(
    campaign_id: str,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    try:
        return CampaignService.process_due_retries(conn, current_tenant["id"], campaign_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
