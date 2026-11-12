"""
TRIVAANA AI: Authentication, RBAC & Multi-Tenant Dependency Guards
Enforces server-side authentication, role authorization, workspace suspension checks, and tenant scoping.
"""

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any, Iterable
from datetime import datetime, timezone
import json
import sqlite3
from core.security import decode_access_token, hash_api_key
from core.permissions import (
    WORKSPACE_ROLE_HIERARCHY,
    has_workspace_role,
    is_staff_or_admin,
    api_key_allows_scope,
)
from database.connection import get_db

security_bearer = HTTPBearer(auto_error=False)

ROLE_HIERARCHY = WORKSPACE_ROLE_HIERARCHY


def resolve_user_from_jwt(db: sqlite3.Connection, token: str, require_active_tenant: bool = True) -> Optional[Dict[str, Any]]:
    """Validate JWT, token_version revocation, user suspension, and optionally tenant suspension."""
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (payload["sub"],))
    user = cur.fetchone()
    if not user:
        return None
    user_dict = dict(user)
    if user_dict.get("status") == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is suspended",
        )
    db_token_version = int(user_dict.get("token_version") or 1)
    claim_token_version = int(payload.get("token_version") or 1)
    if claim_token_version < db_token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if require_active_tenant and user_dict.get("tenant_id"):
        cur.execute("SELECT status FROM tenants WHERE id = ?", (user_dict["tenant_id"],))
        t = cur.fetchone()
        if t and t["status"] == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This workspace has been suspended. Contact platform support.",
            )
    return user_dict


def resolve_user_from_api_key(db: sqlite3.Connection, raw_key: str) -> Optional[Dict[str, Any]]:
    """Authenticate non-revoked scoped API key from api_keys table and verify active tenant."""
    if not raw_key:
        return None
    key_hash = hash_api_key(raw_key.strip())
    cur = db.cursor()
    cur.execute(
        "SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL",
        (key_hash,),
    )
    api_key_row = cur.fetchone()
    if not api_key_row:
        return None
    cur.execute("SELECT * FROM tenants WHERE id = ?", (api_key_row["tenant_id"],))
    tenant = cur.fetchone()
    if not tenant:
        return None
    if tenant["status"] == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This workspace has been suspended. Contact platform support.",
        )
    try:
        scopes = json.loads(api_key_row["scopes_json"] or "[]")
    except Exception:
        scopes = []
    if not isinstance(scopes, list):
        scopes = []
    norm_scopes = [str(s).strip().lower() for s in scopes if str(s).strip()]
    if (
        "*" in norm_scopes
        or "admin" in norm_scopes
        or any(
            s in norm_scopes
            for s in (
                "workspace:write",
                "workspace:*",
                "billing:write",
                "billing:*",
                "phone_numbers:write",
                "phone_numbers:*",
                "integrations:write",
                "integrations:*",
            )
        )
    ):
        derived_role = "admin"
    elif any(s.endswith(":write") or s.endswith(":*") for s in norm_scopes):
        derived_role = "operator"
    else:
        derived_role = "viewer"
    cur.execute(
        "UPDATE api_keys SET last_used_at = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), api_key_row["id"]),
    )
    db.commit()
    return {
        "id": f"api_key_{api_key_row['id']}",
        "tenant_id": tenant["id"],
        "email": f"api@{tenant['id']}.trivaana.internal",
        "role": derived_role,
        "api_key_scopes": norm_scopes,
        "is_super_admin": 0,
        "full_name": f"API Key ({api_key_row['name']})",
    }


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    """
    Authenticate user via Bearer JWT token or revocable scoped X-API-Key header.
    """
    # 1. Check Bearer JWT token
    if auth and auth.credentials:
        user_dict = resolve_user_from_jwt(db, auth.credentials, require_active_tenant=True)
        if not user_dict:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_dict

    # 2. Check revocable X-API-Key header (api_keys table only; legacy unrevocable tenants.api_key_hash retired)
    if x_api_key:
        api_user = resolve_user_from_api_key(db, x_api_key)
        if api_user:
            return api_user

    # 3. No valid authentication provided -> Raise 401
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide Bearer JWT token or X-API-Key header.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_tenant(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieve verified tenant object for the authenticated user and enforce suspension status."""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant associated with user")

    cur = db.cursor()
    cur.execute("SELECT * FROM tenants WHERE id = ?", (tenant_id,))
    tenant = cur.fetchone()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant workspace not found")

    tenant_dict = dict(tenant)
    if tenant_dict.get("status") == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This workspace has been suspended. Contact platform support."
        )

    if type(db).__name__ == "PostgresCompatConnection":
        cur.execute("SELECT set_config('app.current_tenant_id', ?, false)", (tenant_id,))

    return tenant_dict


def require_roles(allowed_roles: Iterable[str]):
    """Dependency factory enforcing workspace RBAC roles using hierarchy."""
    allowed = tuple(allowed_roles)

    def _checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if current_user.get("is_super_admin"):
            return current_user
        user_role = (current_user.get("role") or "viewer").lower()
        if not has_workspace_role(user_role, allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(sorted(allowed))}"
            )
        return current_user

    return _checker


def require_scope(required_scope: str):
    """Dependency factory enforcing scoped API key permissions when authenticated via X-API-Key."""
    def _checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        scopes = current_user.get("api_key_scopes")
        if scopes is not None and not api_key_allows_scope(scopes, required_scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"API key lacks required scope '{required_scope}'",
            )
        return current_user

    return _checker


def require_staff(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Ensure authenticated user is internal platform staff or Super Admin."""
    if not is_staff_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Internal staff or Super Admin access required"
        )
    return current_user


def require_super_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Ensure authenticated user has platform Super Admin privileges."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform Super Admin access required"
        )
    return current_user
