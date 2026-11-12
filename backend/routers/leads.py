"""
TRIVAANA AI: Lead & Contact CRM Management, CSV Ingestion, Contact Lists & Truthful Discovery Router
Enforces tenant scoping, E.164 phone validation, row-by-row error reporting, pagination, and opt-out compliance.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from pydantic import BaseModel, Field
import json
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from database.connection import get_db
from core.dependencies import get_current_tenant, require_roles, require_scope
from services.lead_service import LeadService
from services.call_service import normalize_phone
from services.compliance_service import ComplianceService

router = APIRouter(prefix="/api", tags=["Leads & Contacts"])


class CreateLeadRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    city: Optional[str] = "Hyderabad"
    vertical: Optional[str] = "Real Estate"
    lead_status: Optional[str] = "new"
    source: Optional[str] = "Manual Entry"
    call_category: Optional[str] = "service"
    tags: List[str] = Field(default_factory=list)
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    follow_up_at: Optional[str] = None
    callback_at: Optional[str] = None
    notes: Optional[str] = None


class UpdateLeadRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    vertical: Optional[str] = None
    lead_status: Optional[str] = None
    status: Optional[str] = None
    call_category: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    follow_up_at: Optional[str] = None
    callback_at: Optional[str] = None
    notes: Optional[str] = None


class BulkPasteContactsRequest(BaseModel):
    contacts: List[Dict[str, Any]]
    list_name: Optional[str] = None
    source: str = "Paste Import"
    consent_confirmed: bool = False


class CreateContactListRequest(BaseModel):
    name: str
    list_type: str = "reusable"  # 'reusable' | 'suppression'
    description: Optional[str] = None
    lead_ids: List[str] = Field(default_factory=list)
    phones: List[str] = Field(default_factory=list)
    consent_confirmed: bool = False


def _compute_lead_score(lead_dict: Dict[str, Any], call_count: int = 0, positive_calls: int = 0, appt_count: int = 0) -> tuple[int, str]:
    if lead_dict.get("opt_out") or lead_dict.get("lead_status") == "do_not_call":
        return 0, "dnc"

    status_base = {
        "converted": 95,
        "interested": 82,
        "callback_required": 72,
        "contacted": 52,
        "new": 45,
        "not_interested": 15,
    }
    score = status_base.get(str(lead_dict.get("lead_status") or "new").lower(), 40)
    if lead_dict.get("consent_status") == "opted_in":
        score += 5
    if lead_dict.get("email"):
        score += 3
    score += min(call_count * 4, 12)
    score += min(positive_calls * 8, 16)
    score += min(appt_count * 12, 15)
    score = max(0, min(100, int(score)))

    if score >= 75:
        tier = "hot"
    elif score >= 45:
        tier = "warm"
    else:
        tier = "cold"
    return score, tier


def _serialize_lead(row: sqlite3.Row, call_count: int = 0, positive_calls: int = 0, appt_count: int = 0) -> Dict[str, Any]:
    d = dict(row)
    d["tags"] = json.loads(d.pop("tags_json", "[]") or "[]")
    d["custom_fields"] = json.loads(d.pop("custom_fields_json", "{}") or "{}")
    d["lead_status"] = d.get("lead_status") or "new"
    score, tier = _compute_lead_score(d, call_count=call_count, positive_calls=positive_calls, appt_count=appt_count)
    d["lead_score"] = score
    d["qualification_tier"] = tier
    return d


@router.get("/leads", dependencies=[Depends(require_scope("leads:read"))])
@router.get("/contacts", dependencies=[Depends(require_scope("leads:read"))])
def list_leads(
    search: Optional[str] = None,
    status: Optional[str] = None,
    lead_status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    where = "WHERE tenant_id = ?"
    params: List[Any] = [tenant["id"]]

    if search:
        where += " AND (name LIKE ? OR phone LIKE ? OR city LIKE ? OR COALESCE(email,'') LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term, term])

    if status and status != "all":
        where += " AND (status = ? OR lead_status = ?)"
        params.extend([status, status])

    if lead_status and lead_status != "all":
        if lead_status == "do_not_call":
            where += " AND (opt_out = 1 OR lead_status = 'do_not_call')"
        else:
            where += " AND lead_status = ?"
            params.append(lead_status)

    cur.execute(f"SELECT COUNT(*) as total FROM leads {where}", params)
    total_count = cur.fetchone()["total"]

    cur.execute(f"SELECT * FROM leads {where} ORDER BY created_at DESC LIMIT ? OFFSET ?", [*params, limit, offset])
    rows = cur.fetchall()

    # Batch-fetch call & appointment signal counts to avoid N+1 queries
    cur.execute(
        "SELECT phone, COUNT(*) as cnt, COUNT(CASE WHEN sentiment='positive' THEN 1 END) as pos_cnt FROM calls WHERE tenant_id = ? GROUP BY phone",
        (tenant["id"],),
    )
    call_stats = {r["phone"]: (r["cnt"], r["pos_cnt"]) for r in cur.fetchall()}
    cur.execute(
        "SELECT phone, COUNT(*) as cnt FROM appointments WHERE tenant_id = ? AND status = 'scheduled' GROUP BY phone",
        (tenant["id"],),
    )
    appt_stats = {r["phone"]: r["cnt"] for r in cur.fetchall()}

    leads = []
    for r in rows:
        c_cnt, pos_cnt = call_stats.get(r["phone"], (0, 0))
        a_cnt = appt_stats.get(r["phone"], 0)
        leads.append(_serialize_lead(r, call_count=c_cnt, positive_calls=pos_cnt, appt_count=a_cnt))
    return {"leads": leads, "count": len(leads), "total": total_count, "limit": limit, "offset": offset}


@router.get("/leads/discover", dependencies=[Depends(require_scope("leads:read"))])
def discover_leads(
    city: str = "Hyderabad",
    vertical: str = "Real Estate",
    limit: int = 15,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    return LeadService.discover_leads_scout(
        conn=db,
        tenant_id=tenant["id"],
        city=city,
        vertical=vertical,
        limit=limit
    )


@router.get("/leads/{lead_id}", dependencies=[Depends(require_scope("leads:read"))])
def get_lead_detail(
    lead_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT * FROM leads WHERE id = ? AND tenant_id = ?", (lead_id, tenant["id"]))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead = _serialize_lead(row)
    cur.execute(
        "SELECT id, agent_id, direction, status, outcome, duration_seconds, summary, created_at FROM calls WHERE tenant_id = ? AND (lead_id = ? OR phone = ?) ORDER BY created_at DESC LIMIT 50",
        (tenant["id"], lead_id, row["phone"]),
    )
    lead["call_history"] = [dict(r) for r in cur.fetchall()]

    cur.execute(
        "SELECT * FROM consent_records WHERE tenant_id = ? AND phone = ? ORDER BY recorded_at DESC LIMIT 20",
        (tenant["id"], row["phone"]),
    )
    lead["consent_history"] = [dict(r) for r in cur.fetchall()]
    return lead


@router.get("/leads/{lead_id}/timeline", dependencies=[Depends(require_scope("leads:read"))])
def get_lead_timeline(
    lead_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM leads WHERE id = ? AND tenant_id = ?", (lead_id, tenant["id"]))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Lead not found")

    cur.execute(
        "SELECT id, agent_id, direction, status, outcome, sentiment, duration_seconds, summary, created_at FROM calls WHERE tenant_id = ? AND (lead_id = ? OR phone = ?) ORDER BY created_at DESC LIMIT 50",
        (tenant["id"], lead_id, row["phone"]),
    )
    calls = [dict(r) for r in cur.fetchall()]

    cur.execute(
        "SELECT id, title, status, scheduled_start, scheduled_end, created_at FROM appointments WHERE tenant_id = ? AND (lead_id = ? OR phone = ?) ORDER BY created_at DESC LIMIT 30",
        (tenant["id"], lead_id, row["phone"]),
    )
    appointments = [dict(r) for r in cur.fetchall()]

    cur.execute(
        "SELECT id, action_type, action_name, status, created_at FROM call_actions WHERE tenant_id = ? AND call_id IN (SELECT id FROM calls WHERE tenant_id = ? AND (lead_id = ? OR phone = ?)) ORDER BY created_at DESC LIMIT 30",
        (tenant["id"], tenant["id"], lead_id, row["phone"]),
    )
    actions = [dict(r) for r in cur.fetchall()]

    cur.execute(
        "SELECT id, consent_status, consent_source, consent_purpose, recorded_at FROM consent_records WHERE tenant_id = ? AND phone = ? ORDER BY recorded_at DESC LIMIT 20",
        (tenant["id"], row["phone"]),
    )
    consents = [dict(r) for r in cur.fetchall()]

    pos_calls = sum(1 for c in calls if c.get("sentiment") == "positive")
    lead = _serialize_lead(row, call_count=len(calls), positive_calls=pos_calls, appt_count=len(appointments))

    events: List[Dict[str, Any]] = [
        {
            "id": f"evt_created_{lead['id']}",
            "event_type": "lead_created",
            "title": f"Lead added via {lead.get('source') or 'Workspace'}",
            "detail": f"Status: {lead['lead_status']} • City: {lead.get('city') or 'N/A'}",
            "status": lead["lead_status"],
            "timestamp": lead["created_at"],
        }
    ]
    for c in calls:
        events.append({
            "id": f"evt_call_{c['id']}",
            "event_type": "call",
            "title": f"{str(c.get('direction') or 'outbound').title()} AI Call ({c.get('duration_seconds') or 0}s)",
            "detail": c.get("summary") or c.get("outcome") or c.get("status"),
            "status": c.get("sentiment") or c.get("status"),
            "timestamp": c["created_at"],
        })
    for a in appointments:
        events.append({
            "id": f"evt_appt_{a['id']}",
            "event_type": "appointment",
            "title": f"Appointment: {a['title']}",
            "detail": f"Scheduled {a['scheduled_start']}",
            "status": a["status"],
            "timestamp": a["created_at"],
        })
    for act in actions:
        events.append({
            "id": f"evt_act_{act['id']}",
            "event_type": "ai_action",
            "title": f"AI Action: {act['action_name']}",
            "detail": act["action_type"],
            "status": act["status"],
            "timestamp": act["created_at"],
        })
    for cr in consents:
        events.append({
            "id": f"evt_cons_{cr['id']}",
            "event_type": "consent",
            "title": f"Consent {cr['consent_status']} ({cr.get('consent_source') or 'record'})",
            "detail": cr.get("consent_purpose") or "",
            "status": cr["consent_status"],
            "timestamp": cr["recorded_at"],
        })

    events.sort(key=lambda e: str(e.get("timestamp") or ""), reverse=True)
    return {"lead": lead, "timeline": events}


@router.post("/leads", dependencies=[Depends(require_scope("leads:write")), Depends(require_roles(["owner", "admin", "operator"]))])
@router.post("/contacts", dependencies=[Depends(require_scope("leads:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def create_lead(
    req: CreateLeadRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    clean_phone = normalize_phone(req.phone)
    digits = re.sub(r"[^\d]", "", clean_phone)
    if len(digits) < 10 or len(digits) > 15:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid phone number: '{req.phone}'. Must be 10-15 digits."
        )

    cur = db.cursor()
    cur.execute("SELECT id FROM leads WHERE tenant_id = ? AND phone = ?", (tenant["id"], clean_phone))
    if cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A contact with phone number '{clean_phone}' already exists in your workspace."
        )

    lead_id = f"lead_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    is_dnc = req.lead_status == "do_not_call"

    cur.execute("""
    INSERT INTO leads (
        id, tenant_id, name, phone, email, city, vertical, status, lead_status,
        source, consent_status, call_category, opt_out, tags_json, custom_fields_json,
        follow_up_at, callback_at, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        lead_id, tenant["id"], req.name.strip(), clean_phone, req.email, req.city, req.vertical,
        req.lead_status or "new", req.source or "Manual Entry",
        "opted_out" if is_dnc else "opted_in", req.call_category or "service",
        1 if is_dnc else 0, json.dumps(req.tags), json.dumps(req.custom_fields),
        req.follow_up_at, req.callback_at, req.notes, now, now
    ))
    db.commit()

    cur.execute("SELECT * FROM leads WHERE id = ?", (lead_id,))
    lead_obj = _serialize_lead(cur.fetchone())
    return {"status": "success", "lead_id": lead_id, "phone": clean_phone, "lead": lead_obj}


