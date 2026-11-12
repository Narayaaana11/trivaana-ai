"""
TRIVAANA AI: Phone Numbers & Concurrent Channel Management Router
Separates phone number provisioning/KYC/routing from concurrent calling channel capacity.
Never fabricates live carrier number provisioning when provider credentials are absent.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional
import json
import sqlite3
import uuid
from datetime import datetime, timezone

from database.connection import get_db
from core.dependencies import get_current_tenant, require_roles, require_scope
from core.config import settings

router = APIRouter(prefix="/api", tags=["Phone Numbers & Channels"])


class ProvisionNumberRequest(BaseModel):
    phone_number: Optional[str] = None
    provider: str = "exotel"
    compliance_category: str = "service_140_160"  # 'service_140_160', 'promotional_140', 'transactional', 'sandbox_virtual'
    caller_id: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    inbound_agent_id: Optional[str] = None
    channel_count: int = Field(2, ge=1, le=100)


class UpdateNumberRequest(BaseModel):
    assigned_agent_id: Optional[str] = None
    inbound_agent_id: Optional[str] = None
    caller_id: Optional[str] = None
    kyc_status: Optional[str] = None
    status: Optional[str] = None
    after_hours_mode: Optional[str] = None
    business_hours: Optional[Dict[str, Any]] = None


class CreateChannelPoolRequest(BaseModel):
    phone_number_id: Optional[str] = None
    provider: str = "exotel"
    channel_capacity: int = Field(5, ge=1, le=200)


@router.get("/phone-numbers", dependencies=[Depends(require_scope("phone_numbers:read"))])
def list_phone_numbers(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute(
        """
        SELECT p.*, a.name as assigned_agent_name, ia.name as inbound_agent_name
        FROM phone_numbers p
        LEFT JOIN agents a ON p.assigned_agent_id = a.id
        LEFT JOIN agents ia ON p.inbound_agent_id = ia.id
        WHERE p.tenant_id = ?
        ORDER BY p.created_at DESC
        """,
        (tenant["id"],),
    )
    numbers = []
    for r in cur.fetchall():
        d = dict(r)
        d["business_hours"] = json.loads(d.pop("business_hours_json", '{"start":"09:00","end":"20:00"}') or "{}")
        numbers.append(d)

    cur.execute("SELECT * FROM calling_channels WHERE tenant_id = ?", (tenant["id"],))
    channels = [dict(r) for r in cur.fetchall()]

    return {
        "phone_numbers": numbers,
        "channels": channels,
        "provider_status": {
            "exotel_configured": settings.has_exotel,
            "twilio_configured": settings.has_twilio,
            "plivo_configured": settings.has_plivo,
            "vobiz_configured": settings.has_vobiz,
            "livekit_sip_configured": bool(settings.LIVEKIT_SIP_CONFIG),
        },
    }


@router.post("/phone-numbers", dependencies=[Depends(require_scope("phone_numbers:write")), Depends(require_roles(["owner", "admin"]))])
def request_or_connect_phone_number(
    req: ProvisionNumberRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles(["owner", "admin"])),
    db: sqlite3.Connection = Depends(get_db),
):
    provider = req.provider.lower()
    provider_ready = (
        (provider == "exotel" and settings.has_exotel)
        or (provider == "twilio" and settings.has_twilio)
        or (provider == "plivo" and settings.has_plivo)
        or (provider == "vobiz" and settings.has_vobiz)
    )

    if not provider_ready and not req.phone_number:
        return {
            "status": "kyc_and_provider_required",
            "provisioned": False,
            "provider": provider,
            "message": f"Cannot auto-provision a live {provider.title()} number without configured provider credentials and completed KYC. Connect a verified number or configure {provider.upper()} credentials first.",
        }

    if not req.phone_number:
        return {
            "status": "provisioning_requested",
            "provisioned": False,
            "provider": provider,
            "message": "Carrier number purchase requires KYC verification and explicit number selection from carrier inventory.",
        }

    num_id = f"num_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    # Require explicit KYC/staff review or carrier ownership proof rather than self-approving arbitrary numbers
    kyc_status = "pending_review" if provider_ready else "not_submitted"
    num_status = "pending_kyc"
    cfg_err = (
        "Submitted for carrier ownership / KYC verification."
        if provider_ready
        else f"{provider.title()} credentials not configured; number registered in pending KYC state."
    )

    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO phone_numbers (
            id, tenant_id, phone_number, caller_id, provider, status, kyc_status,
            compliance_category, monthly_rental_paise, assigned_agent_id, inbound_agent_id,
            channel_count, config_error, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            num_id, tenant["id"], req.phone_number.strip(), req.caller_id or req.phone_number.strip(),
            provider, num_status, kyc_status, req.compliance_category,
            settings.NUMBER_RENTAL_PAISE_PER_MONTH, req.assigned_agent_id, req.inbound_agent_id,
            req.channel_count, cfg_err, now,
        ),
    )

    ch_id = f"chn_{uuid.uuid4().hex[:8]}"
    cur.execute(
        """
        INSERT INTO calling_channels (id, tenant_id, phone_number_id, provider, channel_capacity, monthly_rental_paise, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
        """,
        (ch_id, tenant["id"], num_id, provider, req.channel_count, settings.CHANNEL_RENTAL_PAISE_PER_MONTH, now, now),
    )
    db.commit()

    return {
        "status": num_status,
        "number_id": num_id,
        "channel_id": ch_id,
        "kyc_status": kyc_status,
        "config_error": cfg_err,
    }


@router.put("/phone-numbers/{number_id}", dependencies=[Depends(require_scope("phone_numbers:write")), Depends(require_roles(["owner", "admin"]))])
def update_phone_number(
    number_id: str,
    req: UpdateNumberRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles(["owner", "admin"])),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM phone_numbers WHERE id = ? AND tenant_id = ?", (number_id, tenant["id"]))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Phone number not found")

    if req.kyc_status is not None and not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Only platform compliance or Super Admin can modify KYC status")

    fields = []
    params: list = []
    if req.assigned_agent_id is not None:
        fields.append("assigned_agent_id = ?")
        params.append(req.assigned_agent_id)
    if req.inbound_agent_id is not None:
        fields.append("inbound_agent_id = ?")
        params.append(req.inbound_agent_id)
    if req.caller_id is not None:
        fields.append("caller_id = ?")
        params.append(req.caller_id)
    if req.kyc_status is not None:
        fields.append("kyc_status = ?")
        params.append(req.kyc_status)
    if req.status is not None:
        fields.append("status = ?")
        params.append(req.status)
    if req.after_hours_mode is not None:
        fields.append("after_hours_mode = ?")
        params.append(req.after_hours_mode)
    if req.business_hours is not None:
        fields.append("business_hours_json = ?")
        params.append(json.dumps(req.business_hours))

    if fields:
        params.extend([number_id, tenant["id"]])
        cur.execute(f"UPDATE phone_numbers SET {', '.join(fields)} WHERE id = ? AND tenant_id = ?", params)
        db.commit()

    return {"status": "updated", "number_id": number_id}


@router.post("/channels", dependencies=[Depends(require_scope("phone_numbers:write")), Depends(require_roles(["owner", "admin"]))])
def add_calling_channels(
    req: CreateChannelPoolRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles(["owner", "admin"])),
    db: sqlite3.Connection = Depends(get_db),
):
    now = datetime.now(timezone.utc).isoformat()
    ch_id = f"chn_{uuid.uuid4().hex[:8]}"
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO calling_channels (id, tenant_id, phone_number_id, provider, channel_capacity, monthly_rental_paise, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
        """,
        (ch_id, tenant["id"], req.phone_number_id, req.provider, req.channel_capacity, settings.CHANNEL_RENTAL_PAISE_PER_MONTH, now, now),
    )
    db.commit()
    return {"status": "created", "channel_id": ch_id, "channel_capacity": req.channel_capacity}


