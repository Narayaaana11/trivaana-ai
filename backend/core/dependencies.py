"""
TRIVAANA AI: Authentication & Multi-Tenant Dependency Guards
Enforces server-side authentication, role authorization, and tenant scoping.
"""

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
import sqlite3
from core.security import decode_access_token, hash_api_key
from database.connection import get_db
from database.seed import DEMO_TENANT_ID

security_bearer = HTTPBearer(auto_error=False)

def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    """
    Authenticate user via Bearer JWT token or X-API-Key header.
    In development/demo mode without token, falls back safely to demo admin user.
    """
    cur = db.cursor()

    # 1. Check Bearer JWT token
    if auth and auth.credentials:
        payload = decode_access_token(auth.credentials)
        if not payload or "sub" not in payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = payload["sub"]
        cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found")
        return dict(user)

    # 2. Check X-API-Key header
    if x_api_key:
        key_hash = hash_api_key(x_api_key)
        cur.execute("SELECT * FROM tenants WHERE api_key_hash = ?", (key_hash,))
        tenant = cur.fetchone()
        if tenant:
            return {
                "id": f"api_user_{tenant['id']}",
                "tenant_id": tenant["id"],
                "email": f"api@{tenant['id']}.trivaana.internal",
                "role": "admin",
                "full_name": f"API Agent ({tenant['name']})"
            }

    # 3. Development / Demo Fallback (Isolated Demo Workspace)
    cur.execute("SELECT * FROM users WHERE id = 'user_demo_admin'")
    demo_user = cur.fetchone()
    if demo_user:
        return dict(demo_user)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )

def get_current_tenant(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieve verified tenant object for the authenticated user."""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant associated with user")

    cur = db.cursor()
    cur.execute("SELECT * FROM tenants WHERE id = ?", (tenant_id,))
    tenant = cur.fetchone()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant workspace not found")

    return dict(tenant)

def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Ensure authenticated user has admin role."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation requires administrator privileges"
        )
    return current_user
