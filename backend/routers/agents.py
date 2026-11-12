"""
TRIVAANA AI: AI Employee Builder, Prompt Generation, Versioning & Lifecycle Router
Supports full no-code AI Employee creation, OpenAI structured prompt generation,
version history/diff/restore, lifecycle management, and grounded test sandbox.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import json
import re
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from database.connection import get_db
from core.dependencies import get_current_tenant, get_current_user, require_roles, require_scope
from core.security import hash_api_key
from services.ai_prompt_service import AIPromptService
from services.audit_service import AuditService

router = APIRouter(prefix="/api/agents", tags=["AI Employees"])

VALID_LIFECYCLE_STATUSES = {"draft", "testing", "published", "active", "paused", "archived"}


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "ai-employee"
    return f"{base[:36]}-{uuid.uuid4().hex[:6]}"


def _serialize_agent(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    # Never expose hashed intake secret
    d.pop("intake_secret_hash", None)
    d["questions"] = json.loads(d.get("questions_json") or "[]")
    d["extraction_schema"] = json.loads(d.get("extraction_schema_json") or "[]")
    d["never_say"] = json.loads(d.get("never_say_json") or "[]")
    d["never_do"] = json.loads(d.get("never_do_json") or "[]")
    d["structured_config"] = json.loads(d.get("structured_config_json") or "{}")
    d["calling_hours"] = json.loads(d.get("calling_hours_json") or '{"start":"10:00","end":"18:00","timezone":"Asia/Kolkata"}')
    d["caller_memory_enabled"] = bool(d.get("caller_memory_enabled", 0))
    d["recording_disclosure_enabled"] = bool(d.get("recording_disclosure_enabled", 1))
    return d


class CreateAgentRequest(BaseModel):
    name: str
    vertical: str = "Real Estate"
    business_name: Optional[str] = None
    designation: Optional[str] = "AI Voice Specialist"
    objective: Optional[str] = None
    calling_purpose: Optional[str] = "lead_qualification"
    call_direction: str = "outbound"
    language: str = "te-IN"
    voice_model: str = "Sarvam AI (bulbul:v4-flash)"
    voice_id: Optional[str] = "meera"
    voice_gender: Optional[str] = "female"
    provider: str = "sarvam"
    speaking_style: Optional[str] = "warm_professional"
    personality: Optional[str] = "courteous, concise, helpful"
    greeting_message: Optional[str] = None
    system_prompt: str
    conversation_instructions: Optional[str] = None
    questions: List[str] = Field(default_factory=list)
    extraction_schema: List[Dict[str, Any]] = Field(default_factory=list)
    qualification_criteria: Optional[str] = None
    appointment_requirements: Optional[str] = None
    call_ending_conditions: Optional[str] = None
    escalation_conditions: Optional[str] = None
    never_say: List[str] = Field(default_factory=list)
    never_do: List[str] = Field(default_factory=list)
    structured_config: Dict[str, Any] = Field(default_factory=dict)
    calling_hours: Optional[Dict[str, Any]] = None
    caller_memory_enabled: bool = False
    recording_disclosure_enabled: bool = True
    transfer_number: Optional[str] = None
    post_call_webhook_url: Optional[str] = None
    speech_rate: float = 1.0
    stability: float = 0.6
    status: str = "active"


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    vertical: Optional[str] = None
    business_name: Optional[str] = None
    designation: Optional[str] = None
    objective: Optional[str] = None
    calling_purpose: Optional[str] = None
    call_direction: Optional[str] = None
    language: Optional[str] = None
    voice_model: Optional[str] = None
    voice_id: Optional[str] = None
    voice_gender: Optional[str] = None
    provider: Optional[str] = None
    speaking_style: Optional[str] = None
    personality: Optional[str] = None
    greeting_message: Optional[str] = None
    system_prompt: Optional[str] = None
    conversation_instructions: Optional[str] = None
    questions: Optional[List[str]] = None
    extraction_schema: Optional[List[Dict[str, Any]]] = None
    qualification_criteria: Optional[str] = None
    appointment_requirements: Optional[str] = None
    call_ending_conditions: Optional[str] = None
    escalation_conditions: Optional[str] = None
    never_say: Optional[List[str]] = None
    never_do: Optional[List[str]] = None
    structured_config: Optional[Dict[str, Any]] = None
    calling_hours: Optional[Dict[str, Any]] = None
    caller_memory_enabled: Optional[bool] = None
    recording_disclosure_enabled: Optional[bool] = None
    transfer_number: Optional[str] = None
    post_call_webhook_url: Optional[str] = None
    speech_rate: Optional[float] = None
    stability: Optional[float] = None
    status: Optional[str] = None
    change_note: Optional[str] = None


class GeneratePromptRequest(BaseModel):
    description: str
    employee_name: str = "Trivaana Advisor"
    business_name: str = "Our Business"
    industry: str = "Real Estate"
    designation: str = "AI Voice Specialist"
    language: str = "te-IN"
    call_direction: str = "outbound"
    speaking_style: str = "warm_professional"
    save_to_agent: bool = False


class LifecycleRequest(BaseModel):
    status: str


class TestTurnRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = Field(default_factory=list)
    lead_context: Optional[Dict[str, Any]] = None


@router.get("", dependencies=[Depends(require_scope("agents:read"))])
def list_agents(
    status_filter: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    q = "SELECT * FROM agents WHERE tenant_id = ?"
    params: List[Any] = [tenant["id"]]
    if status_filter:
        q += " AND status = ?"
        params.append(status_filter)
    q += " ORDER BY created_at ASC"
    cur.execute(q, params)
    agents = [_serialize_agent(r) for r in cur.fetchall()]
    return {"agents": agents, "count": len(agents)}


@router.post("/generate-prompt", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def generate_prompt_preview(
    req: GeneratePromptRequest,
    tenant: dict = Depends(get_current_tenant),
):
    """Generate a structured AI employee prompt configuration from natural language."""
    return AIPromptService.generate_structured_config(
        description=req.description,
        employee_name=req.employee_name,
        business_name=req.business_name,
        industry=req.industry,
        designation=req.designation,
        language=req.language,
        call_direction=req.call_direction,
        speaking_style=req.speaking_style,
    )


@router.get("/{agent_id}", dependencies=[Depends(require_scope("agents:read"))])
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
    agent = _serialize_agent(row)

    # Enrich with agent-specific metrics
    cur.execute("SELECT COUNT(*) as total_calls, COALESCE(SUM(duration_seconds), 0) as total_sec FROM calls WHERE agent_id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    stats = cur.fetchone()
    cur.execute("SELECT COUNT(*) as kb_docs FROM knowledge_documents WHERE (agent_id = ? OR agent_id IS NULL) AND tenant_id = ?", (agent_id, tenant["id"]))
    kb = cur.fetchone()
    cur.execute("SELECT COUNT(*) as action_cnt FROM agent_actions WHERE agent_id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    act = cur.fetchone()

    agent["metrics"] = {
        "total_calls": stats["total_calls"],
        "total_duration_seconds": stats["total_sec"],
        "knowledge_documents": kb["kb_docs"],
        "configured_actions": act["action_cnt"],
    }
    return agent


@router.post("", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def create_agent(
    req: CreateAgentRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    if req.status not in VALID_LIFECYCLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid lifecycle status '{req.status}'")
    if req.post_call_webhook_url:
        from services.webhook_service import is_safe_public_url
        if not is_safe_public_url(req.post_call_webhook_url):
            raise HTTPException(status_code=400, detail="Unsafe post_call_webhook_url: blocked by SSRF policy.")

    cur = db.cursor()
    agent_id = f"agent_{uuid.uuid4().hex[:8]}"
    slug = _slugify(req.name)
    raw_intake_secret = f"trv_lead_{secrets.token_hex(16)}"
    intake_secret_hash = hash_api_key(raw_intake_secret)
    now = datetime.now(timezone.utc).isoformat()
    calling_hours_json = json.dumps(req.calling_hours or {"start": "10:00", "end": "18:00", "timezone": "Asia/Kolkata"})

    cur.execute("""
    INSERT INTO agents (
        id, tenant_id, name, slug, intake_secret_hash, vertical, business_name, designation,
        objective, calling_purpose, call_direction, language, voice_model, voice_id, voice_gender,
        provider, speaking_style, personality, greeting_message, system_prompt, conversation_instructions,
        questions_json, extraction_schema_json, qualification_criteria, appointment_requirements,
        call_ending_conditions, escalation_conditions, never_say_json, never_do_json,
        structured_config_json, calling_hours_json, caller_memory_enabled, recording_disclosure_enabled,
        transfer_number, post_call_webhook_url, speech_rate, stability, status, current_version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    """, (
        agent_id, tenant["id"], req.name.strip(), slug, intake_secret_hash, req.vertical,
        req.business_name or tenant["name"], req.designation, req.objective, req.calling_purpose,
        req.call_direction, req.language, req.voice_model, req.voice_id, req.voice_gender,
        req.provider, req.speaking_style, req.personality, req.greeting_message, req.system_prompt,
        req.conversation_instructions, json.dumps(req.questions), json.dumps(req.extraction_schema),
        req.qualification_criteria, req.appointment_requirements, req.call_ending_conditions,
        req.escalation_conditions, json.dumps(req.never_say), json.dumps(req.never_do),
        json.dumps(req.structured_config), calling_hours_json, 1 if req.caller_memory_enabled else 0,
        1 if req.recording_disclosure_enabled else 0, req.transfer_number, req.post_call_webhook_url,
        req.speech_rate, req.stability, req.status, now, now
    ))

    # Save initial version v1
    cur.execute("""
    INSERT INTO agent_versions (id, agent_id, tenant_id, version_number, system_prompt, structured_config_json, change_note, created_by, created_at)
    VALUES (?, ?, ?, 1, ?, ?, 'Initial version', ?, ?)
    """, (f"ver_{uuid.uuid4().hex[:8]}", agent_id, tenant["id"], req.system_prompt, json.dumps(req.structured_config), current_user["id"], now))

    AuditService.log_event(
        db,
        action="agent.created",
        resource_type="agent",
        resource_id=agent_id,
        tenant_id=tenant["id"],
        actor_user_id=current_user["id"],
        actor_email=current_user.get("email"),
        metadata={"name": req.name, "language": req.language, "status": req.status},
    )
    db.commit()

    return {
        "status": "success",
        "agent_id": agent_id,
        "slug": slug,
        "intake_secret": raw_intake_secret,
        "message": f"AI Employee '{req.name}' created successfully"
    }


@router.put("/{agent_id}", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def update_agent(
    agent_id: str,
    req: UpdateAgentRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    if req.status is not None and req.status not in VALID_LIFECYCLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid lifecycle status '{req.status}'")
    if req.post_call_webhook_url:
        from services.webhook_service import is_safe_public_url
        if not is_safe_public_url(req.post_call_webhook_url):
            raise HTTPException(status_code=400, detail="Unsafe post_call_webhook_url: blocked by SSRF policy.")

    now = datetime.now(timezone.utc).isoformat()
    fields = []
    params = []

    simple_map = {
        "name": req.name,
        "vertical": req.vertical,
        "business_name": req.business_name,
        "designation": req.designation,
        "objective": req.objective,
        "calling_purpose": req.calling_purpose,
        "call_direction": req.call_direction,
        "language": req.language,
        "voice_model": req.voice_model,
        "voice_id": req.voice_id,
        "voice_gender": req.voice_gender,
        "provider": req.provider,
        "speaking_style": req.speaking_style,
        "personality": req.personality,
        "greeting_message": req.greeting_message,
        "system_prompt": req.system_prompt,
        "conversation_instructions": req.conversation_instructions,
        "qualification_criteria": req.qualification_criteria,
        "appointment_requirements": req.appointment_requirements,
        "call_ending_conditions": req.call_ending_conditions,
        "escalation_conditions": req.escalation_conditions,
        "transfer_number": req.transfer_number,
        "post_call_webhook_url": req.post_call_webhook_url,
        "speech_rate": req.speech_rate,
        "stability": req.stability,
        "status": req.status,
    }
    for col, val in simple_map.items():
        if val is not None:
            fields.append(f"{col} = ?")
            params.append(val)

    if req.questions is not None:
        fields.append("questions_json = ?")
        params.append(json.dumps(req.questions))
    if req.extraction_schema is not None:
        fields.append("extraction_schema_json = ?")
        params.append(json.dumps(req.extraction_schema))
    if req.never_say is not None:
        fields.append("never_say_json = ?")
        params.append(json.dumps(req.never_say))
    if req.never_do is not None:
        fields.append("never_do_json = ?")
        params.append(json.dumps(req.never_do))
    if req.structured_config is not None:
        fields.append("structured_config_json = ?")
        params.append(json.dumps(req.structured_config))
    if req.calling_hours is not None:
        fields.append("calling_hours_json = ?")
        params.append(json.dumps(req.calling_hours))
    if req.caller_memory_enabled is not None:
        fields.append("caller_memory_enabled = ?")
        params.append(1 if req.caller_memory_enabled else 0)
    if req.recording_disclosure_enabled is not None:
        fields.append("recording_disclosure_enabled = ?")
        params.append(1 if req.recording_disclosure_enabled else 0)

    new_version = (existing["current_version"] or 1)
    if req.system_prompt is not None or req.structured_config is not None:
        new_version += 1
        fields.append("current_version = ?")
        params.append(new_version)
        cur.execute("""
        INSERT INTO agent_versions (id, agent_id, tenant_id, version_number, system_prompt, structured_config_json, change_note, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            f"ver_{uuid.uuid4().hex[:8]}",
            agent_id,
            tenant["id"],
            new_version,
            req.system_prompt if req.system_prompt is not None else existing["system_prompt"],
            json.dumps(req.structured_config) if req.structured_config is not None else (existing["structured_config_json"] or "{}"),
            req.change_note or f"Updated to v{new_version}",
            current_user["id"],
            now,
        ))

    fields.append("updated_at = ?")
    params.append(now)
    params.extend([agent_id, tenant["id"]])
    cur.execute(f"UPDATE agents SET {', '.join(fields)} WHERE id = ? AND tenant_id = ?", params)
    db.commit()

    cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    updated = _serialize_agent(cur.fetchone())
    updated["agent_id"] = agent_id
    updated["message"] = "Agent configuration persisted to database"
    return updated