@router.delete("/channels/{channel_id}")
def remove_calling_channel(
    channel_id: str,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles(["owner", "admin"])),
    _scope: dict = Depends(require_scope("phone_numbers:write")),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("DELETE FROM calling_channels WHERE id = ? AND tenant_id = ?", (channel_id, tenant["id"]))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Channel pool not found")
    db.commit()
    return {"status": "deleted", "channel_id": channel_id}


@router.post("/phone-numbers/verify", dependencies=[Depends(require_scope("phone_numbers:write")), Depends(require_roles(["owner", "admin"]))])
def verify_carrier_numbers(
    provider: str = "exotel",
    tenant: dict = Depends(get_current_tenant),
):
    """Sync & verify owned numbers from configured Exotel/Plivo carrier APIs."""
    prov = provider.lower()
    if prov == "exotel":
        from providers.exotel_adapter import ExotelTelephonyProvider
        return {"provider": "exotel", **ExotelTelephonyProvider().verify_phone_numbers()}
    if prov == "plivo":
        from providers.plivo_adapter import PlivoTelephonyProvider
        return {"provider": "plivo", **PlivoTelephonyProvider().verify_phone_numbers()}
    return {"provider": prov, "verified": False, "numbers": [], "error": f"Live number sync not supported for {prov}"}

