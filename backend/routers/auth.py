"""
TRIVAANA AI: Authentication & User Onboarding Router
Provides user registration, login, password reset, email verification, profile updates, and JWT issuance.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
import sqlite3
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from database.connection import get_db
from core.security import hash_password, verify_password, create_access_token, hash_api_key
from core.dependencies import get_current_user
from core.config import settings
from services.audit_service import AuditService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6)
    full_name: str
    organization_name: Optional[str] = None
    company_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


class EmailVerifyConfirmRequest(BaseModel):
    token: str


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


@router.post("/register")
def register(req: RegisterRequest, db: sqlite3.Connection = Depends(get_db)):
    cur = db.cursor()
    normalized_email = req.email.strip().lower()
    cur.execute("SELECT id FROM users WHERE LOWER(email) = ?", (normalized_email,))
    if cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )

    now = datetime.now(timezone.utc).isoformat()
    tenant_id = f"tenant_{uuid.uuid4().hex[:8]}"
    api_key_raw = f"trv_live_{uuid.uuid4().hex[:16]}"
    api_key_hash = hash_api_key(api_key_raw)

    # 1. Create tenant (default 500,000 paise = ₹5,000 welcome credit for evaluation)
    org_name = (req.organization_name or req.company_name or f"{req.full_name}'s Workspace").strip()
    cur.execute("""
    INSERT INTO tenants (id, name, api_key_hash, wallet_balance_paise, currency, plan, concurrency_limit, status, billing_email, created_at)
    VALUES (?, ?, ?, 500000, 'INR', 'growth', 10, 'active', ?, ?)
    """, (tenant_id, org_name, api_key_hash, normalized_email, now))

    # 2. Create workspace owner user
    user_id = f"user_{uuid.uuid4().hex[:8]}"
    hashed_pwd = hash_password(req.password)
    cur.execute("""
    INSERT INTO users (id, tenant_id, email, hashed_password, role, full_name, email_verified, is_super_admin, created_at)
    VALUES (?, ?, ?, ?, 'owner', ?, 0, 0, ?)
    """, (user_id, tenant_id, normalized_email, hashed_pwd, req.full_name.strip(), now))

    # 3. Create workspace member record
    cur.execute("""
    INSERT INTO workspace_members (id, tenant_id, user_id, email, full_name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'owner', 'active', ?, ?)
    """, (f"mem_{uuid.uuid4().hex[:8]}", tenant_id, user_id, normalized_email, req.full_name.strip(), now, now))

    # 4. Create default API key entry
    cur.execute("""
    INSERT INTO api_keys (id, tenant_id, name, key_prefix, key_hash, scopes_json, created_by, created_at)
    VALUES (?, ?, 'Default Workspace Key', ?, ?, '["*"]', ?, ?)
    """, (f"key_{uuid.uuid4().hex[:8]}", tenant_id, api_key_raw[:12], api_key_hash, user_id, now))

    # 5. Create default compliance policy
    cur.execute("""
    INSERT INTO compliance_policies (id, tenant_id, updated_at)
    VALUES (?, ?, ?)
    """, (f"pol_{uuid.uuid4().hex[:8]}", tenant_id, now))

    # 6. Create initial welcome transaction
    cur.execute("""
    INSERT INTO transactions (id, tenant_id, type, amount_paise, description, invoice_id, running_balance_paise, idempotency_key, created_at)
    VALUES (?, ?, 'credit', 500000, 'Welcome Credit: Initial Evaluation Balance', 'TAX-2026-001', 500000, ?, ?)
    """, (f"tx_{uuid.uuid4().hex[:8]}", tenant_id, f"welcome_{tenant_id}", now))

    AuditService.log_event(
        db,
        action="workspace.registered",
        resource_type="tenant",
        resource_id=tenant_id,
        tenant_id=tenant_id,
        actor_user_id=user_id,
        actor_email=normalized_email,
        metadata={"organization_name": org_name},
    )
    AuditService.notify(
        db,
        tenant_id=tenant_id,
        title="Welcome to Trivaana AI",
        message=f"Workspace '{org_name}' initialized with ₹5,000 evaluation balance.",
        category="system",
        severity="success",
        user_id=user_id,
    )

    db.commit()

    # 7. Generate JWT token
    token = create_access_token({
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": "owner",
        "email": normalized_email
    })

    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "api_key": api_key_raw,
        "user": {
            "id": user_id,
            "email": normalized_email,
            "full_name": req.full_name.strip(),
            "role": "owner",
            "email_verified": False,
            "is_super_admin": False,
        },
        "tenant": {
            "id": tenant_id,
            "name": org_name,
            "wallet_balance_inr": 5000.0
        }
    }


@router.post("/login")
def login(req: LoginRequest, db: sqlite3.Connection = Depends(get_db)):
    cur = db.cursor()
    normalized_email = req.email.strip().lower()
    cur.execute("""
    SELECT u.id, u.tenant_id, u.email, u.hashed_password, u.role, u.full_name,
           u.email_verified, u.is_super_admin,
           t.name as tenant_name, t.wallet_balance_paise, t.status as tenant_status
    FROM users u
    JOIN tenants t ON u.tenant_id = t.id
    WHERE LOWER(u.email) = ?
    """, (normalized_email,))
    user = cur.fetchone()

    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user["tenant_status"] == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace suspended. Please contact platform support."
        )

    now = datetime.now(timezone.utc).isoformat()
    cur.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now, user["id"]))
    db.commit()

    token = create_access_token({
        "sub": user["id"],
        "tenant_id": user["tenant_id"],
        "role": user["role"],
        "email": user["email"],
        "is_super_admin": bool(user["is_super_admin"]),
    })

    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "email_verified": bool(user["email_verified"]),
            "is_super_admin": bool(user["is_super_admin"]),
        },
        "tenant": {
            "id": user["tenant_id"],
            "name": user["tenant_name"],
            "wallet_balance_inr": user["wallet_balance_paise"] / 100.0
        }
    }


@router.get("/me")
def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    cur.execute("SELECT id, name, wallet_balance_paise, plan, concurrency_limit, status FROM tenants WHERE id = ?", (current_user["tenant_id"],))
    tenant = cur.fetchone()

    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": current_user["role"],
        "email_verified": bool(current_user.get("email_verified", 1)),
        "is_super_admin": bool(current_user.get("is_super_admin", 0)),
        "tenant_id": tenant["id"],
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "full_name": current_user["full_name"],
            "role": current_user["role"],
            "email_verified": bool(current_user.get("email_verified", 1)),
            "is_super_admin": bool(current_user.get("is_super_admin", 0)),
        },
        "tenant": {
            "id": tenant["id"],
            "name": tenant["name"],
            "wallet_balance_paise": tenant["wallet_balance_paise"],
            "wallet_balance_inr": tenant["wallet_balance_paise"] / 100.0,
            "plan": tenant["plan"],
            "concurrency_limit": tenant["concurrency_limit"],
            "status": tenant["status"],
        }
    }


@router.put("/profile")
def update_profile(
    req: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    if req.full_name is not None:
        cur.execute("UPDATE users SET full_name = ? WHERE id = ?", (req.full_name.strip(), current_user["id"]))
    if req.avatar_url is not None:
        cur.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (req.avatar_url.strip(), current_user["id"]))
    db.commit()
    return {"status": "success", "message": "Profile updated"}


@router.post("/password-reset/request")
def request_password_reset(req: PasswordResetRequest, db: sqlite3.Connection = Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT id, email FROM users WHERE LOWER(email) = ?", (req.email.strip().lower(),))
    user = cur.fetchone()
    raw_token = None
    if user:
        raw_token = f"rst_{secrets.token_urlsafe(24)}"
        now = datetime.now(timezone.utc)
        expires = (now + timedelta(hours=1)).isoformat()
        cur.execute("""
        INSERT INTO auth_tokens (id, user_id, token_type, token_hash, expires_at, created_at)
        VALUES (?, ?, 'password_reset', ?, ?, ?)
        """, (f"tok_{uuid.uuid4().hex[:8]}", user["id"], hash_api_key(raw_token), expires, now.isoformat()))
        db.commit()
        from services.email_service import EmailService
        EmailService.send_password_reset(user["email"], raw_token)

    resp = {
        "status": "success",
        "message": "If an account exists for that email, a password reset token has been generated."
    }
    if settings.ENVIRONMENT.lower() != "production" and raw_token:
        resp["dev_reset_token"] = raw_token
    return resp


@router.post("/password-reset/confirm")
def confirm_password_reset(req: PasswordResetConfirmRequest, db: sqlite3.Connection = Depends(get_db)):
    cur = db.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("""
    SELECT * FROM auth_tokens
    WHERE token_hash = ? AND token_type = 'password_reset' AND used_at IS NULL
    """, (hash_api_key(req.token),))
    tok = cur.fetchone()
    if not tok or tok["expires_at"] < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset token")

    cur.execute("UPDATE users SET hashed_password = ? WHERE id = ?", (hash_password(req.new_password), tok["user_id"]))
    cur.execute("UPDATE auth_tokens SET used_at = ? WHERE id = ?", (now, tok["id"]))
    db.commit()
    return {"status": "success", "message": "Password updated successfully"}


@router.post("/email-verification/request")
def request_email_verification(
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    cur = db.cursor()
    raw_token = f"ver_{secrets.token_urlsafe(24)}"
    now = datetime.now(timezone.utc)
    expires = (now + timedelta(hours=24)).isoformat()
    cur.execute("""
    INSERT INTO auth_tokens (id, user_id, token_type, token_hash, expires_at, created_at)
    VALUES (?, ?, 'email_verify', ?, ?, ?)
    """, (f"tok_{uuid.uuid4().hex[:8]}", current_user["id"], hash_api_key(raw_token), expires, now.isoformat()))
    db.commit()
    from services.email_service import EmailService
    email_res = EmailService.send_verification_email(current_user["email"], raw_token)

    resp = {"status": "success", "message": "Verification token issued", "email_dispatched": bool(email_res.get("sent"))}
    if settings.ENVIRONMENT.lower() != "production":
        resp["dev_verification_token"] = raw_token
    return resp


@router.post("/email-verification/confirm")
def confirm_email_verification(req: EmailVerifyConfirmRequest, db: sqlite3.Connection = Depends(get_db)):
    cur = db.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("""
    SELECT * FROM auth_tokens
    WHERE token_hash = ? AND token_type = 'email_verify' AND used_at IS NULL
    """, (hash_api_key(req.token),))
    tok = cur.fetchone()
    if not tok or tok["expires_at"] < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")

    cur.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (tok["user_id"],))
    cur.execute("UPDATE auth_tokens SET used_at = ? WHERE id = ?", (now, tok["id"]))
    db.commit()
    return {"status": "success", "message": "Email address verified"}
