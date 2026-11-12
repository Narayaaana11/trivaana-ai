"""
TRIVAANA AI: Workspace Settings, Team Members, API Keys & Notifications Router
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from typing import Optional, List
import sqlite3
import uuid
import json
from datetime import datetime, timezone

from database.connection import get_db
from core.dependencies import get_current_tenant, require_roles, require_scope, ROLE_HIERARCHY
from core.security import hash_api_key
from services.audit_service import AuditService
from services.storage_service import StorageService

router = APIRouter(prefix="/api", tags=["Workspaces & Settings"])

VALID_ROLES = {"owner", "admin", "manager", "operator", "viewer"}


class UpdateWorkspaceRequest(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None
    billing_email: Optional[str] = None
    low_balance_threshold_paise: Optional[int] = Field(None, ge=0)


class InviteMemberRequest(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = "operator"


class UpdateMemberRoleRequest(BaseModel):
    role: str
    status: Optional[str] = None


class CreateApiKeyRequest(BaseModel):
    name: str
    scopes: List[str] = ["*"]


@router.get("/workspaces/current", dependencies=[Depends(require_scope("workspace:read"))])
def get_workspace(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT COUNT(*) as cnt FROM workspace_members WHERE tenant_id = ?", (tenant["id"],))
    member_count = cur.fetchone()["cnt"]
    return {
        "id": tenant["id"],
        "name": tenant["name"],
        "plan": tenant["plan"],
        "concurrency_limit": tenant["concurrency_limit"],
        "status": tenant.get("status", "active"),
        "gstin": tenant.get("gstin") or "",
        "billing_email": tenant.get("billing_email") or "",
        "low_balance_threshold_paise": tenant.get("low_balance_threshold_paise", 50000),
        "wallet_balance_paise": tenant["wallet_balance_paise"],
        "wallet_balance_inr": tenant["wallet_balance_paise"] / 100.0,
        "member_count": member_count,
        "created_at": tenant["created_at"],
    }


@router.put("/workspaces/current", dependencies=[Depends(require_scope("workspace:write"))])
def update_workspace(
    req: UpdateWorkspaceRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles(["owner", "admin"])),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    fields = []
    params = []
    if req.name is not None:
        fields.append("name = ?")
        params.append(req.name.strip())
    if req.gstin is not None:
        fields.append("gstin = ?")
        params.append(req.gstin.strip().upper())
    if req.billing_email is not None:
        fields.append("billing_email = ?")
        params.append(req.billing_email.strip().lower())
    if req.low_balance_threshold_paise is not None:
        fields.append("low_balance_threshold_paise = ?")
        params.append(req.low_balance_threshold_paise)

    if fields:
        params.append(tenant["id"])
        cur.execute(f"UPDATE tenants SET {', '.join(fields)} WHERE id = ?", params)
        AuditService.log_event(
            db,
            action="workspace.updated",
            resource_type="tenant",
            resource_id=tenant["id"],
            tenant_id=tenant["id"],
            actor_user_id=current_user["id"],
            actor_email=current_user["email"],
            metadata=req.model_dump(exclude_none=True),
        )
        db.commit()

    return {"status": "success", "message": "Workspace settings updated"}


@router.get("/workspaces/members", dependencies=[Depends(require_scope("workspace:read"))])
def list_members(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute(
        "SELECT id, tenant_id, user_id, email, full_name, role, status, created_at, updated_at FROM workspace_members WHERE tenant_id = ? ORDER BY created_at ASC",
        (tenant["id"],)
    )
    members = [dict(r) for r in cur.fetchall()]
    return {"members": members, "count": len(members)}


@router.post("/workspaces/members/invite", dependencies=[Depends(require_scope("workspace:write"))])
def invite_member(
    req: InviteMemberRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles(["owner", "admin", "manager"])),
    db: sqlite3.Connection = Depends(get_db)
):
    role = req.role.lower()
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{req.role}'. Allowed: {', '.join(sorted(VALID_ROLES))}")

    actor_role = (current_user.get("role") or "viewer").lower()
    if not current_user.get("is_super_admin") and ROLE_HIERARCHY.get(role, 0) > ROLE_HIERARCHY.get(actor_role, 0):
        raise HTTPException(status_code=403, detail=f"Cannot invite a member with higher privilege ('{role}') than your own role ('{actor_role}')")

    email = req.email.strip().lower()
    cur = db.cursor()
    cur.execute("SELECT id FROM workspace_members WHERE tenant_id = ? AND LOWER(email) = ?", (tenant["id"], email))
    if cur.fetchone():
        raise HTTPException(status_code=409, detail="Member already exists or is invited in this workspace")

    now = datetime.now(timezone.utc).isoformat()
    member_id = f"mem_{uuid.uuid4().hex[:8]}"
    invite_token = f"inv_{uuid.uuid4().hex[:16]}"
    cur.execute("""
    INSERT INTO workspace_members (id, tenant_id, user_id, email, full_name, role, status, invite_token, invited_by, created_at, updated_at)
    VALUES (?, ?, NULL, ?, ?, ?, 'invited', ?, ?, ?, ?)
    """, (member_id, tenant["id"], email, req.full_name or email.split("@")[0], role, invite_token, current_user["id"], now, now))

    AuditService.log_event(
        db,
        action="member.invited",
        resource_type="workspace_member",
        resource_id=member_id,
        tenant_id=tenant["id"],
        actor_user_id=current_user["id"],
        actor_email=current_user["email"],
        metadata={"invited_email": email, "role": role},
    )
    db.commit()

    return {
        "status": "invited",
        "member_id": member_id,
        "email": email,
        "role": role,
        "invite_token": invite_token,
    }


@router.put("/workspaces/members/{member_id}", dependencies=[Depends(require_scope("workspace:write"))])
def update_member_role(
    member_id: str,
    req: UpdateMemberRoleRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles(["owner", "admin"])),
    db: sqlite3.Connection = Depends(get_db)
):
    role = req.role.lower()
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{req.role}'")
    next_status = req.status.lower() if req.status else None
    if next_status is not None and next_status not in ("active", "suspended"):
        raise HTTPException(status_code=400, detail=f"Invalid status '{req.status}'")

    cur = db.cursor()
    cur.execute("SELECT * FROM workspace_members WHERE id = ? AND tenant_id = ?", (member_id, tenant["id"]))
    member = cur.fetchone()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    actor_role = (current_user.get("role") or "").lower()
    if member["role"] == "owner" and actor_role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owner can modify owner role")
    if member["role"] == "admin" and actor_role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owner can modify another admin")
    if role == "owner" and actor_role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owner can grant owner role")

    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "UPDATE workspace_members SET role = ?, status = COALESCE(?, status), updated_at = ? WHERE id = ? AND tenant_id = ?",
        (role, next_status, now, member_id, tenant["id"])
    )
    if member["user_id"]:
        cur.execute(
            "UPDATE users SET role = ?, status = COALESCE(?, status), token_version = COALESCE(token_version, 1) + 1 WHERE id = ? AND tenant_id = ?",
            (role, next_status, member["user_id"], tenant["id"]),
        )
    db.commit()
    return {"status": "success", "member_id": member_id, "role": role}


@router.delete("/workspaces/members/{member_id}", dependencies=[Depends(require_scope("workspace:write"))])
def remove_member(
    member_id: str,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles(["owner", "admin"])),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT * FROM workspace_members WHERE id = ? AND tenant_id = ?", (member_id, tenant["id"]))
    member = cur.fetchone()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member["role"] == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove workspace owner")
    if member["role"] == "admin" and (current_user.get("role") or "").lower() != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owner can remove an admin")
    if member["user_id"] and member["user_id"] == current_user.get("id"):
        raise HTTPException(status_code=400, detail="Cannot remove yourself from workspace")

    if member["user_id"]:
        cur.execute(
            "UPDATE users SET status = 'suspended', token_version = COALESCE(token_version, 1) + 1 WHERE id = ? AND tenant_id = ?",
            (member["user_id"], tenant["id"]),
        )
    cur.execute("DELETE FROM workspace_members WHERE id = ? AND tenant_id = ?", (member_id, tenant["id"]))
    db.commit()
    return {"status": "removed", "member_id": member_id}


@router.get("/workspaces/api-keys", dependencies=[Depends(require_scope("workspace:read")), Depends(require_roles(["owner", "admin"]))])
def list_api_keys(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute(
        "SELECT id, name, key_prefix, scopes_json, last_used_at, revoked_at, created_at FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC",
        (tenant["id"],)
    )
    keys = []
    for r in cur.fetchall():
        d = dict(r)
        d["scopes"] = json.loads(d.pop("scopes_json", '["*"]'))
        keys.append(d)
    return {"api_keys": keys, "count": len(keys)}


@router.post("/workspaces/api-keys", dependencies=[Depends(require_scope("workspace:write"))])
def create_api_key(
    req: CreateApiKeyRequest,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles(["owner", "admin"])),
    db: sqlite3.Connection = Depends(get_db)
):
    raw_key = f"trv_live_{uuid.uuid4().hex}"
    key_id = f"key_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    cur = db.cursor()
    cur.execute("""
    INSERT INTO api_keys (id, tenant_id, name, key_prefix, key_hash, scopes_json, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (key_id, tenant["id"], req.name.strip(), raw_key[:12], hash_api_key(raw_key), json.dumps(req.scopes), current_user["id"], now))

    AuditService.log_event(
        db,
        action="api_key.created",
        resource_type="api_key",
        resource_id=key_id,
        tenant_id=tenant["id"],
        actor_user_id=current_user["id"],
        actor_email=current_user["email"],
        metadata={"name": req.name},
    )
    db.commit()

    return {
        "status": "success",
        "key_id": key_id,
        "name": req.name,
        "api_key": raw_key,  # Shown once upon creation
        "key_prefix": raw_key[:12],
    }


