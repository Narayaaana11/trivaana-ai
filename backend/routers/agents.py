"""
TRIVAANA AI: Agent Studio & Vernacular Persona Router
Provides persistent CRUD operations for voice agents, prompts, and dialect models.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from database.connection import get_db
from core.dependencies import get_current_tenant

router = APIRouter(prefix="/api/agents", tags=["Voice Agents"])

class CreateAgentRequest(BaseModel):
    name: str
    vertical: str = "Real Estate"
    language: str = "te-IN"
    voice_model: str = "Sarvam AI (bulbul:v4-flash)"
    provider: str = "sarvam"
    system_prompt: str
    speech_rate: float = 1.0

class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    vertical: Optional[str] = None
    language: Optional[str] = None
    voice_model: Optional[str] = None
    provider: Optional[str] = None
    system_prompt: Optional[str] = None
    speech_rate: Optional[float] = None
    status: Optional[str] = None

@router.get("")
def list_agents(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE tenant_id = ? ORDER BY created_at ASC", (tenant["id"],))
    agents = [dict(r) for r in cur.fetchall()]
    return {"agents": agents, "count": len(agents)}

@router.get("/{agent_id}")
def get_agent(
    agent_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return dict(row)

@router.post("")
def create_agent(
    req: CreateAgentRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    agent_id = f"agent_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    cur.execute("""
    INSERT INTO agents (id, tenant_id, name, vertical, language, voice_model, provider, system_prompt, speech_rate, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    """, (
        agent_id, tenant["id"], req.name, req.vertical, req.language,
        req.voice_model, req.provider, req.system_prompt, req.speech_rate, now, now
    ))
    db.commit()

    return {
        "status": "success",
        "agent_id": agent_id,
        "message": f"Voice agent '{req.name}' created successfully"
    }

@router.put("/{agent_id}")
def update_agent(
    agent_id: str,
    req: UpdateAgentRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    now = datetime.now(timezone.utc).isoformat()
    fields = []
    params = []

    if req.name is not None:
        fields.append("name = ?")
        params.append(req.name)
    if req.vertical is not None:
        fields.append("vertical = ?")
        params.append(req.vertical)
    if req.language is not None:
        fields.append("language = ?")
        params.append(req.language)
    if req.voice_model is not None:
        fields.append("voice_model = ?")
        params.append(req.voice_model)
    if req.provider is not None:
        fields.append("provider = ?")
        params.append(req.provider)
    if req.system_prompt is not None:
        fields.append("system_prompt = ?")
        params.append(req.system_prompt)
    if req.speech_rate is not None:
        fields.append("speech_rate = ?")
        params.append(req.speech_rate)
    if req.status is not None:
        fields.append("status = ?")
        params.append(req.status)

    fields.append("updated_at = ?")
    params.append(now)

    params.extend([agent_id, tenant["id"]])
    cur.execute(f"UPDATE agents SET {', '.join(fields)} WHERE id = ? AND tenant_id = ?", params)
    db.commit()

    return {
        "status": "success",
        "agent_id": agent_id,
        "message": "Agent configuration persisted to database"
    }
