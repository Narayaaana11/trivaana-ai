"""
TRIVAANA AI: Platform Super Admin Panel Router
Isolated administration API for managing workspaces, tariffs, feature flags,
infrastructure monitoring, and system audit logs without exposing private customer transcripts.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
import sqlite3
from datetime import datetime, timezone

from database.connection import get_db
from core.dependencies import require_super_admin
from services.billing_service import BillingService
from services.audit_service import AuditService

router = APIRouter(prefix="/api/admin", tags=["Platform Super Admin"])


class UpdateTariffsRequest(BaseModel):
    standard_ai_call_paise_per_min: int
    premium_ai_call_paise_per_min: int
    broadcast_paise_per_call: int
    number_rental_paise_per_month: int
    channel_rental_paise_per_month: int
    rounding_increment_seconds: int = 30
    gst_percentage: float = 18.0


class UpdateFeatureFlagRequest(BaseModel):
    enabled: bool
    description: Optional[str] = None


@router.get("/overview")
def admin_platform_overview(
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT COUNT(*) as total, COUNT(CASE WHEN status='active' THEN 1 END) as active, COUNT(CASE WHEN status='suspended' THEN 1 END) as suspended FROM tenants")
    t_stats = dict(cur.fetchone())
    cur.execute("SELECT COUNT(*) as total_users FROM users")
    u_count = cur.fetchone()["total_users"]
    cur.execute("SELECT COUNT(*) as total_calls, COUNT(CASE WHEN status='failed' THEN 1 END) as failed_calls, COALESCE(SUM(duration_seconds),0) as total_duration_sec FROM calls")
    c_stats = dict(cur.fetchone())
    cur.execute("SELECT COUNT(*) as unresolved_errors FROM system_errors WHERE resolved = 0")
    err_cnt = cur.fetchone()["unresolved_errors"]

    return {
        "workspaces": t_stats,
        "total_users": u_count,
        "calls": c_stats,
        "unresolved_errors": err_cnt,
        "pricing_catalog": BillingService.get_pricing_catalog(db),
    }


@router.get("/workspaces")
def admin_list_workspaces(
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("""
    SELECT t.id, t.name, t.plan, t.concurrency_limit, t.wallet_balance_paise, t.status, t.is_demo, t.created_at,
           (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count,
           (SELECT COUNT(*) FROM agents a WHERE a.tenant_id = t.id) as agent_count,
           (SELECT COUNT(*) FROM calls c WHERE c.tenant_id = t.id) as call_count
    FROM tenants t
    ORDER BY t.created_at DESC
    """)
    return {"workspaces": [dict(r) for r in cur.fetchall()]}


@router.post("/workspaces/{tenant_id}/suspend")
def admin_suspend_workspace(
    tenant_id: str,
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("UPDATE tenants SET status = 'suspended' WHERE id = ?", (tenant_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Workspace not found")
    AuditService.log_event(
        db,
        action="admin.workspace_suspended",
        resource_type="tenant",
        resource_id=tenant_id,
        actor_user_id=admin_user["id"],
        actor_email=admin_user.get("email"),
        commit=True,
    )
    return {"status": "suspended", "tenant_id": tenant_id}


@router.post("/workspaces/{tenant_id}/activate")
def admin_activate_workspace(
    tenant_id: str,
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("UPDATE tenants SET status = 'active' WHERE id = ?", (tenant_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Workspace not found")
    AuditService.log_event(
        db,
        action="admin.workspace_activated",
        resource_type="tenant",
        resource_id=tenant_id,
        actor_user_id=admin_user["id"],
        actor_email=admin_user.get("email"),
        commit=True,
    )
    return {"status": "active", "tenant_id": tenant_id}


@router.get("/users")
def admin_list_users(
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("""
    SELECT u.id, u.tenant_id, u.email, u.full_name, u.role, u.email_verified, u.is_super_admin, u.last_login_at, u.created_at,
           t.name as workspace_name
    FROM users u
    LEFT JOIN tenants t ON u.tenant_id = t.id
    ORDER BY u.created_at DESC LIMIT 200
    """)
    return {"users": [dict(r) for r in cur.fetchall()]}


@router.get("/settings")
def admin_get_settings(
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    return {"pricing_catalog": BillingService.get_pricing_catalog(db)}


@router.put("/settings/tariffs")
def admin_update_tariffs(
    req: UpdateTariffsRequest,
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO platform_settings (key, value_json, description, updated_by, updated_at)
        VALUES ('commercial_tariffs', ?, 'Platform commercial call, number & channel tariffs', ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value_json = excluded.value_json,
            description = excluded.description,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        """,
        (json.dumps(req.model_dump()), admin_user["id"], now),
    )
    AuditService.log_event(
        db,
        action="admin.tariffs_updated",
        resource_type="platform_settings",
        resource_id="commercial_tariffs",
        actor_user_id=admin_user["id"],
        metadata=req.model_dump(),
        commit=True,
    )
    return {"status": "updated", "pricing_catalog": BillingService.get_pricing_catalog(db)}


