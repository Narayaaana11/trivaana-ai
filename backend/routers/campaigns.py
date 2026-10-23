"""
TRIVAANA AI: Campaigns Router
Batch outbound campaign management, queue controls, TRAI calling windows, and emergency kill switch.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import sqlite3

from core.dependencies import get_current_tenant, get_db
from services.campaign_service import CampaignService

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])

class CreateCampaignRequest(BaseModel):
    name: str = Field(..., description="Campaign name")
    agent_id: Optional[str] = Field(None, description="Assigned agent ID")
    concurrency: Optional[int] = Field(5, ge=1, le=50, description="Concurrent calling lines")

class StartCampaignRequest(BaseModel):
    campaign_id: Optional[str] = Field(None, description="Campaign ID to start (uses latest if empty)")
    concurrency: Optional[int] = Field(5, ge=1, le=50, description="Max concurrent lines")
    max_calls: Optional[int] = Field(20, ge=1, le=500, description="Max leads to dial in batch")
    bypass_trai: Optional[bool] = Field(False, description="Bypass TRAI 10am-6pm IST calling window guard")

class CampaignActionRequest(BaseModel):
    campaign_id: str = Field(..., description="Target Campaign ID")

@router.get("")
def list_campaigns(
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """List all campaigns for current authenticated tenant."""
    cur = conn.cursor()
    cur.execute("""
    SELECT c.*, a.name as agent_name,
        (SELECT COUNT(*) FROM campaign_jobs WHERE campaign_id = c.id AND status = 'pending') as pending_jobs,
        (SELECT COUNT(*) FROM campaign_jobs WHERE campaign_id = c.id AND status = 'completed') as completed_jobs
    FROM campaigns c
    LEFT JOIN agents a ON c.agent_id = a.id
    WHERE c.tenant_id = ?
    ORDER BY c.created_at DESC
    """, (current_tenant["id"],))
    rows = cur.fetchall()

    campaigns = []
    for r in rows:
        campaigns.append({
            "id": r["id"],
            "tenant_id": r["tenant_id"],
            "name": r["name"],
            "agent_id": r["agent_id"],
            "agent_name": r["agent_name"],
            "status": r["status"],
            "concurrency": r["concurrency"],
            "total_contacts": r["total_contacts"],
            "placed": r["placed"],
            "answered": r["connected"] if "connected" in r.keys() else 0,
            "connected": r["connected"] if "connected" in r.keys() else 0,
            "qualified": r["demos"] if "demos" in r.keys() else 0,
            "demos": r["demos"] if "demos" in r.keys() else 0,
            "pending_jobs": r["pending_jobs"],
            "completed_jobs": r["completed_jobs"],
            "created_at": r["created_at"]
        })
    return {"campaigns": campaigns, "count": len(campaigns)}

@router.post("")
def create_campaign(
    req: CreateCampaignRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Create a new campaign definition."""
    return CampaignService.create_campaign(
        conn=conn,
        tenant_id=current_tenant["id"],
        name=req.name,
        agent_id=req.agent_id,
        concurrency=req.concurrency or 5
    )

@router.post("/start")
def start_campaign(
    req: StartCampaignRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Launch campaign execution: enqueues leads and dispatches to telephony workers.
    Enforces TRAI commercial calling window (10:00 AM - 6:00 PM IST) unless explicitly bypassed.
    """
    cur = conn.cursor()
    campaign_id = req.campaign_id

    if not campaign_id:
        cur.execute(
            "SELECT id FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
            (current_tenant["id"],)
        )
        row = cur.fetchone()
        if not row:
            # Create a default campaign automatically
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
        result = CampaignService.start_campaign(
            conn=conn,
            tenant_id=current_tenant["id"],
            campaign_id=campaign_id,
            concurrency=req.concurrency or 5,
            max_calls=req.max_calls or 20,
            bypass_trai=req.bypass_trai or False
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Campaign start failed: {str(e)}")

@router.post("/pause")
def pause_campaign(
    req: CampaignActionRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Pause an active campaign."""
    return CampaignService.pause_campaign(conn, current_tenant["id"], req.campaign_id)

@router.post("/resume")
def resume_campaign(
    req: CampaignActionRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Resume a paused campaign."""
    return CampaignService.resume_campaign(conn, current_tenant["id"], req.campaign_id)

@router.post("/kill")
def kill_campaign(
    req: Optional[CampaignActionRequest] = None,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    EMERGENCY KILL SWITCH: Immediately halts running campaigns, purges pending queue jobs,
    and invokes carrier APIs to terminate active connected phone lines.
    """
    target_id = req.campaign_id if req else None
    return CampaignService.kill_campaign(conn, current_tenant["id"], target_id)