@router.delete("/workspaces/api-keys/{key_id}", dependencies=[Depends(require_scope("workspace:write"))])
def revoke_api_key(
    key_id: str,
    tenant: dict = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles(["owner", "admin"])),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL",
        (now, key_id, tenant["id"])
    )
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Active API key not found")
    db.commit()
    return {"status": "revoked", "key_id": key_id}


@router.get("/notifications", dependencies=[Depends(require_scope("workspace:read"))])
def list_notifications(
    unread_only: bool = False,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    q = "SELECT * FROM notifications WHERE tenant_id = ?"
    params = [tenant["id"]]
    if unread_only:
        q += " AND is_read = 0"
    q += " ORDER BY created_at DESC LIMIT 100"
    cur.execute(q, params)
    items = [dict(r) for r in cur.fetchall()]
    unread_count = sum(1 for i in items if not i["is_read"])
    return {"notifications": items, "unread_count": unread_count}


@router.post("/notifications/{notif_id}/read", dependencies=[Depends(require_scope("workspace:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def mark_notification_read(
    notif_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ?", (notif_id, tenant["id"]))
    db.commit()
    return {"status": "read", "notification_id": notif_id}


@router.post("/notifications/read-all", dependencies=[Depends(require_scope("workspace:write")), Depends(require_roles(["owner", "admin", "operator"]))])
def mark_all_notifications_read(
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("UPDATE notifications SET is_read = 1 WHERE tenant_id = ?", (tenant["id"],))
    db.commit()
    return {"status": "all_read"}


@router.get("/audit-logs", dependencies=[Depends(require_scope("workspace:read")), Depends(require_roles(["owner", "admin"]))])
def list_tenant_audit_logs(
    limit: int = 100,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute(
        "SELECT * FROM audit_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?",
        (tenant["id"], min(limit, 500))
    )
    logs = []
    for r in cur.fetchall():
        d = dict(r)
        d["metadata"] = json.loads(d.pop("metadata_json", "{}") or "{}")
        logs.append(d)
    return {"audit_logs": logs, "count": len(logs)}


@router.get("/media/{storage_key:path}", dependencies=[Depends(require_scope("workspace:read"))])
def get_tenant_media_file(
    storage_key: str,
    tenant: dict = Depends(get_current_tenant),
):
    if ".." in storage_key or "\\" in storage_key or storage_key.startswith("/") or not storage_key.startswith(f"{tenant['id']}/"):
        raise HTTPException(status_code=403, detail="Access denied: media belongs to another tenant")
    data = StorageService.read_local_file(storage_key, tenant_id=tenant["id"])
    if data is None:
        raise HTTPException(status_code=404, detail="Media object not found")
    media_type = "audio/mpeg" if storage_key.lower().endswith(".mp3") else "application/octet-stream"
    return Response(content=data, media_type=media_type)

