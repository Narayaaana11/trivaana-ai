"""
TRIVAANA AI: Custom AI Actions & Caller Memory Router
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional
import json
import sqlite3
import uuid
from datetime import datetime, timezone

from database.connection import get_db
from core.dependencies import get_current_tenant
from services.action_service import ActionService
from services.call_service import normalize_phone

router = APIRouter(prefix="/api", tags=["AI Actions & Memory"])


class CreateActionRequest(BaseModel):
    name: str
    action_type: str  # 'google_calendar', 'whatsapp_template', 'google_sheets', 'custom_api', 'call_transfer', 'caller_memory'
    description: str
    config: Dict[str, Any] = Field(default_factory=dict)
    parameters_schema: Dict[str, Any] = Field(default_factory=dict)
    execution_conditions: Optional[str] = None
    is_enabled: bool = True


class UpdateActionRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    parameters_schema: Optional[Dict[str, Any]] = None
    execution_conditions: Optional[str] = None
    is_enabled: Optional[bool] = None


class ExecuteCallActionRequest(BaseModel):
    action_id: Optional[str] = None
    action_type: str
    action_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    is_sandbox: bool = False


class UpsertMemoryRequest(BaseModel):
    phone: str
    caller_name: Optional[str] = None
    summary: str
    preferences: Dict[str, Any] = Field(default_factory=dict)
    last_appointment: Optional[str] = None


@router.get("/agents/{agent_id}/actions")
def list_agent_actions(
    agent_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute(
        "SELECT * FROM agent_actions WHERE agent_id = ? AND tenant_id = ? ORDER BY created_at ASC",
        (agent_id, tenant["id"]),
    )
    actions = []
    for r in cur.fetchall():
        d = dict(r)
        d["config"] = json.loads(d.pop("config_json", "{}") or "{}")
        d["parameters_schema"] = json.loads(d.pop("parameters_schema_json", "{}") or "{}")
        d["is_enabled"] = bool(d["is_enabled"])
        actions.append(d)
    return {"actions": actions, "count": len(actions)}


@router.post("/agents/{agent_id}/actions")
def create_agent_action(
    agent_id: str,
    req: CreateActionRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT id FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Agent not found")

    action_id = f"act_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        """
        INSERT INTO agent_actions (
            id, agent_id, tenant_id, name, action_type, description,
            config_json, parameters_schema_json, execution_conditions, is_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            action_id, agent_id, tenant["id"], req.name.strip(), req.action_type,
            req.description.strip(), json.dumps(req.config), json.dumps(req.parameters_schema),
            req.execution_conditions, 1 if req.is_enabled else 0, now, now,
        ),
    )
    db.commit()
    return {"status": "success", "action_id": action_id}


@router.put("/agents/{agent_id}/actions/{action_id}")
def update_agent_action(
    agent_id: str,
    action_id: str,
    req: UpdateActionRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT id FROM agent_actions WHERE id = ? AND agent_id = ? AND tenant_id = ?", (action_id, agent_id, tenant["id"]))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Action not found")

    now = datetime.now(timezone.utc).isoformat()
    fields = ["updated_at = ?"]
    params: list = [now]
    if req.name is not None:
        fields.append("name = ?")
        params.append(req.name)
    if req.description is not None:
        fields.append("description = ?")
        params.append(req.description)
    if req.config is not None:
        fields.append("config_json = ?")
        params.append(json.dumps(req.config))
    if req.parameters_schema is not None:
        fields.append("parameters_schema_json = ?")
        params.append(json.dumps(req.parameters_schema))
    if req.execution_conditions is not None:
        fields.append("execution_conditions = ?")
        params.append(req.execution_conditions)
    if req.is_enabled is not None:
        fields.append("is_enabled = ?")
        params.append(1 if req.is_enabled else 0)

    params.extend([action_id, tenant["id"]])
    cur.execute(f"UPDATE agent_actions SET {', '.join(fields)} WHERE id = ? AND tenant_id = ?", params)
    db.commit()
    return {"status": "success", "action_id": action_id}


@router.delete("/agents/{agent_id}/actions/{action_id}")
def delete_agent_action(
    agent_id: str,
    action_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("DELETE FROM agent_actions WHERE id = ? AND agent_id = ? AND tenant_id = ?", (action_id, agent_id, tenant["id"]))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Action not found")
    db.commit()
    return {"status": "deleted", "action_id": action_id}


@router.post("/calls/{call_id}/actions/execute")
def execute_during_call_action(
    call_id: str,
    req: ExecuteCallActionRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT id, agent_id, is_sandbox FROM calls WHERE id = ? AND tenant_id = ?", (call_id, tenant["id"]))
    call = cur.fetchone()
    if not call:
        raise HTTPException(status_code=404, detail="Call record not found")

    return ActionService.execute_action(
        conn=db,
        tenant_id=tenant["id"],
        call_id=call_id,
        action_type=req.action_type,
        action_name=req.action_name,
        arguments=req.arguments,
        agent_id=call["agent_id"],
        action_id=req.action_id,
        is_sandbox=req.is_sandbox or bool(call["is_sandbox"]),
    )


@router.get("/caller-memory")
def list_caller_memories(
    phone: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    q = "SELECT * FROM caller_memories WHERE tenant_id = ?"
    params: list = [tenant["id"]]
    if phone:
        q += " AND phone = ?"
        params.append(normalize_phone(phone))
    q += " ORDER BY updated_at DESC LIMIT 200"
    cur.execute(q, params)
    memories = []
    for r in cur.fetchall():
        d = dict(r)
        d["preferences"] = json.loads(d.pop("preferences_json", "{}") or "{}")
        memories.append(d)
    return {"memories": memories, "count": len(memories)}


@router.post("/caller-memory")
def upsert_caller_memory(
    req: UpsertMemoryRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    norm = normalize_phone(req.phone)
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute("SELECT id FROM caller_memories WHERE tenant_id = ? AND phone = ?", (tenant["id"], norm))
    existing = cur.fetchone()
    if existing:
        cur.execute(
            """
            UPDATE caller_memories
            SET caller_name = COALESCE(?, caller_name), summary = ?, preferences_json = ?,
                last_appointment = COALESCE(?, last_appointment), interaction_count = interaction_count + 1, updated_at = ?
            WHERE id = ?
            """,
            (req.caller_name, req.summary, json.dumps(req.preferences), req.last_appointment, now, existing["id"]),
        )
        mem_id = existing["id"]
    else:
        mem_id = f"mem_{uuid.uuid4().hex[:8]}"
        cur.execute(
            """
            INSERT INTO caller_memories (id, tenant_id, phone, caller_name, summary, preferences_json, last_appointment, interaction_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (mem_id, tenant["id"], norm, req.caller_name, req.summary, json.dumps(req.preferences), req.last_appointment, now, now),
        )
    db.commit()
    return {"status": "saved", "memory_id": mem_id, "phone": norm}


@router.delete("/caller-memory/{memory_id}")
def delete_caller_memory(
    memory_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("DELETE FROM caller_memories WHERE id = ? AND tenant_id = ?", (memory_id, tenant["id"]))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Caller memory not found")
    db.commit()
    return {"status": "deleted", "memory_id": memory_id}

