"""
TRIVAANA AI: Visual Workflows & Temporal Execution Router
Persists @xyflow/react workflow graphs and dispatches durable executions.
"""

from datetime import datetime, timezone
import json
import sqlite3
import uuid
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.dependencies import get_current_tenant, get_current_user, get_db, require_roles, require_scope
from services.workflow_engine import trigger_workflow_execution

router = APIRouter(prefix="/api/workflows", tags=["Workflows"])


class CreateWorkflowRequest(BaseModel):
    name: str
    trigger_type: str = "call_completed"
    is_active: bool = True
    graph: Dict[str, Any] = Field(default_factory=lambda: {"nodes": [], "edges": []})


class ExecuteWorkflowRequest(BaseModel):
    trigger_event: str = "manual"
    context: Dict[str, Any] = Field(default_factory=dict)


@router.get("", dependencies=[Depends(require_scope("workflows:read"))])
def list_workflows(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM workflows WHERE tenant_id = ? ORDER BY updated_at DESC", (tenant["id"],))
    items = []
    for r in cur.fetchall():
        d = dict(r)
        d["graph"] = json.loads(d.pop("graph_json", '{"nodes":[],"edges":[]}') or "{}")
        d["is_active"] = bool(d["is_active"])
        items.append(d)
    return {"workflows": items, "count": len(items)}


@router.post("", dependencies=[Depends(require_scope("workflows:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def create_workflow(
    req: CreateWorkflowRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    wf_id = f"wfl_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO workflows (id, tenant_id, name, trigger_type, is_active, graph_json, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (wf_id, tenant["id"], req.name.strip(), req.trigger_type, 1 if req.is_active else 0, json.dumps(req.graph), current_user["id"], now, now),
    )
    db.commit()
    return {"status": "created", "workflow_id": wf_id}


@router.put("/{workflow_id}", dependencies=[Depends(require_scope("workflows:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def update_workflow(
    workflow_id: str,
    req: CreateWorkflowRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute(
        """
        UPDATE workflows SET name = ?, trigger_type = ?, is_active = ?, graph_json = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
        """,
        (req.name.strip(), req.trigger_type, 1 if req.is_active else 0, json.dumps(req.graph), now, workflow_id, tenant["id"]),
    )
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Workflow not found")
    db.commit()
    return {"status": "updated", "workflow_id": workflow_id}


@router.post("/{workflow_id}/execute", dependencies=[Depends(require_scope("workflows:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def execute_workflow(
    workflow_id: str,
    req: ExecuteWorkflowRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    try:
        return trigger_workflow_execution(
            conn=db,
            tenant_id=tenant["id"],
            workflow_id=workflow_id,
            trigger_event=req.trigger_event,
            context=req.context,
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Workflow not found")


@router.get("/{workflow_id}/executions", dependencies=[Depends(require_scope("workflows:read"))])
def list_workflow_executions(
    workflow_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute(
        "SELECT * FROM workflow_executions WHERE workflow_id = ? AND tenant_id = ? ORDER BY started_at DESC LIMIT 50",
        (workflow_id, tenant["id"]),
    )
    rows = []
    for r in cur.fetchall():
        d = dict(r)
        d["context"] = json.loads(d.pop("context_json", "{}") or "{}")
        d["result"] = json.loads(d.pop("result_json", "{}") or "{}")
        rows.append(d)
    return {"executions": rows}

