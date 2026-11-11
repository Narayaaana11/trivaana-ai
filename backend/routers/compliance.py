"""
TRIVAANA AI: Compliance, Consent & Do-Not-Call Router
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import sqlite3
import uuid
from datetime import datetime, timezone

from database.connection import get_db
from core.dependencies import get_current_tenant, get_current_user
from services.compliance_service import ComplianceService
from services.call_service import normalize_phone
from services.audit_service import AuditService

router = APIRouter(prefix="/api/compliance", tags=["Compliance & Consent"])


class ConsentRequest(BaseModel):
    phone: str
    lead_id: Optional[str] = None
    consent_status: str = "opted_in"  # 'opted_in', 'opted_out', 'revoked'
    consent_source: str = "web_form"
    consent_purpose: str = "service_callback"
    call_category: str = "service"  # 'service', 'transactional', 'promotional'
    evidence_url_or_ref: Optional[str] = None


class DncRequest(BaseModel):
    phone: str
    reason: str = "Customer opt-out"
    source: str = "manual"


class PolicyUpdateRequest(BaseModel):
    calling_window_start: Optional[str] = None
    calling_window_end: Optional[str] = None
    enforce_dnd_scrubbing: Optional[bool] = None
    require_explicit_consent: Optional[bool] = None
    require_recording_disclosure: Optional[bool] = None
    allow_promotional_calls: Optional[bool] = None
    approved_series_prefix: Optional[str] = None


@router.get("/policy")
def get_compliance_policy(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    policy = ComplianceService.get_policy(db, tenant["id"])
    return {
        "policy": policy,
        "within_calling_hours": ComplianceService.is_within_calling_hours(
            policy.get("calling_window_start", "10:00"),
            policy.get("calling_window_end", "18:00"),
        ),
        "regulatory_note": "Indian commercial/promotional calling is governed by TRAI TCCCPR regulations, entity/header registration, DND preferences, and explicit consent requirements.",
    }


@router.put("/policy")
def update_compliance_policy(
    req: PolicyUpdateRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    ComplianceService.get_policy(db, tenant["id"])
    cur = db.cursor()
    now = datetime.now(timezone.utc).isoformat()
    fields = ["updated_at = ?"]
    params = [now]

    if req.calling_window_start is not None:
        fields.append("calling_window_start = ?")
        params.append(req.calling_window_start)
    if req.calling_window_end is not None:
        fields.append("calling_window_end = ?")
        params.append(req.calling_window_end)
    if req.enforce_dnd_scrubbing is not None:
        fields.append("enforce_dnd_scrubbing = ?")
        params.append(1 if req.enforce_dnd_scrubbing else 0)
    if req.require_explicit_consent is not None:
        fields.append("require_explicit_consent = ?")
        params.append(1 if req.require_explicit_consent else 0)
    if req.require_recording_disclosure is not None:
        fields.append("require_recording_disclosure = ?")
        params.append(1 if req.require_recording_disclosure else 0)
    if req.allow_promotional_calls is not None:
        fields.append("allow_promotional_calls = ?")
        params.append(1 if req.allow_promotional_calls else 0)
    if req.approved_series_prefix is not None:
        fields.append("approved_series_prefix = ?")
        params.append(req.approved_series_prefix)

    params.append(tenant["id"])
    cur.execute(f"UPDATE compliance_policies SET {', '.join(fields)} WHERE tenant_id = ?", params)
    AuditService.log_event(
        db,
        action="compliance_policy.updated",
        resource_type="compliance_policy",
        tenant_id=tenant["id"],
        actor_user_id=current_user["id"],
        actor_email=current_user.get("email"),
        metadata=req.model_dump(exclude_none=True),
    )
    db.commit()
    return {"status": "success", "policy": ComplianceService.get_policy(db, tenant["id"])}


@router.get("/consents")
def list_consents(
    phone: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    q = "SELECT * FROM consent_records WHERE tenant_id = ?"
    params = [tenant["id"]]
    if phone:
        q += " AND phone = ?"
        params.append(normalize_phone(phone))
    q += " ORDER BY recorded_at DESC LIMIT 200"
    cur.execute(q, params)
    records = [dict(r) for r in cur.fetchall()]
    return {"consents": records, "count": len(records)}


@router.post("/consents")
def record_consent(
    req: ConsentRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    norm = normalize_phone(req.phone)
    if len(norm) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    now = datetime.now(timezone.utc).isoformat()
    cid = f"cns_{uuid.uuid4().hex[:8]}"
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO consent_records (
            id, tenant_id, lead_id, phone, consent_status, consent_source,
            consent_purpose, call_category, evidence_url_or_ref, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            cid, tenant["id"], req.lead_id, norm, req.consent_status, req.consent_source,
            req.consent_purpose, req.call_category, req.evidence_url_or_ref, now,
        ),
    )
    if req.consent_status in ("opted_out", "revoked"):
        ComplianceService.add_dnc(db, tenant["id"], norm, reason="Consent revoked", source=req.consent_source)
    else:
        cur.execute(
            "UPDATE leads SET consent_status = ?, opt_out = 0 WHERE tenant_id = ? AND phone = ?",
            (req.consent_status, tenant["id"], norm),
        )
    AuditService.log_event(
        db,
        action="consent.recorded",
        resource_type="consent_record",
        resource_id=cid,
        tenant_id=tenant["id"],
        actor_user_id=current_user["id"],
        metadata={"phone": norm, "status": req.consent_status, "category": req.call_category},
    )
    db.commit()
    return {"status": "success", "consent_id": cid, "phone": norm}


@router.get("/dnc")
def list_dnc_entries(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM do_not_call_entries WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 500", (tenant["id"],))
    entries = [dict(r) for r in cur.fetchall()]
    return {"entries": entries, "count": len(entries)}


@router.post("/dnc")
def add_dnc_entry(
    req: DncRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    norm = normalize_phone(req.phone)
    if len(norm) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    res = ComplianceService.add_dnc(db, tenant["id"], norm, reason=req.reason, source=req.source)
    AuditService.log_event(
        db,
        action="dnc.added",
        resource_type="do_not_call",
        resource_id=res["id"],
        tenant_id=tenant["id"],
        actor_user_id=current_user["id"],
        metadata={"phone": norm, "reason": req.reason},
        commit=True,
    )
    return res


@router.delete("/dnc/{entry_id}")
def remove_dnc_entry(
    entry_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("DELETE FROM do_not_call_entries WHERE id = ? AND tenant_id = ?", (entry_id, tenant["id"]))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="DNC entry not found")
    db.commit()
    return {"status": "removed", "entry_id": entry_id}


class DispositionMapRequest(BaseModel):
    mapping: dict[str, str]


@router.get("/dispositions")
def get_disposition_mapping(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    from services.disposition_service import DispositionService
    return {"tenant_id": tenant["id"], "mapping": DispositionService.get_mapping(db, tenant["id"])}


@router.put("/dispositions")
def update_disposition_mapping(
    req: DispositionMapRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    from services.disposition_service import DispositionService
    saved = DispositionService.save_mapping(db, tenant["id"], req.mapping)
    AuditService.log_event(
        db,
        action="disposition_mapping.updated",
        resource_type="system_configs",
        resource_id=tenant["id"],
        tenant_id=tenant["id"],
        actor_user_id=current_user["id"],
        metadata={"keys": list(saved.keys())},
        commit=True,
    )
    return {"status": "updated", "mapping": saved}

