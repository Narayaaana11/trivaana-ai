"""
TRIVAANA AI: Telephony Call Lifecycle Manager
Coordinates dispatch, provider callbacks, duration calculation, and call usage debits.
"""

import sqlite3
import uuid
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from core.config import settings
from providers import get_telephony_provider
from providers.base import CallStatusEvent
from services.billing_service import BillingService, InsufficientBalanceError

def normalize_phone(phone: str) -> str:
    """Normalize phone number to E.164-compatible format (+91XXXXXXXXXX)."""
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    if cleaned.startswith("+"):
        return cleaned
    elif len(cleaned) == 10:
        return f"+91{cleaned}"
    elif len(cleaned) == 12 and cleaned.startswith("91"):
        return f"+{cleaned}"
    return cleaned

class CallService:
    @staticmethod
    def initiate_call(
        conn: sqlite3.Connection,
        tenant_id: str,
        contact_name: str,
        phone: str,
        language: str = "te-IN",
        agent_id: Optional[str] = None,
        campaign_id: Optional[str] = None,
        provider_name: Optional[str] = None,
        is_sandbox: bool = False
    ) -> Dict[str, Any]:
        """
        Initiate an outbound call for a tenant.
        Checks wallet balance, normalizes phone, and dispatches to telephony provider.
        """
        cur = conn.cursor()
        norm_phone = normalize_phone(phone)
        if len(norm_phone) < 10:
            raise ValueError(f"Invalid recipient phone number: '{phone}'")

        # 1. Check wallet balance (minimum 1 minute required)
        cur.execute("SELECT wallet_balance_paise FROM tenants WHERE id = ?", (tenant_id,))
        tenant = cur.fetchone()
        if not tenant:
            raise ValueError(f"Tenant '{tenant_id}' not found")

        min_required = settings.RATE_STANDARD_PAISE_PER_MIN
        if tenant["wallet_balance_paise"] < min_required and not is_sandbox:
            raise InsufficientBalanceError(
                f"Insufficient funds: available ₹{tenant['wallet_balance_paise']/100:.2f}, minimum ₹{min_required/100:.2f} needed to dial"
            )

        # 2. Select provider
        # If is_sandbox is true or neither Exotel nor Twilio is configured, use mock
        actual_provider_name = "mock" if is_sandbox else (provider_name or ("exotel" if settings.has_exotel else ("twilio" if settings.has_twilio else "mock")))
        provider = get_telephony_provider(actual_provider_name)

        call_id = f"call_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()

        # 3. Dispatch to provider
        dispatch_result = provider.initiate_call(
            to_phone=norm_phone,
            from_phone=None,
            webhook_url=f"https://api.trivaana.ai/api/calls/callback/{call_id}",
            extra_data={"tenant_id": tenant_id, "agent_id": agent_id}
        )

        initial_status = dispatch_result.status if dispatch_result.success else "failed"
        provider_call_id = dispatch_result.provider_call_id or f"unassigned_{call_id}"

        # 4. Insert call record
        cur.execute("""
        INSERT INTO calls (
            id, tenant_id, campaign_id, agent_id, contact_name, phone,
            direction, provider, provider_call_id, duration_seconds,
            billable_duration_seconds, cost_paise, status, language, outcome,
            transcript, recording_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'outbound', ?, ?, 0, 0, 0, ?, ?, 'Initiated', NULL, NULL, ?)
        """, (
            call_id, tenant_id, campaign_id, agent_id, contact_name, norm_phone,
            actual_provider_name, provider_call_id, initial_status, language, now
        ))
        conn.commit()

        return {
            "call_id": call_id,
            "provider": actual_provider_name,
            "provider_call_id": provider_call_id,
            "status": initial_status,
            "is_sandbox": actual_provider_name == "mock",
            "contact_name": contact_name,
            "phone": norm_phone,
            "created_at": now,
            "error_message": dispatch_result.error_message
        }

    @staticmethod
    def process_call_event(conn: sqlite3.Connection, event: CallStatusEvent) -> Dict[str, Any]:
        """
        Process signed webhook event from telephony carrier.
        Updates duration, records transcript/audio URL, and settles usage debits atomically.
        """
        cur = conn.cursor()
        cur.execute("SELECT * FROM calls WHERE provider_call_id = ? OR id = ?", (event.provider_call_id, event.provider_call_id))
        call = cur.fetchone()
        if not call:
            return {"status": "ignored", "reason": "Call not found"}

        call_id = call["id"]
        tenant_id = call["tenant_id"]
        now = datetime.now(timezone.utc).isoformat()

        # Settle billing if call has completed
        cost_paise = 0
        billable_seconds = 0
        is_completed = event.status in ("completed", "answered")

        if is_completed:
            duration = event.duration_seconds
            is_connected = duration > 0
            cost_info = BillingService.calculate_call_cost(
                duration_seconds=duration,
                rate_paise_per_min=settings.RATE_STANDARD_PAISE_PER_MIN,
                connected=is_connected
            )
            billable_seconds = cost_info["billable_seconds"]
            cost_paise = cost_info["cost_paise"]

            # Debit wallet if billable cost > 0
            if cost_paise > 0 and call["cost_paise"] == 0:
                idempotency_key = f"call_debit_{call_id}"
                desc = f"Call usage: {call['contact_name']} ({call['phone']}) - {duration}s"
                BillingService.debit_wallet(
                    conn=conn,
                    tenant_id=tenant_id,
                    amount_paise=cost_paise,
                    description=desc,
                    idempotency_key=idempotency_key,
                    invoice_id=f"INV-CALL-{call_id[-6:].upper()}"
                )

        # Update call record
        cur.execute("""
        UPDATE calls
        SET status = ?,
            duration_seconds = MAX(duration_seconds, ?),
            billable_duration_seconds = MAX(billable_duration_seconds, ?),
            cost_paise = MAX(cost_paise, ?),
            recording_url = COALESCE(?, recording_url),
            ended_at = ?
        WHERE id = ?
        """, (
            event.status,
            event.duration_seconds,
            billable_seconds,
            cost_paise,
            event.recording_url,
            now,
            call_id
        ))
        conn.commit()

        return {
            "status": "updated",
            "call_id": call_id,
            "call_status": event.status,
            "duration_seconds": event.duration_seconds,
            "cost_paise": cost_paise,
            "cost_inr": cost_paise / 100.0
        }
