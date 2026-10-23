"""
TRIVAANA AI: Authentication & User Onboarding Router
Provides secure user registration, login, JWT token issuance, and tenant binding.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
import sqlite3
import uuid
from datetime import datetime, timezone
from database.connection import get_db
from core.security import hash_password, verify_password, create_access_token, hash_api_key
from core.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    organization_name: Optional[str] = None
    company_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/register")
def register(req: RegisterRequest, db: sqlite3.Connection = Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE email = ?", (req.email,))
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
    org_name = req.organization_name or req.company_name or f"{req.full_name}'s Workspace"
    cur.execute("""
    INSERT INTO tenants (id, name, api_key_hash, wallet_balance_paise, currency, plan, concurrency_limit, created_at)
    VALUES (?, ?, ?, 500000, 'INR', 'growth', 10, ?)
    """, (tenant_id, org_name, api_key_hash, now))

    # 2. Create admin user
    user_id = f"user_{uuid.uuid4().hex[:8]}"
    hashed_pwd = hash_password(req.password)
    cur.execute("""
    INSERT INTO users (id, tenant_id, email, hashed_password, role, full_name, created_at)
    VALUES (?, ?, ?, ?, 'admin', ?, ?)
    """, (user_id, tenant_id, req.email, hashed_pwd, req.full_name, now))

    # 3. Create initial welcome transaction
    cur.execute("""
    INSERT INTO transactions (id, tenant_id, type, amount_paise, description, invoice_id, running_balance_paise, idempotency_key, created_at)
    VALUES (?, ?, 'credit', 500000, 'Welcome Credit: Initial Evaluation Balance', 'TAX-2026-001', 500000, ?, ?)
    """, (f"tx_{uuid.uuid4().hex[:8]}", tenant_id, f"welcome_{tenant_id}", now))

    db.commit()

    # 4. Generate JWT token
    token = create_access_token({
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": "admin",
        "email": req.email
    })

    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "api_key": api_key_raw,  # Returned once on creation
        "user": {
            "id": user_id,
            "email": req.email,
            "full_name": req.full_name,
            "role": "admin"
        },
        "tenant": {
            "id": tenant_id,
            "name": req.organization_name,
            "wallet_balance_inr": 5000.0
        }
    }

@router.post("/login")
def login(req: LoginRequest, db: sqlite3.Connection = Depends(get_db)):
    cur = db.cursor()
    cur.execute("""
    SELECT u.id, u.tenant_id, u.email, u.hashed_password, u.role, u.full_name,
           t.name as tenant_name, t.wallet_balance_paise
    FROM users u
    JOIN tenants t ON u.tenant_id = t.id
    WHERE u.email = ?
    """, (req.email,))
    user = cur.fetchone()

    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({
        "sub": user["id"],
        "tenant_id": user["tenant_id"],
        "role": user["role"],
        "email": user["email"]
    })

    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"]
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
    cur.execute("SELECT id, name, wallet_balance_paise, plan, concurrency_limit FROM tenants WHERE id = ?", (current_user["tenant_id"],))
    tenant = cur.fetchone()

    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": current_user["role"],
        "tenant_id": tenant["id"],
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "full_name": current_user["full_name"],
            "role": current_user["role"]
        },
        "tenant": {
            "id": tenant["id"],
            "name": tenant["name"],
            "wallet_balance_paise": tenant["wallet_balance_paise"],
            "wallet_balance_inr": tenant["wallet_balance_paise"] / 100.0,
            "plan": tenant["plan"],
            "concurrency_limit": tenant["concurrency_limit"]
        }
    }
