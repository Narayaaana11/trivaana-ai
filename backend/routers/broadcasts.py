"""
TRIVAANA AI: Voice Broadcast Router
Separate one-way voice announcement module with TTS audio generation, recipient validation,
DNC scrubbing, scheduling, pause/start controls, and separate billing/reporting.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import base64
import csv
import io
import sqlite3
import uuid
from datetime import datetime, timezone

from database.connection import get_db
from core.dependencies import get_current_tenant, require_roles, require_scope
from core.config import settings
from providers import get_telephony_provider
from providers.voice_adapters import get_voice_provider
from services.call_service import normalize_phone
from services.compliance_service import ComplianceService
from services.billing_service import BillingService, InsufficientBalanceError
from services.storage_service import StorageService

router = APIRouter(prefix="/api/broadcasts", tags=["Voice Broadcast"])


class CreateBroadcastRequest(BaseModel):
    name: str
    message_text: Optional[str] = None
    audio_url: Optional[str] = None
    language: str = "te-IN"
    voice_provider: str = "sarvam"
    voice_id: str = "meera"
    scheduled_at: Optional[str] = None
    is_sandbox: bool = False
    recipients: List[dict] = []


@router.get("", dependencies=[Depends(require_scope("broadcasts:read"))])
def list_broadcasts(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM voice_broadcasts WHERE tenant_id = ? ORDER BY created_at DESC", (tenant["id"],))
    items = [dict(r) for r in cur.fetchall()]
    return {"broadcasts": items, "count": len(items)}


@router.post("", dependencies=[Depends(require_scope("broadcasts:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def create_broadcast(
    req: CreateBroadcastRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    if not req.message_text and not req.audio_url:
        raise HTTPException(status_code=400, detail="Provide either message_text for TTS or an audio_url")

    bid = f"brc_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    status_str = "scheduled" if req.scheduled_at else "draft"
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO voice_broadcasts (
            id, tenant_id, name, message_text, audio_url, language, voice_provider,
            voice_id, status, scheduled_at, total_recipients, is_sandbox, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        """,
        (
            bid, tenant["id"], req.name.strip(), req.message_text, req.audio_url,
            req.language, req.voice_provider, req.voice_id, status_str, req.scheduled_at,
            1 if req.is_sandbox else 0, now, now,
        ),
    )

    added = 0
    for rec in req.recipients:
        raw_phone = str(rec.get("phone") or "")
        norm = normalize_phone(raw_phone)
        if len(norm) < 10:
            continue
        sup = ComplianceService.is_suppressed(db, tenant["id"], norm)
        r_status = "dnc_blocked" if sup["suppressed"] else "pending"
        cur.execute(
            """
            INSERT INTO voice_broadcast_recipients (id, broadcast_id, tenant_id, name, phone, status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (f"brcr_{uuid.uuid4().hex[:8]}", bid, tenant["id"], rec.get("name", ""), norm, r_status, now),
        )
        added += 1

    cur.execute("UPDATE voice_broadcasts SET total_recipients = ? WHERE id = ?", (added, bid))
    db.commit()
    return {"status": "created", "broadcast_id": bid, "total_recipients": added}


@router.post("/upload-audio", dependencies=[Depends(require_scope("broadcasts:write")), Depends(require_roles(["owner", "admin", "operator"]))])
async def upload_broadcast_audio(
    file: UploadFile = File(...),
    tenant: dict = Depends(get_current_tenant),
):
    filename = file.filename or "announcement.mp3"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("mp3", "wav", "ogg", "m4a"):
        raise HTTPException(status_code=400, detail=f"Unsupported audio format '.{ext}'. Allowed: mp3, wav, ogg, m4a")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file exceeds maximum allowed size of 25 MB")
    stored = StorageService.save_file(
        tenant_id=tenant["id"],
        category="broadcasts",
        filename=filename,
        content=content,
        content_type=file.content_type or "audio/mpeg",
    )
    return {"status": "uploaded", **stored}


@router.post("/{broadcast_id}/preview-audio", dependencies=[Depends(require_scope("broadcasts:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def preview_broadcast_audio(
    broadcast_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM voice_broadcasts WHERE id = ? AND tenant_id = ?", (broadcast_id, tenant["id"]))
    b = cur.fetchone()
    if not b:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    if b["audio_url"]:
        return {"status": "uploaded_audio", "audio_url": b["audio_url"], "configured": True}

    provider = get_voice_provider(b["voice_provider"])
    if not getattr(provider, "is_configured", False):
        return {
            "status": "sandbox_only",
            "configured": False,
            "message": f"{b['voice_provider']} credentials not configured; use browser speech preview locally.",
            "text": b["message_text"],
        }

    audio = provider.synthesize_speech(b["message_text"] or "", language=b["language"], voice_id=b["voice_id"])
    return {
        "status": "synthesized",
        "configured": True,
        "content_type": "audio/mpeg",
        "audio_base64": base64.b64encode(audio).decode("ascii"),
    }


@router.post("/{broadcast_id}/recipients/csv", dependencies=[Depends(require_scope("broadcasts:write")), Depends(require_roles(["owner", "admin", "operator"]))])
async def upload_broadcast_csv(
    broadcast_id: str,
    file: UploadFile = File(...),
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT id FROM voice_broadcasts WHERE id = ? AND tenant_id = ?", (broadcast_id, tenant["id"]))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Broadcast not found")

    filename = (file.filename or "").lower()
    if not filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv recipient files are supported")

    max_bytes = 10 * 1024 * 1024
    chunks: List[bytes] = []
    total_read = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > max_bytes:
            raise HTTPException(status_code=413, detail="Broadcast CSV exceeds maximum allowed size of 10 MB")
        chunks.append(chunk)
    raw = b"".join(chunks)
    if not raw.strip():
        raise HTTPException(status_code=400, detail="Broadcast CSV file is empty")
    text = raw.decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    now = datetime.now(timezone.utc).isoformat()
    added = 0
    blocked = 0
    for row in reader:
        phone_val = row.get("phone") or row.get("mobile") or row.get("Phone") or ""
        norm = normalize_phone(phone_val)
        if len(norm) < 10:
            continue
        sup = ComplianceService.is_suppressed(db, tenant["id"], norm)
        r_status = "dnc_blocked" if sup["suppressed"] else "pending"
        if r_status == "dnc_blocked":
            blocked += 1
        cur.execute(
            "INSERT INTO voice_broadcast_recipients (id, broadcast_id, tenant_id, name, phone, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (f"brcr_{uuid.uuid4().hex[:8]}", broadcast_id, tenant["id"], row.get("name") or row.get("Name") or "", norm, r_status, now),
        )
        added += 1

    cur.execute(
        "UPDATE voice_broadcasts SET total_recipients = (SELECT COUNT(*) FROM voice_broadcast_recipients WHERE broadcast_id = ?), updated_at = ? WHERE id = ?",
        (broadcast_id, now, broadcast_id),
    )
    db.commit()
    return {"status": "imported", "added": added, "dnc_blocked": blocked}


@router.post("/{broadcast_id}/start", dependencies=[Depends(require_scope("broadcasts:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def start_broadcast(
    broadcast_id: str,
    is_sandbox: bool = False,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    pause = ComplianceService.get_emergency_pause(db)
    if pause["paused"]:
        raise HTTPException(
            status_code=503,
            detail=f"Outbound calling paused by platform administrator: {pause['reason']}",
        )

    cur = db.cursor()
    cur.execute("SELECT * FROM voice_broadcasts WHERE id = ? AND tenant_id = ?", (broadcast_id, tenant["id"]))
    b = cur.fetchone()
    if not b:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    cur.execute(
        "SELECT * FROM voice_broadcast_recipients WHERE broadcast_id = ? AND status = 'pending'",
        (broadcast_id,),
    )
    pending = cur.fetchall()
    if not pending:
        raise HTTPException(status_code=400, detail="No pending eligible recipients in broadcast")

    use_sandbox = is_sandbox or bool(b["is_sandbox"]) or (
        not settings.has_exotel and not settings.has_twilio and not settings.has_plivo and not settings.has_vobiz
    )
    if not use_sandbox and not ComplianceService.is_within_calling_hours("09:00", "21:00"):
        raise HTTPException(
            status_code=400,
            detail="Voice broadcast blocked: outside TRAI permitted calling window (09:00-21:00 IST).",
        )

    audio_url = b["audio_url"]
    if not audio_url and b["message_text"]:
        try:
            tts = get_voice_provider(b["voice_provider"] or "sarvam")
            if getattr(tts, "is_configured", False):
                synth = tts.synthesize_speech(
                    text=b["message_text"],
                    language=b["language"] or "te-IN",
                    voice_id=b["voice_id"] or "meera",
                )
                saved = StorageService.save_file(
                    tenant_id=tenant["id"],
                    category="broadcasts",
                    filename=f"{broadcast_id}.mp3",
                    content=synth,
                    content_type="audio/mpeg",
                )
                audio_url = saved.get("url") or audio_url
        except Exception:
            pass

    tel_provider = None if use_sandbox else get_telephony_provider()
    now = datetime.now(timezone.utc).isoformat()
    delivered = 0
    failed_count = 0
    total_cost_paise = 0

    for rec in pending:
        per_call_paise = 0 if use_sandbox else settings.BROADCAST_PAISE_PER_CALL
        if not use_sandbox:
            if not tel_provider or not getattr(tel_provider, "is_configured", False):
                raise HTTPException(
                    status_code=503,
                    detail="Live voice broadcast requested, but no telephony provider is configured.",
                )
            dispatch_res = tel_provider.initiate_call(
                to_phone=rec["phone"],
                extra_data={
                    "call_id": rec["id"],
                    "broadcast_id": broadcast_id,
                    "audio_url": audio_url,
                    "language": b["language"],
                },
            )
            if not dispatch_res.success:
                cur.execute(
                    "UPDATE voice_broadcast_recipients SET status = 'failed', updated_at = ? WHERE id = ?",
                    (now, rec["id"]),
                )
                failed_count += 1
                continue

        if per_call_paise > 0:
            try:
                BillingService.debit_wallet(
                    conn=db,
                    tenant_id=tenant["id"],
                    amount_paise=per_call_paise,
                    description=f"Voice Broadcast ({b['name']}) -> {rec['phone']}",
                    idempotency_key=f"brc_{broadcast_id}_{rec['id']}",
                    commit=False,
                )
            except InsufficientBalanceError as exc:
                db.rollback()
                raise HTTPException(status_code=402, detail=str(exc))
            total_cost_paise += per_call_paise

        final_status = "delivered" if use_sandbox else "playing"
        cur.execute(
            "UPDATE voice_broadcast_recipients SET status = ?, cost_paise = ?, updated_at = ? WHERE id = ?",
            (final_status, per_call_paise, now, rec["id"]),
        )
        delivered += 1

    cur.execute(
        """
        UPDATE voice_broadcasts
        SET status = ?, delivered_count = delivered_count + ?, total_cost_paise = total_cost_paise + ?,
            audio_url = COALESCE(?, audio_url), is_sandbox = ?, updated_at = ?
        WHERE id = ?
        """,
        ("completed" if use_sandbox else "running", delivered, total_cost_paise, audio_url, 1 if use_sandbox else 0, now, broadcast_id),
    )
    db.commit()
    return {
        "status": "completed" if use_sandbox else "running",
        "broadcast_id": broadcast_id,
        "processed_count": delivered,
        "failed_count": failed_count,
        "total_cost_paise": total_cost_paise,
        "is_sandbox": use_sandbox,
    }


@router.post("/{broadcast_id}/pause", dependencies=[Depends(require_scope("broadcasts:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def pause_broadcast(
    broadcast_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("UPDATE voice_broadcasts SET status = 'paused', updated_at = ? WHERE id = ? AND tenant_id = ?", (datetime.now(timezone.utc).isoformat(), broadcast_id, tenant["id"]))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    db.commit()
    return {"status": "paused", "broadcast_id": broadcast_id}


@router.get("/{broadcast_id}", dependencies=[Depends(require_scope("broadcasts:read"))])
def get_broadcast_details(
    broadcast_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM voice_broadcasts WHERE id = ? AND tenant_id = ?", (broadcast_id, tenant["id"]))
    b = cur.fetchone()
    if not b:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    cur.execute("SELECT * FROM voice_broadcast_recipients WHERE broadcast_id = ? AND tenant_id = ? LIMIT 200", (broadcast_id, tenant["id"]))
    recipients = [dict(r) for r in cur.fetchall()]
    return {"broadcast": dict(b), "recipients": recipients}