@router.put("/leads/{lead_id}", dependencies=[Depends(require_scope("leads:write")), Depends(require_roles(["owner", "admin", "operator"]))])
@router.put("/contacts/{lead_id}", dependencies=[Depends(require_scope("leads:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def update_lead(
    lead_id: str,
    req: UpdateLeadRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT * FROM leads WHERE id = ? AND tenant_id = ?", (lead_id, tenant["id"]))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")

    now = datetime.now(timezone.utc).isoformat()
    fields = ["updated_at = ?"]
    params: List[Any] = [now]

    for col, val in {
        "name": req.name,
        "email": req.email,
        "city": req.city,
        "vertical": req.vertical,
        "lead_status": req.lead_status,
        "status": req.status,
        "call_category": req.call_category,
        "follow_up_at": req.follow_up_at,
        "callback_at": req.callback_at,
        "notes": req.notes,
    }.items():
        if val is not None:
            fields.append(f"{col} = ?")
            params.append(val)

    if req.tags is not None:
        fields.append("tags_json = ?")
        params.append(json.dumps(req.tags))
    if req.custom_fields is not None:
        fields.append("custom_fields_json = ?")
        params.append(json.dumps(req.custom_fields))
    if req.lead_status == "do_not_call":
        ComplianceService.add_dnc(db, tenant["id"], existing["phone"], reason="Marked Do Not Call in CRM", source="crm")

    params.extend([lead_id, tenant["id"]])
    cur.execute(f"UPDATE leads SET {', '.join(fields)} WHERE id = ? AND tenant_id = ?", params)
    db.commit()
    cur.execute("SELECT * FROM leads WHERE id = ?", (lead_id,))
    return {"status": "success", "lead": _serialize_lead(cur.fetchone())}


@router.delete("/leads/{lead_id}", dependencies=[Depends(require_scope("leads:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def delete_lead(
    lead_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("DELETE FROM leads WHERE id = ? AND tenant_id = ?", (lead_id, tenant["id"]))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.commit()
    return {"status": "deleted", "lead_id": lead_id}


@router.post("/leads/upload", dependencies=[Depends(require_scope("leads:write")), Depends(require_roles(["owner", "admin", "operator"]))])
async def upload_leads_csv(
    file: UploadFile = File(...),
    column_mapping: Optional[str] = Form(None),
    consent_confirmed: bool = Form(False),
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    """
    Ingest CSV file with row-level validation and optional explicit column mapping JSON.
    Never defaults missing phone numbers to fake numbers.
    """
    filename = file.filename or "upload.csv"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("csv", "txt"):
        raise HTTPException(status_code=400, detail="Only .csv or .txt lead files are supported")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded CSV file is empty")
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="CSV file exceeds maximum allowed size of 10 MB")

    parsed_mapping = None
    if column_mapping:
        try:
            parsed_mapping = json.loads(column_mapping)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="column_mapping must be valid JSON")

    try:
        decoded = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = contents.decode("latin-1", errors="ignore")

    return LeadService.validate_and_import_csv(
        conn=db,
        tenant_id=tenant["id"],
        csv_text=decoded,
        filename=filename,
        column_mapping=parsed_mapping,
        consent_confirmed=consent_confirmed,
    )


@router.post("/leads/bulk-paste", dependencies=[Depends(require_scope("leads:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def bulk_paste_contacts(
    req: BulkPasteContactsRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    now = datetime.now(timezone.utc).isoformat()
    imported = 0
    rejected = 0
    errors: List[Dict[str, Any]] = []
    imported_ids: List[str] = []

    for idx, item in enumerate(req.contacts, start=1):
        raw_phone = str(item.get("phone") or "").strip()
        raw_name = str(item.get("name") or "").strip()
        clean_phone = normalize_phone(raw_phone)
        digits = re.sub(r"[^\d]", "", clean_phone)
        if len(digits) < 10 or len(digits) > 15:
            rejected += 1
            errors.append({"row": idx, "phone": raw_phone, "reason": "Invalid phone number"})
            continue

        cur.execute("SELECT id FROM leads WHERE tenant_id = ? AND phone = ?", (tenant["id"], clean_phone))
        existing = cur.fetchone()
        if existing:
            rejected += 1
            errors.append({"row": idx, "phone": clean_phone, "reason": "Duplicate phone number"})
            continue

        lead_id = f"lead_{uuid.uuid4().hex[:8]}"
        known_keys = {"name", "phone", "email", "city", "vertical", "notes"}
        custom_fields = {k: v for k, v in item.items() if k not in known_keys}
        item_consent = str(item.get("consent_status") or "").strip().lower()
        resolved_consent = "opted_in" if (req.consent_confirmed or item_consent == "opted_in") else "pending"
        cur.execute("""
        INSERT INTO leads (
            id, tenant_id, name, phone, email, city, vertical, status, lead_status,
            source, consent_status, opt_out, custom_fields_json, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'new', ?, ?, 0, ?, ?, ?, ?)
        """, (
            lead_id, tenant["id"], raw_name or f"Contact {clean_phone[-4:]}", clean_phone,
            item.get("email"), item.get("city") or "Hyderabad", item.get("vertical") or "General",
            req.source, resolved_consent, json.dumps(custom_fields), item.get("notes"), now, now
        ))
        if resolved_consent == "opted_in":
            cur.execute(
                """
                INSERT INTO consent_records (id, tenant_id, lead_id, phone, consent_status, consent_source, consent_purpose, call_category, evidence_url_or_ref, recorded_at)
                VALUES (?, ?, ?, ?, 'opted_in', ?, 'outbound_contact', 'service', ?, ?)
                """,
                (f"con_{uuid.uuid4().hex[:8]}", tenant["id"], lead_id, clean_phone, "bulk_paste_confirmed", req.source, now),
            )
        imported += 1
        imported_ids.append(lead_id)

    list_id = None
    if req.list_name and imported_ids:
        list_id = f"lst_{uuid.uuid4().hex[:8]}"
        cur.execute(
            "INSERT INTO contact_lists (id, tenant_id, name, contact_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (list_id, tenant["id"], req.list_name.strip(), len(imported_ids), now, now),
        )
        for lid in imported_ids:
            cur.execute(
                "INSERT INTO contact_list_members (id, list_id, lead_id, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)",
                (f"clm_{uuid.uuid4().hex[:8]}", list_id, lid, tenant["id"], now),
            )

    db.commit()
    return {"status": "success", "imported_count": imported, "rejected_count": rejected, "errors": errors, "list_id": list_id, "lead_ids": imported_ids}


@router.post("/leads/{lead_id}/opt-out", dependencies=[Depends(require_scope("leads:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def toggle_opt_out(
    lead_id: str,
    opt_out: bool = True,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT id, phone FROM leads WHERE id = ? AND tenant_id = ?", (lead_id, tenant["id"]))
    lead = cur.fetchone()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    if opt_out:
        ComplianceService.add_dnc(db, tenant["id"], lead["phone"], reason="Opt-out via CRM", source="crm")
    else:
        cur.execute(
            "UPDATE leads SET opt_out = 0, consent_status = 'opted_in', lead_status = 'new' WHERE id = ? AND tenant_id = ?",
            (lead_id, tenant["id"])
        )
        cur.execute("DELETE FROM do_not_call_entries WHERE tenant_id = ? AND phone = ?", (tenant["id"], lead["phone"]))
        db.commit()

    return {"status": "opted_out" if opt_out else "opted_in", "success": True, "lead_id": lead_id, "opt_out": 1 if opt_out else 0}


@router.get("/contact-lists", dependencies=[Depends(require_scope("leads:read"))])
def list_contact_lists(
    list_type: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    q = "SELECT * FROM contact_lists WHERE tenant_id = ?"
    params: list = [tenant["id"]]
    if list_type:
        q += " AND list_type = ?"
        params.append(list_type)
    q += " ORDER BY created_at DESC"
    cur.execute(q, params)
    return {"lists": [dict(r) for r in cur.fetchall()]}


@router.post("/contact-lists", dependencies=[Depends(require_scope("leads:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def create_contact_list(
    req: CreateContactListRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    list_id = f"lst_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    lead_ids = list(req.lead_ids)

    # If raw phones supplied, resolve or create lead entries
    for raw_p in req.phones:
        norm = normalize_phone(raw_p)
        if len(re.sub(r"[^\d]", "", norm)) < 10:
            continue
        cur.execute("SELECT id FROM leads WHERE tenant_id = ? AND phone = ?", (tenant["id"], norm))
        ex = cur.fetchone()
        if ex:
            lid = ex["id"]
        else:
            lid = f"lead_{uuid.uuid4().hex[:8]}"
            list_consent = (
                "opted_out" if req.list_type == "suppression"
                else ("opted_in" if req.consent_confirmed else "pending")
            )
            cur.execute(
                """
                INSERT INTO leads (id, tenant_id, name, phone, city, vertical, status, lead_status, source, consent_status, opt_out, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'Hyderabad', 'General', 'pending', 'new', 'List Import', ?, ?, ?, ?)
                """,
                (lid, tenant["id"], f"Contact {norm[-4:]}", norm, list_consent, 1 if req.list_type == "suppression" else 0, now, now),
            )
            if list_consent == "opted_in":
                cur.execute(
                    """
                    INSERT INTO consent_records (id, tenant_id, lead_id, phone, consent_status, consent_source, consent_purpose, call_category, evidence_url_or_ref, recorded_at)
                    VALUES (?, ?, ?, ?, 'opted_in', 'contact_list_confirmed', 'outbound_contact', 'service', ?, ?)
                    """,
                    (f"con_{uuid.uuid4().hex[:8]}", tenant["id"], lid, norm, req.name.strip(), now),
                )
        if req.list_type == "suppression":
            ComplianceService.add_dnc(db, tenant["id"], norm, reason=f"Suppression list: {req.name}", source="suppression_list")
        if lid not in lead_ids:
            lead_ids.append(lid)

    cur.execute(
        "INSERT INTO contact_lists (id, tenant_id, name, list_type, description, contact_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (list_id, tenant["id"], req.name.strip(), req.list_type, req.description, len(lead_ids), now, now),
    )
    for lid in lead_ids:
        cur.execute(
            "INSERT INTO contact_list_members (id, list_id, lead_id, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)",
            (f"clm_{uuid.uuid4().hex[:8]}", list_id, lid, tenant["id"], now),
        )
    db.commit()
    return {"status": "created", "list_id": list_id, "contact_count": len(lead_ids), "list_type": req.list_type}


@router.delete("/contact-lists/{list_id}", dependencies=[Depends(require_scope("leads:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def delete_contact_list(
    list_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("DELETE FROM contact_lists WHERE id = ? AND tenant_id = ?", (list_id, tenant["id"]))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contact list not found")
    db.commit()
    return {"status": "deleted", "list_id": list_id}
