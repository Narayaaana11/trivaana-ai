"""
TRIVAANA AI: Financial Ledger & Billing Service
Zero-float-drift integer paise accounting, Super-Admin-configurable tariffs,
atomic wallet operations, idempotent payment credit, and GST SAC 998313 invoices.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from core.config import settings


class InsufficientBalanceError(Exception):
    pass


class BillingService:
    @staticmethod
    def get_pricing_catalog(conn: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
        """Server-owned price catalog in integer paise, dynamically reading Super Admin overrides if present."""
        std_rate = settings.RATE_STANDARD_PAISE_PER_MIN
        prem_rate = settings.RATE_PREMIUM_PAISE_PER_MIN
        brc_rate = settings.BROADCAST_PAISE_PER_CALL
        num_rent = settings.NUMBER_RENTAL_PAISE_PER_MONTH
        chn_rent = settings.CHANNEL_RENTAL_PAISE_PER_MONTH
        inc_sec = settings.BILLING_INCREMENT_SECONDS
        gst_pct = 18.0

        if conn is not None:
            try:
                cur = conn.cursor()
                cur.execute("SELECT key, value_json FROM platform_settings WHERE key = 'commercial_tariffs'")
                row = cur.fetchone()
                if row:
                    cfg = json.loads(row["value_json"] or "{}")
                    std_rate = int(cfg.get("standard_ai_call_paise_per_min", std_rate))
                    prem_rate = int(cfg.get("premium_ai_call_paise_per_min", prem_rate))
                    brc_rate = int(cfg.get("broadcast_paise_per_call", brc_rate))
                    num_rent = int(cfg.get("number_rental_paise_per_month", num_rent))
                    chn_rent = int(cfg.get("channel_rental_paise_per_month", chn_rent))
                    inc_sec = int(cfg.get("rounding_increment_seconds", inc_sec))
                    gst_pct = float(cfg.get("gst_percentage", gst_pct))
            except Exception:
                pass

        return {
            "currency": "INR",
            "tariffs": {
                "standard_ai_call_paise_per_min": std_rate,
                "standard_ai_call_inr_per_min": std_rate / 100.0,
                "premium_ai_call_paise_per_min": prem_rate,
                "premium_ai_call_inr_per_min": prem_rate / 100.0,
                "broadcast_paise_per_call": brc_rate,
                "broadcast_inr_per_call": brc_rate / 100.0,
                "number_rental_paise_per_month": num_rent,
                "number_rental_inr_per_month": num_rent / 100.0,
                "channel_rental_paise_per_month": chn_rent,
                "channel_rental_inr_per_month": chn_rent / 100.0,
            },
            "billing_rules": {
                "rounding_increment_seconds": inc_sec,
                "charge_unconnected_calls": False,
                "gst_percentage": gst_pct,
                "sac_code": "998313"
            },
            "wallet_packages_inr": [500, 1000, 2500, 5000]
        }

    @staticmethod
    def calculate_call_cost(
        duration_seconds: int,
        rate_paise_per_min: int = settings.RATE_STANDARD_PAISE_PER_MIN,
        connected: bool = True,
        increment_seconds: Optional[int] = None,
    ) -> Dict[str, int]:
        if not connected or duration_seconds <= 0:
            return {"billable_seconds": 0, "cost_paise": 0}

        increment = increment_seconds or settings.BILLING_INCREMENT_SECONDS
        billable_seconds = ((duration_seconds + increment - 1) // increment) * increment
        cost_paise = int(round((billable_seconds / 60.0) * rate_paise_per_min))
        return {
            "billable_seconds": billable_seconds,
            "cost_paise": cost_paise
        }

    @staticmethod
    def _record_invoice(
        conn: sqlite3.Connection,
        tenant_id: str,
        invoice_number: str,
        total_paise: int,
        description: str,
    ):
        cur = conn.cursor()
        cur.execute("SELECT name, gstin FROM tenants WHERE id = ?", (tenant_id,))
        t = cur.fetchone()
        subtotal = int(round(total_paise / 1.18))
        gst = total_paise - subtotal
        now = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            INSERT OR IGNORE INTO invoices (
                id, tenant_id, invoice_number, subtotal_paise, gst_paise, total_paise,
                gst_percentage, sac_code, status, line_items_json, billing_name, billing_gstin, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 18.0, '998313', 'paid', ?, ?, ?, ?)
            """,
            (
                f"inv_{uuid.uuid4().hex[:8]}",
                tenant_id,
                invoice_number,
                subtotal,
                gst,
                total_paise,
                json.dumps([{"description": description, "amount_paise": total_paise}]),
                t["name"] if t else "",
                t["gstin"] if t and "gstin" in t.keys() else "",
                now,
            ),
        )

    @staticmethod
    def credit_wallet(
        conn: sqlite3.Connection,
        tenant_id: str,
        amount_paise: int,
        description: str,
        idempotency_key: str,
        invoice_id: Optional[str] = None,
        commit: bool = True,
    ) -> Dict[str, Any]:
        if amount_paise <= 0:
            raise ValueError("Credit amount must be strictly positive")

        cur = conn.cursor()
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

        cur.execute("""
        UPDATE tenants
        SET wallet_balance_paise = wallet_balance_paise + ?
        WHERE id = ?
        """, (amount_paise, tenant_id))

        cur.execute("SELECT wallet_balance_paise FROM tenants WHERE id = ?", (tenant_id,))
        new_balance_paise = cur.fetchone()["wallet_balance_paise"]

        cur.execute("""
        INSERT INTO transactions (id, tenant_id, type, amount_paise, description, invoice_id, running_balance_paise, idempotency_key, created_at)
        VALUES (?, ?, 'credit', ?, ?, ?, ?, ?, ?)
        """, (tx_id, tenant_id, amount_paise, description, inv_id, new_balance_paise, idempotency_key, now))

        BillingService._record_invoice(conn, tenant_id, inv_id, amount_paise, description)
        if commit:
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
        if amount_paise <= 0:
            return {"status": "zero_charge", "amount_paise": 0}

        cur = conn.cursor()
        cur.execute("SELECT * FROM transactions WHERE idempotency_key = ?", (idempotency_key,))
        existing = cur.fetchone()
        if existing:
            return {
                "status": "already_processed",
                "transaction_id": existing["id"],
                "running_balance_paise": existing["running_balance_paise"],
                "running_balance_inr": existing["running_balance_paise"] / 100.0
            }

        cur.execute("SELECT wallet_balance_paise, low_balance_threshold_paise FROM tenants WHERE id = ?", (tenant_id,))
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

        threshold = t["low_balance_threshold_paise"] if "low_balance_threshold_paise" in t.keys() else 50000
        if new_balance_paise <= threshold:
            from services.audit_service import AuditService
            AuditService.notify(
                conn,
                tenant_id=tenant_id,
                title="Low Wallet Balance Alert",
                message=f"Your wallet balance is ₹{new_balance_paise / 100.0:.2f}. Top up to avoid call interruptions.",
                category="billing",
                severity="warning",
            )

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
