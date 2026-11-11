"""
TRIVAANA AI: Billing, GST Invoices, Subscriptions & Financial Ledger Router
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import sqlite3
import uuid
import json

from core.dependencies import get_current_tenant, get_db, require_roles
from core.config import settings
from services.billing_service import BillingService, InsufficientBalanceError
from providers.razorpay_adapter import RazorpayPaymentProvider

router = APIRouter(prefix="/api/billing", tags=["Billing"])
razorpay_provider = RazorpayPaymentProvider()


class CreateOrderRequest(BaseModel):
    amount_inr: float = Field(..., ge=100.0, le=500000.0, description="Top-up amount in INR (minimum ₹100)")


class PaymentVerificationRequest(BaseModel):
    order_id: str = Field(..., description="Razorpay order ID")
    payment_id: str = Field(..., description="Razorpay payment ID")
    signature: str = Field(..., description="Razorpay payment signature")


class SandboxTopupRequest(BaseModel):
    amount_inr: float = Field(..., ge=10.0, le=100000.0, description="Sandbox top-up amount in INR")


class UpdateSubscriptionRequest(BaseModel):
    plan_id: str  # 'payg', 'starter', 'growth', 'enterprise'


@router.get("/pricing")
def get_pricing(conn: sqlite3.Connection = Depends(get_db)):
    return BillingService.get_pricing_catalog(conn)


@router.get("/transactions")
def list_transactions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
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


@router.get("/invoices")
def list_invoices(
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT * FROM invoices WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100", (current_tenant["id"],))
    invoices = []
    for r in cur.fetchall():
        d = dict(r)
        d["line_items"] = json.loads(d.pop("line_items_json", "[]") or "[]")
        d["total_inr"] = d["total_paise"] / 100.0
        d["subtotal_inr"] = d["subtotal_paise"] / 100.0
        d["gst_inr"] = d["gst_paise"] / 100.0
        invoices.append(d)
    return {"invoices": invoices, "count": len(invoices)}


@router.get("/subscription")
def get_subscription(
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", (current_tenant["id"],))
    sub = cur.fetchone()
    return {
        "plan": current_tenant.get("plan", "growth"),
        "concurrency_limit": current_tenant.get("concurrency_limit", 10),
        "subscription": dict(sub) if sub else None,
    }


@router.post("/subscription")
def update_subscription(
    req: UpdateSubscriptionRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    _admin_user: Dict[str, Any] = Depends(require_roles(["owner", "admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    plans = {
        "payg": {"monthly_fee_paise": 0, "included_channels": 2},
        "starter": {"monthly_fee_paise": 299900, "included_channels": 5},
        "growth": {"monthly_fee_paise": 799900, "included_channels": 15},
        "enterprise": {"monthly_fee_paise": 2499900, "included_channels": 50},
    }
    if req.plan_id not in plans:
        raise HTTPException(status_code=400, detail="Invalid plan_id")

    meta = plans[req.plan_id]
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=30)
    sub_id = f"sub_{uuid.uuid4().hex[:8]}"

    if meta["monthly_fee_paise"] > 0:
        try:
            BillingService.debit_wallet(
                conn=conn,
                tenant_id=current_tenant["id"],
                amount_paise=meta["monthly_fee_paise"],
                description=f"Subscription activation: {req.plan_id.upper()} plan ({meta['included_channels']} channels)",
                idempotency_key=f"sub_{sub_id}",
                invoice_id=f"SUB-2026-{sub_id[-6:].upper()}",
            )
        except InsufficientBalanceError as e:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(e))

    cur = conn.cursor()
    cur.execute(
        "UPDATE tenants SET plan = ?, concurrency_limit = ? WHERE id = ?",
        (req.plan_id, meta["included_channels"], current_tenant["id"]),
    )
    cur.execute(
        """
        INSERT INTO subscriptions (id, tenant_id, plan_id, status, monthly_fee_paise, included_channels, current_period_start, current_period_end, created_at)
        VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)
        """,
        (sub_id, current_tenant["id"], req.plan_id, meta["monthly_fee_paise"], meta["included_channels"], now.isoformat(), end.isoformat(), now.isoformat()),
    )
    conn.commit()
    return {"status": "updated", "plan": req.plan_id, "concurrency_limit": meta["included_channels"], "subscription_id": sub_id}


@router.post("/razorpay-order")
def create_razorpay_order(
    req: CreateOrderRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    amount_paise = int(round(req.amount_inr * 100))
    receipt = f"rcpt_{current_tenant['id'][:6]}_{uuid.uuid4().hex[:6]}"

    try:
        order = razorpay_provider.create_order(amount_paise=amount_paise, currency="INR", receipt=receipt)
        now = datetime.now(timezone.utc).isoformat()
        cur = conn.cursor()
        cur.execute("""
        INSERT INTO payment_orders (id, tenant_id, amount_paise, currency, status, receipt, created_at, updated_at)
        VALUES (?, ?, ?, 'INR', 'created', ?, ?, ?)
        """, (order["id"], current_tenant["id"], amount_paise, receipt, now, now))
        conn.commit()

        order["key_id"] = settings.RAZORPAY_KEY_ID or "rzp_test_sandbox_mode"
        return order
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create payment order: {str(e)}")


@router.post("/razorpay-verification")
def verify_and_credit_payment(
    req: PaymentVerificationRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    cur = conn.cursor()
    cur.execute("SELECT * FROM payment_orders WHERE id = ?", (req.order_id,))
    order = cur.fetchone()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment order not found on server.")
    if order["tenant_id"] != current_tenant["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Payment order belongs to another tenant workspace.")

    if order["status"] == "paid":
        return {
            "status": "already_paid",
            "order_id": order["id"],
            "amount_paise": order["amount_paise"],
            "amount_inr": order["amount_paise"] / 100.0,
            "message": "Payment has already been processed and credited to your wallet."
        }

    is_valid = razorpay_provider.verify_payment_signature(
        order_id=req.order_id,
        payment_id=req.payment_id,
        signature=req.signature
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment signature. Verification failed.")

    if razorpay_provider.is_configured:
        try:
            live_pay = razorpay_provider.fetch_payment(req.payment_id)
            if live_pay.get("status") not in ("captured", "authorized"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Payment status not captured: {live_pay.get('status')}")
            if live_pay.get("amount") != order["amount_paise"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Captured payment amount does not match recorded order amount.")
            if live_pay.get("currency") != order["currency"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment currency does not match recorded order currency.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to verify payment with Razorpay gateway: {str(e)}")

    amount_paise = order["amount_paise"]
    amount_inr = amount_paise / 100.0
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "UPDATE payment_orders SET status = 'paid', razorpay_payment_id = ?, updated_at = ? WHERE id = ?",
        (req.payment_id, now, order["id"])
    )
    conn.commit()

    idempotency_key = f"razorpay_{req.payment_id}"
    invoice_id = f"TAX-2026-{req.payment_id[-6:].upper()}"
    desc = f"Prepaid Top-up: ₹{amount_inr:.2f} (Order: {req.order_id})"

    return BillingService.credit_wallet(
        conn=conn,
        tenant_id=current_tenant["id"],
        amount_paise=amount_paise,
        description=desc,
        idempotency_key=idempotency_key,
        invoice_id=invoice_id
    )


@router.post("/razorpay-webhook")
async def handle_razorpay_webhook(request: Request, conn: sqlite3.Connection = Depends(get_db)):
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not signature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing X-Razorpay-Signature header.")
    if not razorpay_provider.verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature.")

    try:
        event = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload in webhook body.")

    payload = event.get("payload", {})
    payment_entity = payload.get("payment", {}).get("entity", {})
    order_id = payment_entity.get("order_id") or payload.get("order", {}).get("entity", {}).get("id")
    payment_id = payment_entity.get("id")

    if not order_id:
        return {"status": "ignored", "reason": "No order_id found in event payload."}

    cur = conn.cursor()
    cur.execute("SELECT * FROM payment_orders WHERE id = ?", (order_id,))
    order = cur.fetchone()
    if not order:
        return {"status": "ignored", "reason": "Order not found in database."}
    if order["status"] == "paid":
        return {"status": "already_processed", "order_id": order_id}

    paid_amount = payment_entity.get("amount")
    if paid_amount and paid_amount != order["amount_paise"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook payment amount mismatch with recorded order.")

    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "UPDATE payment_orders SET status = 'paid', razorpay_payment_id = ?, updated_at = ? WHERE id = ?",
        (payment_id or "webhook_verified", now, order["id"])
    )
    conn.commit()

    amount_paise = order["amount_paise"]
    amount_inr = amount_paise / 100.0
    idempotency_key = f"razorpay_webhook_{payment_id or order_id}"
    invoice_id = f"TAX-2026-{(payment_id or order_id)[-6:].upper()}"
    desc = f"Prepaid Top-up (Webhook): ₹{amount_inr:.2f} (Order: {order_id})"

    result = BillingService.credit_wallet(
        conn=conn,
        tenant_id=order["tenant_id"],
        amount_paise=amount_paise,
        description=desc,
        idempotency_key=idempotency_key,
        invoice_id=invoice_id
    )
    return {"status": "success", "order_id": order_id, "amount_paise": amount_paise, "wallet": result}


@router.post("/sandbox-topup")
def sandbox_topup(
    req: SandboxTopupRequest,
    current_tenant: Dict[str, Any] = Depends(get_current_tenant),
    conn: sqlite3.Connection = Depends(get_db)
):
    if settings.ENVIRONMENT.lower() in ("production", "prod") and not settings.ALLOW_SANDBOX_TOPUP:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sandbox top-up is strictly disabled in production environments.")

    amount_paise = int(round(req.amount_inr * 100))
    tx_code = uuid.uuid4().hex[:8]
    idempotency_key = f"sandbox_topup_{tx_code}"
    invoice_id = f"DEV-SANDBOX-{tx_code.upper()}"
    desc = f"Developer Sandbox Top-up: ₹{req.amount_inr:.2f}"

    return BillingService.credit_wallet(
        conn=conn,
        tenant_id=current_tenant["id"],
        amount_paise=amount_paise,
        description=desc,
        idempotency_key=idempotency_key,
        invoice_id=invoice_id
    )
