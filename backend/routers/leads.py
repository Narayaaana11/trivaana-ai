"""
TRIVAANA AI: Lead Management, CSV Ingestion & Truthful Discovery Router
Enforces tenant scoping, E.164 phone validation, row-by-row error reporting, and opt-out compliance.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from pydantic import BaseModel
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from database.connection import get_db
from core.dependencies import get_current_tenant
from services.lead_service import LeadService
from services.call_service import normalize_phone

router = APIRouter(prefix="/api/leads", tags=["Leads & Contacts"])

class CreateLeadRequest(BaseModel):
    name: str
    phone: str
    city: Optional[str] = "Hyderabad"
    vertical: Optional[str] = "Real Estate"
    notes: Optional[str] = None

@router.get("")
def list_leads(
    search: Optional[str] = None,
    status: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    query = "SELECT * FROM leads WHERE tenant_id = ?"
    params = [tenant["id"]]

    if search:
        query += " AND (name LIKE ? OR phone LIKE ? OR city LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    if status and status != "all":
        query += " AND status = ?"
        params.append(status)

    query += " ORDER BY created_at DESC LIMIT 500"
    cur.execute(query, params)
    leads = [dict(r) for r in cur.fetchall()]
    return {"leads": leads, "count": len(leads)}

@router.post("")
def create_lead(
    req: CreateLeadRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    clean_phone = normalize_phone(req.phone)
    if len(clean_phone) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid phone number: '{req.phone}'. Must be at least 10 digits."
        )

    cur = db.cursor()
    # Check duplicate
    cur.execute("SELECT id FROM leads WHERE tenant_id = ? AND phone = ?", (tenant["id"], clean_phone))
    if cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A contact with phone number '{clean_phone}' already exists in your workspace."
        )

    lead_id = f"lead_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    cur.execute("""
    INSERT INTO leads (id, tenant_id, name, phone, city, vertical, status, source, consent_status, opt_out, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', 'Manual Entry', 'opted_in', 0, ?, ?)
    """, (lead_id, tenant["id"], req.name.strip(), clean_phone, req.city, req.vertical, req.notes, now))
    db.commit()

    lead_obj = {
        "id": lead_id,
        "tenant_id": tenant["id"],
        "name": req.name.strip(),
        "phone": clean_phone,
        "city": req.city,
        "vertical": req.vertical,
        "status": "pending",
        "source": "Manual Entry",
        "consent_status": "opted_in",
        "opt_out": 0,
        "notes": req.notes,
        "created_at": now
    }
    return {"status": "success", "lead_id": lead_id, "phone": clean_phone, "lead": lead_obj}

@router.post("/upload")
async def upload_leads_csv(
    file: UploadFile = File(...),
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    """
    Ingest CSV file with row-level validation.
    Never defaults missing phone numbers to fake numbers.
    """
    contents = await file.read()
    try:
        decoded = contents.decode("utf-8-sig")  # Handles UTF-8 with BOM cleanly
    except UnicodeDecodeError:
        decoded = contents.decode("latin-1", errors="ignore")

    result = LeadService.validate_and_import_csv(
        conn=db,
        tenant_id=tenant["id"],
        csv_text=decoded,
        filename=file.filename or "upload.csv"
    )
    return result

@router.get("/discover")
def discover_leads(
    city: str = "Hyderabad",
    vertical: str = "Real Estate",
    limit: int = 15,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    """
    Truthful Lead Scout endpoint:
    Returns 'not_configured' status when external provider is missing,
    rather than fabricating random names and synthetic phone numbers.
    """
    return LeadService.discover_leads_scout(
        conn=db,
        tenant_id=tenant["id"],
        city=city,
        vertical=vertical,
        limit=limit
    )

@router.post("/{lead_id}/opt-out")
def toggle_opt_out(
    lead_id: str,
    opt_out: bool = True,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT id FROM leads WHERE id = ? AND tenant_id = ?", (lead_id, tenant["id"]))
    if not cur.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    cur.execute("""
    UPDATE leads
    SET opt_out = ?, consent_status = ?
    WHERE id = ? AND tenant_id = ?
    """, (1 if opt_out else 0, "opted_out" if opt_out else "opted_in", lead_id, tenant["id"]))
    db.commit()

    return {"status": "opted_out" if opt_out else "opted_in", "success": True, "lead_id": lead_id, "opt_out": 1 if opt_out else 0}
