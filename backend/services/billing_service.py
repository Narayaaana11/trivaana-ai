"""
TRIVAANA AI: Financial Ledger & Billing Service
Zero-float-drift integer paise accounting, atomic wallet operations,
idempotent payment credit, and GST SAC 998313 compliant invoices.
"""

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from core.config import settings

class InsufficientBalanceError(Exception):
    pass

class DuplicateTransactionError(Exception):
    pass

class BillingService:
    @staticmethod
    def get_pricing_catalog() -> Dict[str, Any]:
        """Server-owned price catalog in integer paise."""
        return {
            "currency": "INR",
            "tariffs": {
                "standard_ai_call_paise_per_min": settings.RATE_STANDARD_PAISE_PER_MIN,
                "standard_ai_call_inr_per_min": settings.RATE_STANDARD_PAISE_PER_MIN / 100.0,
                "premium_ai_call_paise_per_min": settings.RATE_PREMIUM_PAISE_PER_MIN,
                "premium_ai_call_inr_per_min": settings.RATE_PREMIUM_PAISE_PER_MIN / 100.0,
                "number_rental_paise_per_month": settings.NUMBER_RENTAL_PAISE_PER_MONTH,
                "number_rental_inr_per_month": settings.NUMBER_RENTAL_PAISE_PER_MONTH / 100.0,
                "channel_rental_paise_per_month": settings.CHANNEL_RENTAL_PAISE_PER_MONTH,
                "channel_rental_inr_per_month": settings.CHANNEL_RENTAL_PAISE_PER_MONTH / 100.0,
            },
            "billing_rules": {
                "rounding_increment_seconds": settings.BILLING_INCREMENT_SECONDS,
                "charge_unconnected_calls": False,
                "gst_percentage": 18.0,
                "sac_code": "998313"  # Information Technology Software & Telephony Services
            },
            "wallet_packages_inr": [500, 1000, 2500, 5000]
        }

    @staticmethod
    def calculate_call_cost(
        duration_seconds: int,
        rate_paise_per_min: int = settings.RATE_STANDARD_PAISE_PER_MIN,
        connected: bool = True
    ) -> Dict[str, int]:
        """
        Calculate billable duration and cost in integer paise.
        Only charges connected calls, rounded up to nearest 30 seconds.
        """
        if not connected or duration_seconds <= 0:
            return {"billable_seconds": 0, "cost_paise": 0}

        increment = settings.BILLING_INCREMENT_SECONDS
        # Round up to nearest increment
        billable_seconds = ((duration_seconds + increment - 1) // increment) * increment
        cost_paise = int(round((billable_seconds / 60.0) * rate_paise_per_min))
        return {
            "billable_seconds": billable_seconds,
            "cost_paise": cost_paise
        }

    @staticmethod
    def credit_wallet(
        conn: sqlite3.Connection,
        tenant_id: str,
        amount_paise: int,
        description: str,
        idempotency_key: str,
        invoice_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Atomically credit tenant wallet with idempotency check.
        Guarantees that duplicate webhooks/requests never result in multiple credits.
        """
        if amount_paise <= 0:
            raise ValueError("Credit amount must be strictly positive")

        cur = conn.cursor()

        # 1. Idempotency check
        cur.execute("SELECT * FROM transactions WHERE idempotency_key = ?", (idempotency_key,))
        existing = cur.fetchone()
        if existing:
            return {
                "status": "already_processed",
                "transaction_id": existing["id"],
                "running_balance_paise": existing["running_balance_paise"],
                "running_balance_inr": existing["running_balance_paise"] / 100.0
            }

        now = datetime.now(timezone.utc).isoformat()
        inv_id = invoice_id or f"TAX-2026-{uuid.uuid4().hex[:6].upper()}"
        tx_id = f"tx_{uuid.uuid4().hex[:8]}"

        # 2. Atomic update of tenant wallet balance
        cur.execute("""
        UPDATE tenants
        SET wallet_balance_paise = wallet_balance_paise + ?
        WHERE id = ?
        """, (amount_paise, tenant_id))

        cur.execute("SELECT wallet_balance_paise FROM tenants WHERE id = ?", (tenant_id,))
        new_balance_paise = cur.fetchone()["wallet_balance_paise"]

        # 3. Insert immutable ledger entry
        cur.execute("""
        INSERT INTO transactions (id, tenant_id, type, amount_paise, description, invoice_id, running_balance_paise, idempotency_key, created_at)
        VALUES (?, ?, 'credit', ?, ?, ?, ?, ?, ?)
        """, (tx_id, tenant_id, amount_paise, description, inv_id, new_balance_paise, idempotency_key, now))

        conn.commit()

        return {
            "status": "success",
            "transaction_id": tx_id,
            "amount_paise": amount_paise,
            "amount_inr": amount_paise / 100.0,
            "invoice_id": inv_id,
            "running_balance_paise": new_balance_paise,
            "running_balance_inr": new_balance_paise / 100.0
        }

    @staticmethod
    def debit_wallet(
        conn: sqlite3.Connection,
        tenant_id: str,
        amount_paise: int,
        description: str,
        idempotency_key: str,
        invoice_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Atomically debit tenant wallet with concurrency safety.
        Prevents balance from dropping below zero.
        """
        if amount_paise <= 0:
            return {"status": "zero_charge", "amount_paise": 0}

        cur = conn.cursor()

        # Idempotency check
        cur.execute("SELECT * FROM transactions WHERE idempotency_key = ?", (idempotency_key,))
        existing = cur.fetchone()
        if existing:
            return {
                "status": "already_processed",
                "transaction_id": existing["id"],
                "running_balance_paise": existing["running_balance_paise"],
                "running_balance_inr": existing["running_balance_paise"] / 100.0
            }

        # Check sufficient funds
        cur.execute("SELECT wallet_balance_paise FROM tenants WHERE id = ?", (tenant_id,))
        t = cur.fetchone()
        if not t or t["wallet_balance_paise"] < amount_paise:
            available = (t["wallet_balance_paise"] if t else 0) / 100.0
            needed = amount_paise / 100.0
            raise InsufficientBalanceError(
                f"Insufficient wallet balance: available ₹{available:.2f}, required ₹{needed:.2f}"
            )

        now = datetime.now(timezone.utc).isoformat()
        inv_id = invoice_id or f"INV-2026-{uuid.uuid4().hex[:6].upper()}"
        tx_id = f"tx_{uuid.uuid4().hex[:8]}"

        # Atomic debit
        cur.execute("""
        UPDATE tenants
        SET wallet_balance_paise = wallet_balance_paise - ?
        WHERE id = ? AND wallet_balance_paise >= ?
        """, (amount_paise, tenant_id, amount_paise))

        if cur.rowcount == 0:
            raise InsufficientBalanceError("Concurrent debit conflict or insufficient funds")

        cur.execute("SELECT wallet_balance_paise FROM tenants WHERE id = ?", (tenant_id,))
        new_balance_paise = cur.fetchone()["wallet_balance_paise"]

        cur.execute("""
        INSERT INTO transactions (id, tenant_id, type, amount_paise, description, invoice_id, running_balance_paise, idempotency_key, created_at)
        VALUES (?, ?, 'debit', ?, ?, ?, ?, ?, ?)
        """, (tx_id, tenant_id, amount_paise, description, inv_id, new_balance_paise, idempotency_key, now))

        conn.commit()

        return {
            "status": "success",
            "transaction_id": tx_id,
            "amount_paise": amount_paise,
            "amount_inr": amount_paise / 100.0,
            "invoice_id": inv_id,
            "running_balance_paise": new_balance_paise,
            "running_balance_inr": new_balance_paise / 100.0
        }