@router.get("/feature-flags")
def admin_list_feature_flags(
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM feature_flags ORDER BY key ASC")
    flags = [dict(r) for r in cur.fetchall()]
    for f in flags:
        f["enabled"] = bool(f["enabled"])
    return {"feature_flags": flags}


@router.put("/feature-flags/{flag_key}")
def admin_update_feature_flag(
    flag_key: str,
    req: UpdateFeatureFlagRequest,
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO feature_flags (key, enabled, description, updated_at)
        VALUES (?, ?, COALESCE(?, (SELECT description FROM feature_flags WHERE key = ?)), ?)
        ON CONFLICT(key) DO UPDATE SET
            enabled = excluded.enabled,
            description = COALESCE(excluded.description, feature_flags.description),
            updated_at = excluded.updated_at
        """,
        (flag_key, 1 if req.enabled else 0, req.description, flag_key, now),
    )
    db.commit()
    return {"status": "updated", "key": flag_key, "enabled": req.enabled}


@router.get("/failed-calls")
def admin_list_failed_calls(
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """Privacy-preserving failed call diagnostics (omits private customer transcript text)."""
    cur = db.cursor()
    cur.execute("""
    SELECT id, tenant_id, provider, status, outcome, language, is_sandbox, created_at
    FROM calls WHERE status = 'failed' ORDER BY created_at DESC LIMIT 100
    """)
    return {"failed_calls": [dict(r) for r in cur.fetchall()]}


@router.get("/system-errors")
def admin_list_system_errors(
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM system_errors ORDER BY created_at DESC LIMIT 100")
    return {"errors": [dict(r) for r in cur.fetchall()]}


@router.get("/audit-logs")
def admin_list_audit_logs(
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200")
    logs = []
    for r in cur.fetchall():
        d = dict(r)
        d["metadata"] = json.loads(d.pop("metadata_json", "{}") or "{}")
        logs.append(d)
    return {"audit_logs": logs}


@router.get("/finance/summary")
def admin_finance_summary(
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """Separate Prepaid Wallet Liabilities, Earned Usage Revenue, Promotional Credits, and Provider COGS."""
    cur = db.cursor()
    cur.execute("SELECT COALESCE(SUM(wallet_balance_paise), 0) as total_liabilities_paise FROM tenants")
    liabilities = cur.fetchone()["total_liabilities_paise"]

    cur.execute("SELECT COALESCE(SUM(amount_paise), 0) as earned_usage_paise FROM transactions WHERE type = 'debit'")
    earned_usage = cur.fetchone()["earned_usage_paise"]

    cur.execute("SELECT COALESCE(SUM(amount_paise), 0) as purchased_credits_paise FROM transactions WHERE type = 'credit' AND invoice_id IS NOT NULL")
    purchased = cur.fetchone()["purchased_credits_paise"]

    cur.execute("SELECT COALESCE(SUM(amount_paise), 0) as promo_paise FROM promo_credits")
    promo = cur.fetchone()["promo_paise"]

    cur.execute("SELECT COALESCE(SUM(estimated_cost_paise), 0) as cogs_paise FROM provider_usage_costs")
    cogs = cur.fetchone()["cogs_paise"]

    return {
        "wallet_liabilities_paise": liabilities,
        "purchased_credits_paise": purchased,
        "earned_usage_revenue_paise": earned_usage,
        "promotional_credits_paise": promo,
        "provider_cogs_paise": cogs,
        "gross_margin_paise": earned_usage - cogs,
    }


@router.get("/providers/health")
def admin_providers_health(admin_user: dict = Depends(require_super_admin)):
    from core.config import settings
    return {
        "ai_llm": {"gemini": settings.has_gemini, "openai": settings.has_openai},
        "voice": {"sarvam": settings.has_sarvam, "elevenlabs": settings.has_elevenlabs, "livekit": settings.has_livekit},
        "telephony": {"exotel": settings.has_exotel, "twilio": settings.has_twilio, "plivo": settings.has_plivo, "vobiz": settings.has_vobiz},
        "payments": {"razorpay": settings.has_razorpay},
        "infra": {"postgres": settings.has_postgres, "redis": settings.has_redis, "s3": settings.has_s3_storage, "temporal": settings.has_temporal, "langfuse": settings.has_langfuse},
    }


class KillSwitchRequest(BaseModel):
    outbound_paused: bool
    reason: str = "Emergency maintenance"


@router.post("/emergency/kill-switch")
def admin_emergency_kill_switch(
    req: KillSwitchRequest,
    admin_user: dict = Depends(require_super_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO platform_settings (key, value_json, updated_by, updated_at)
        VALUES ('emergency_outbound_pause', ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at
        """,
        (json.dumps({"paused": req.outbound_paused, "reason": req.reason}), admin_user["id"], now),
    )
    AuditService.log_event(
        db,
        action="admin.emergency_kill_switch",
        resource_type="platform",
        actor_user_id=admin_user["id"],
        actor_email=admin_user.get("email"),
        metadata={"outbound_paused": req.outbound_paused, "reason": req.reason},
        commit=True,
    )
    return {"status": "updated", "outbound_paused": req.outbound_paused, "reason": req.reason}

