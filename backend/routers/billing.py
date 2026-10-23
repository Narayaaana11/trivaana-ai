"""
TRIVAANA AI: Billing & Financial Ledger Router
Zero-float-drift integer paise accounting, Razorpay order creation,
server-verified signature verification, and sandbox wallet top-ups.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import sqlite3
import uuid

from core.dependencies import get_current_tenant, get_db
from core.config import settings
from services.billing_service import BillingService
from providers.razorpay_adapter import RazorpayPaymentProvider

router = APIRouter(prefix="/api/billing", tags=["Billing"])

razorpay_provider = RazorpayPaymentProvider()

class CreateOrderRequest(BaseModel):
    amount_inr: float = Field(..., ge=100.0, le=500000.0, description="Top-up amount in INR (minimum ₹100)")

class PaymentVerificationRequest(BaseModel):
    order_id: str = Field(..., description="Razorpay order ID")
    payment_id: str = Field(..., description="Razorpay payment ID")
    signature: str = Field(..., description="Razorpay payment signature")
    amount_inr: Optional[float] = Field(None, description="Amount in INR")

class SandboxTopupRequest(BaseModel):
    amount_inr: float = Field(..., ge=10.0, le=100000.0, description="Sandbox top-up amount in INR")

@router.get("/pricing")
def get_pricing():
    """Retrieve server-owned pricing catalog, tariffs, and GST compliance rules."""
    return BillingService.get_pricing_catalog()

@router.get("/transactions")
def list_transactions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Retrieve immutable financial ledger transactions for the active tenant."""
    cur = conn.cursor()
    cur.execute("""
    SELECT * FROM transactions
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
    """, (current_tenant["id"], limit, offset))
    rows = cur.fetchall()

    transactions = []
    for r in rows:
        amount_paise = r["amount_paise"]
        balance_paise = r["running_balance_paise"]
        transactions.append({
            "id": r["id"],
            "tenant_id": r["tenant_id"],
            "type": r["type"],
            "amount_paise": amount_paise,
            "amount_inr": amount_paise / 100.0,
            "description": r["description"],
            "invoice_id": r["invoice_id"] or "",
            "running_balance": balance_paise / 100.0,
            "running_balance_paise": balance_paise,
            "idempotency_key": r["idempotency_key"],
            "created_at": r["created_at"]
        })

    cur.execute("SELECT COUNT(*) as total FROM transactions WHERE tenant_id = ?", (current_tenant["id"],))
    count = cur.fetchone()["total"]

    return {"transactions": transactions, "count": count}

@router.post("/razorpay-order")
def create_razorpay_order(
    req: CreateOrderRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant)
):
    """
    Generate a server-side payment order.
    Uses real Razorpay API when configured, or returns a deterministic sandbox order.
    """
    amount_paise = int(round(req.amount_inr * 100))
    receipt = f"rcpt_{current_tenant['id'][:6]}_{uuid.uuid4().hex[:6]}"

    try:
        order = razorpay_provider.create_order(
            amount_paise=amount_paise,
            currency="INR",
            receipt=receipt
        )
        # Expose safe public Razorpay key ID for checkout modal
        order["key_id"] = settings.RAZORPAY_KEY_ID or "rzp_test_sandbox_mode"
        return order
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create payment order: {str(e)}"
        )

@router.post("/razorpay-webhook")
def verify_and_credit_payment(
    req: PaymentVerificationRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Verify payment signature and credit tenant wallet balance.
    Guarantees idempotency: repeat calls with identical payment_id return existing receipt.
    """
    is_valid = razorpay_provider.verify_payment_signature(
        order_id=req.order_id,
        payment_id=req.payment_id,
        signature=req.signature
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment signature. Verification failed."
        )

    # Derive amount
    amount_inr = req.amount_inr or 500.0
    amount_paise = int(round(amount_inr * 100))

    idempotency_key = f"razorpay_{req.payment_id}"
    invoice_id = f"TAX-2026-{req.payment_id[-6:].upper()}"
    desc = f"Prepaid Top-up: ₹{amount_inr:.2f} (Order: {req.order_id})"

    result = BillingService.credit_wallet(
        conn=conn,
        tenant_id=current_tenant["id"],
        amount_paise=amount_paise,
        description=desc,
        idempotency_key=idempotency_key,
        invoice_id=invoice_id
    )

    return result

@router.post("/sandbox-topup")
def sandbox_topup(
    req: SandboxTopupRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Direct sandbox balance recharge for local testing and developer previews.
    Records full ledger audit entry with integer paise.
    """
    amount_paise = int(round(req.amount_inr * 100))
    tx_code = uuid.uuid4().hex[:8]
    idempotency_key = f"sandbox_topup_{tx_code}"
    invoice_id = f"DEV-SANDBOX-{tx_code.upper()}"
    desc = f"Developer Sandbox Top-up: ₹{req.amount_inr:.2f}"

    result = BillingService.credit_wallet(
        conn=conn,
        tenant_id=current_tenant["id"],
        amount_paise=amount_paise,
        description=desc,
        idempotency_key=idempotency_key,
        invoice_id=invoice_id
    )

    return result
