"""
TRIVAANA AI: Real-Time Voice Engine Router
Provides LiveKit room token minting, streaming pipeline turn execution, and latency benchmarking.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import json
import sqlite3
import time

from database.connection import get_db
from core.dependencies import get_current_tenant
from core.config import settings
from core.security import decode_access_token, hash_api_key
from voice_engine.livekit_bridge import create_livekit_room_token
from voice_engine.livekit_agent_worker import get_worker_capabilities
from voice_engine.pipeline import RealtimeVoicePipeline
from voice_engine.stt_providers import get_stt_provider

router = APIRouter(prefix="/api/voice-engine", tags=["Real-Time Voice Engine"])


class LiveKitTokenRequest(BaseModel):
    agent_id: str
    participant_name: str = "Customer Tester"


class PipelineTurnRequest(BaseModel):
    agent_id: str
    message: str
    call_id: Optional[str] = None
    history: List[Dict[str, str]] = Field(default_factory=list)
    barge_in: bool = False
    synthesize_audio: bool = True
    lead_context: Optional[Dict[str, Any]] = None


@router.get("/status")
def get_voice_engine_status(tenant: dict = Depends(get_current_tenant)):
    worker_caps = get_worker_capabilities()
    return {
        "livekit": {
            "configured": settings.has_livekit,
            "url": settings.LIVEKIT_URL if settings.has_livekit else None,
            "sip_configured": bool(settings.LIVEKIT_SIP_CONFIG),
            "worker": worker_caps,
        },
        "stt_providers": {
            "openai_whisper": get_stt_provider("openai_whisper").is_configured,
            "faster_whisper": get_stt_provider("faster_whisper").is_configured,
            "indic_conformer": get_stt_provider("indic_conformer").is_configured,
        },
        "llm_providers": {
            "openai": settings.has_openai,
            "model": settings.OPENAI_MODEL,
        },
        "tts_providers": {
            "sarvam": settings.has_sarvam,
            "elevenlabs": settings.has_elevenlabs,
            "openai": settings.has_openai,
            "indicf5": settings.has_indicf5,
        },
        "features": {
            "vad_and_turn_detection": True,
            "barge_in_interruption": True,
            "conversational_memory": True,
            "tool_execution": True,
        },
    }


@router.post("/livekit-token")
def generate_livekit_token(
    req: LiveKitTokenRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (req.agent_id, tenant["id"]))
    agent = cur.fetchone()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    room_name = f"trivaana-{tenant['id']}-{req.agent_id}"
    metadata = json.dumps({
        "tenant_id": tenant["id"],
        "agent_id": agent["id"],
        "language": agent["language"],
        "voice_id": agent["voice_id"] or "alloy",
        "system_prompt": agent["system_prompt"],
        "greeting_message": agent["greeting_message"] or "",
    })
    return create_livekit_room_token(
        room_name=room_name,
        identity=f"tester_{tenant['id'][:6]}",
        participant_name=req.participant_name,
        metadata=metadata,
    )


@router.post("/pipeline-turn")
def execute_pipeline_turn(
    req: PipelineTurnRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (req.agent_id, tenant["id"]))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")

    return RealtimeVoicePipeline.run_turn(
        conn=db,
        tenant_id=tenant["id"],
        agent=dict(row),
        user_text=req.message,
        call_id=req.call_id,
        history=req.history,
        barge_in=req.barge_in,
        synthesize_audio=req.synthesize_audio,
        lead_context=req.lead_context,
    )


@router.post("/benchmark")
def benchmark_voice_pipeline(
    agent_id: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    """Run an actual live/sandbox pipeline benchmark and report exact measured stage timings."""
    cur = db.cursor()
    if agent_id:
        cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant["id"]))
    else:
        cur.execute("SELECT * FROM agents WHERE tenant_id = ? LIMIT 1", (tenant["id"],))
    row = cur.fetchone()
    agent = dict(row) if row else {
        "id": "bench_agent",
        "language": "en-IN",
        "provider": "openai",
        "voice_id": "alloy",
        "system_prompt": "You are a concise benchmark assistant.",
    }

    t0 = time.perf_counter()
    res = RealtimeVoicePipeline.run_turn(
        conn=db,
        tenant_id=tenant["id"],
        agent=agent,
        user_text="What are your pricing plans and visiting hours?",
        synthesize_audio=True,
    )
    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    return {
        "status": "completed",
        "measured_total_ms": elapsed_ms,
        "stages": res["latency"],
        "reasoning_mode": res["reasoning_mode"],
        "tts_mode": res["tts_mode"],
        "is_live_provider": res["reasoning_mode"] == "openai",
    }


def _resolve_ws_tenant_id(
    websocket: WebSocket,
    db: sqlite3.Connection,
    token: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Optional[str]:
    """Authenticate WebSocket client via JWT Bearer token or X-API-Key/api_key."""
    cur = db.cursor()
    auth_header = websocket.headers.get("authorization", "")
    bearer = token or (auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else None)
    if bearer:
        payload = decode_access_token(bearer)
        if payload and "sub" in payload:
            cur.execute("SELECT tenant_id FROM users WHERE id = ?", (payload["sub"],))
            u = cur.fetchone()
            if u:
                return u["tenant_id"]

    raw_key = api_key or websocket.headers.get("x-api-key")
    if raw_key:
        key_hash = hash_api_key(raw_key.strip())
        cur.execute("SELECT tenant_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL", (key_hash,))
        ak = cur.fetchone()
        if ak:
            return ak["tenant_id"]
        cur.execute("SELECT id FROM tenants WHERE api_key_hash = ?", (key_hash,))
        t = cur.fetchone()
        if t:
            return t["id"]
    return None


@router.websocket("/ws/{agent_id}")
async def interactive_voice_ws(
    websocket: WebSocket,
    agent_id: str,
    token: Optional[str] = Query(None),
    api_key: Optional[str] = Query(None),
    db: sqlite3.Connection = Depends(get_db),
):
    """Bidirectional WebSocket for authenticated low-latency text/audio conversational testing with barge-in support."""
    tenant_id = _resolve_ws_tenant_id(websocket, db, token=token, api_key=api_key)
    if not tenant_id:
        await websocket.close(code=1008)
        return

    cur = db.cursor()
    cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant_id))
    row = cur.fetchone()
    if not row:
        await websocket.close(code=1008)
        return

    await websocket.accept()

    agent = dict(row)
    history: List[Dict[str, str]] = []
    await websocket.send_json({
        "type": "ready",
        "agent_id": agent_id,
        "greeting": agent.get("greeting_message") or f"Hello! This is {agent['name']}.",
    })

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            event_type = msg.get("type", "turn")
            if event_type == "barge_in":
                await websocket.send_json({"type": "interrupted", "status": "tts_cancelled"})
                continue
            if event_type == "stop":
                break
            user_text = msg.get("text", "")
            res = RealtimeVoicePipeline.run_turn(
                conn=db,
                tenant_id=agent["tenant_id"],
                agent=agent,
                user_text=user_text,
                history=history,
                barge_in=bool(msg.get("barge_in", False)),
                synthesize_audio=bool(msg.get("synthesize_audio", False)),
            )
            history.append({"sender": "caller", "text": user_text})
            history.append({"sender": "ai", "text": res["reply_text"]})
            await websocket.send_json({"type": "response", **res})
    except WebSocketDisconnect:
        pass