@router.post("/{agent_id}/lifecycle", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def update_agent_lifecycle(
    agent_id: str,
    req: LifecycleRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    target = req.status.lower()
    if target not in VALID_LIFECYCLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid lifecycle status '{req.status}'")
    cur = db.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "UPDATE agents SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
        (target, now, agent_id, tenant["id"])
    )
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.commit()
    return {"status": "success", "agent_id": agent_id, "lifecycle_status": target}


@router.post("/{agent_id}/prompt/generate", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def generate_prompt_for_agent(
    agent_id: str,
    req: GeneratePromptRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    agent = cur.fetchone()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    result = AIPromptService.generate_structured_config(
        description=req.description,
        employee_name=req.employee_name or agent["name"],
        business_name=req.business_name or agent["business_name"] or tenant["name"],
        industry=req.industry or agent["vertical"],
        designation=req.designation or agent["designation"] or "AI Voice Specialist",
        language=req.language or agent["language"],
        call_direction=req.call_direction or agent["call_direction"],
        speaking_style=req.speaking_style or agent["speaking_style"] or "warm_professional",
    )

    if req.save_to_agent:
        cfg = result["config"]
        now = datetime.now(timezone.utc).isoformat()
        new_ver = (agent["current_version"] or 1) + 1
        cur.execute("""
        UPDATE agents SET
            system_prompt = ?, personality = ?, greeting_message = ?,
            questions_json = ?, extraction_schema_json = ?,
            qualification_criteria = ?, escalation_conditions = ?,
            call_ending_conditions = ?, never_say_json = ?,
            structured_config_json = ?, current_version = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
        """, (
            cfg["system_prompt"],
            cfg["personality"],
            cfg["greeting"],
            json.dumps(cfg["question_sequence"]),
            json.dumps(cfg["data_extraction_schema"]),
            cfg["qualification_logic"],
            cfg["escalation_conditions"],
            cfg["call_ending_behaviour"],
            json.dumps(cfg["safety_restrictions"]),
            json.dumps(cfg),
            new_ver,
            now,
            agent_id,
            tenant["id"],
        ))
        cur.execute("""
        INSERT INTO agent_versions (id, agent_id, tenant_id, version_number, system_prompt, structured_config_json, change_note, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"ver_{uuid.uuid4().hex[:8]}", agent_id, tenant["id"], new_ver, cfg["system_prompt"], json.dumps(cfg), f"AI Generated ({result['generation_mode']})", current_user["id"], now))
        db.commit()
        result["saved_version"] = new_ver

    return result


@router.get("/{agent_id}/prompt/versions", dependencies=[Depends(require_scope("agents:read"))])
def list_prompt_versions(
    agent_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute(
        "SELECT * FROM agent_versions WHERE agent_id = ? AND tenant_id = ? ORDER BY version_number DESC",
        (agent_id, tenant["id"])
    )
    versions = []
    for r in cur.fetchall():
        d = dict(r)
        d["structured_config"] = json.loads(d.pop("structured_config_json", "{}") or "{}")
        versions.append(d)
    return {"versions": versions, "count": len(versions)}


@router.post("/{agent_id}/prompt/restore/{version_id}", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def restore_prompt_version(
    agent_id: str,
    version_id: str,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT * FROM agent_versions WHERE id = ? AND agent_id = ? AND tenant_id = ?", (version_id, agent_id, tenant["id"]))
    ver = cur.fetchone()
    if not ver:
        raise HTTPException(status_code=404, detail="Prompt version not found")

    cur.execute("SELECT current_version FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    agent = cur.fetchone()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    now = datetime.now(timezone.utc).isoformat()
    next_ver = (agent["current_version"] or 1) + 1
    cur.execute("""
    UPDATE agents SET system_prompt = ?, structured_config_json = ?, current_version = ?, updated_at = ?
    WHERE id = ? AND tenant_id = ?
    """, (ver["system_prompt"], ver["structured_config_json"], next_ver, now, agent_id, tenant["id"]))
    cur.execute("""
    INSERT INTO agent_versions (id, agent_id, tenant_id, version_number, system_prompt, structured_config_json, change_note, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        f"ver_{uuid.uuid4().hex[:8]}", agent_id, tenant["id"], next_ver,
        ver["system_prompt"], ver["structured_config_json"], f"Restored from v{ver['version_number']}", current_user["id"], now
    ))
    db.commit()
    return {"status": "restored", "agent_id": agent_id, "restored_from_version": ver["version_number"], "new_version": next_ver}


@router.post("/{agent_id}/test-turn", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def test_agent_conversation_turn(
    agent_id: str,
    req: TestTurnRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = dict(row)
    return AIPromptService.simulate_agent_turn(
        conn=db,
        tenant_id=tenant["id"],
        agent=agent,
        user_message=req.message,
        history=req.history,
        lead_context=req.lead_context,
    )


@router.post("/{agent_id}/intake-secret/rotate", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin"]))])
def rotate_agent_intake_secret(
    agent_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT id, slug FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    agent = cur.fetchone()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    raw_secret = f"trv_lead_{secrets.token_hex(16)}"
    slug = agent["slug"] or _slugify(agent_id)
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "UPDATE agents SET slug = ?, intake_secret_hash = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
        (slug, hash_api_key(raw_secret), now, agent_id, tenant["id"])
    )
    db.commit()
    return {
        "status": "rotated",
        "agent_id": agent_id,
        "slug": slug,
        "intake_secret": raw_secret,
        "endpoint": f"/api/public/lead-intake/{slug}",
    }


@router.delete("/{agent_id}", dependencies=[Depends(require_scope("agents:write")), Depends(require_roles(["owner", "admin"]))])
def archive_agent_soft_delete(
    agent_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    """Archives an AI Employee safely (preserving call history & foreign-key integrity)."""
    cur = db.cursor()
    cur.execute("SELECT id FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Agent not found")
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "UPDATE agents SET status = 'archived', updated_at = ? WHERE id = ? AND tenant_id = ?",
        (now, agent_id, tenant["id"]),
    )
    db.commit()
    return {"status": "archived", "agent_id": agent_id}
