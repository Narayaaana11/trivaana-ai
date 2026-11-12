"""
TRIVAANA AI: Telephony Call Lifecycle Manager
Coordinates dispatch, provider callbacks, duration calculation, call usage debits,
and webhook notifications.
"""

import json
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
        is_sandbox: bool = False,
        lead_id: Optional[str] = None,
        call_category: str = "service",
    ) -> Dict[str, Any]:
        cur = conn.cursor()
        norm_phone = normalize_phone(phone)
        if len(norm_phone) < 10:
            raise ValueError(f"Invalid recipient phone number: '{phone}'")

        # 1. Enforce global kill switch, active tenant, and minimum wallet balance
        from services.compliance_service import ComplianceService
        pause = ComplianceService.get_emergency_pause(conn)
        if pause["paused"]:
            raise ValueError(f"Outbound calling paused by platform administrator: {pause['reason']}")

        cur.execute("SELECT wallet_balance_paise, status FROM tenants WHERE id = ?", (tenant_id,))
        tenant = cur.fetchone()
        if not tenant:
            raise ValueError(f"Tenant '{tenant_id}' not found")
        if (tenant["status"] or "active") != "active":
            raise ValueError(f"Tenant '{tenant_id}' is suspended or inactive")

        agent_rate = BillingService.get_agent_call_rate(conn, agent_id)
        min_required = agent_rate["rate_paise_per_min"]
        if tenant["wallet_balance_paise"] < min_required and not is_sandbox:
            raise InsufficientBalanceError(
                f"Insufficient funds: available ₹{tenant['wallet_balance_paise']/100:.2f}, minimum ₹{min_required/100:.2f} needed to dial"
            )

        # 2. Select provider
        actual_provider_name = "mock" if is_sandbox else (
            provider_name or (
                "exotel" if settings.has_exotel
                else "plivo" if settings.has_plivo
                else "vobiz" if settings.has_vobiz
                else "twilio" if settings.has_twilio
                else "mock"
            )
        )
        provider = get_telephony_provider(actual_provider_name)

        call_id = f"call_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()

        # 3. Dispatch to provider
        base_url = settings.PUBLIC_BASE_URL.rstrip('/')
        dispatch_result = provider.initiate_call(
            to_phone=norm_phone,
            from_phone=None,
            webhook_url=f"{base_url}/api/calls/callback/{call_id}",
            extra_data={"tenant_id": tenant_id, "agent_id": agent_id, "call_id": call_id}
        )

        initial_status = dispatch_result.status if dispatch_result.success else "failed"
        provider_call_id = dispatch_result.provider_call_id or f"unassigned_{call_id}"
        sandbox_flag = 1 if (is_sandbox or actual_provider_name == "mock") else 0

        # 4. Insert call record
        cur.execute("""
        INSERT INTO calls (
            id, tenant_id, campaign_id, agent_id, lead_id, contact_name, phone,
            direction, call_category, provider, provider_call_id, duration_seconds,
            billable_duration_seconds, cost_paise, status, language, outcome,
            transcript, recording_url, is_sandbox, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'outbound', ?, ?, ?, 0, 0, 0, ?, ?, 'Initiated', NULL, NULL, ?, ?)
        """, (
            call_id, tenant_id, campaign_id, agent_id, lead_id, contact_name, norm_phone,
            call_category, actual_provider_name, provider_call_id, initial_status, language, sandbox_flag, now
        ))
        cur.execute(
            "INSERT INTO call_events (id, call_id, tenant_id, event_type, payload_json, created_at) VALUES (?, ?, ?, 'call.initiated', ?, ?)",
            (f"cev_{uuid.uuid4().hex[:8]}", call_id, tenant_id, json.dumps({"provider": actual_provider_name, "status": initial_status}), now),
        )
        conn.commit()

        return {
            "call_id": call_id,
            "provider": actual_provider_name,
            "provider_call_id": provider_call_id,
            "status": initial_status,
            "is_sandbox": bool(sandbox_flag),
            "contact_name": contact_name,
            "phone": norm_phone,
            "created_at": now,
            "error_message": dispatch_result.error_message
        }

    @staticmethod
    def process_call_event(conn: sqlite3.Connection, event: CallStatusEvent) -> Dict[str, Any]:
        cur = conn.cursor()
        cur.execute("SELECT * FROM calls WHERE provider_call_id = ? OR id = ?", (event.provider_call_id, event.provider_call_id))
        call = cur.fetchone()
        if not call:
            return {"status": "ignored", "reason": "Call not found"}

        call_id = call["id"]
        tenant_id = call["tenant_id"]
        now = datetime.now(timezone.utc).isoformat()

        cost_paise = 0
        billable_seconds = 0
        is_completed = event.status in ("completed", "answered")

        if is_completed:
            duration = event.duration_seconds
            is_connected = duration > 0
            agent_rate = BillingService.get_agent_call_rate(conn, call["agent_id"])
            cost_info = BillingService.calculate_call_cost(
                duration_seconds=duration,
                rate_paise_per_min=agent_rate["rate_paise_per_min"],
                connected=is_connected,
                increment_seconds=agent_rate["increment_seconds"],
            )
            billable_seconds = cost_info["billable_seconds"]
            cost_paise = cost_info["cost_paise"]

            if cost_paise > 0 and call["cost_paise"] == 0:
                idempotency_key = f"call_debit_{call_id}"
                desc = f"Call usage: {call['contact_name']} ({call['phone']}) - {duration}s"
                try:
                    BillingService.debit_wallet(
                        conn=conn,
                        tenant_id=tenant_id,
                        amount_paise=cost_paise,
                        description=desc,
                        idempotency_key=idempotency_key,
                        invoice_id=f"INV-CALL-{call_id[-6:].upper()}",
                        commit=False,
                    )
                except InsufficientBalanceError as exc:
                    from services.audit_service import AuditService
                    AuditService.notify(
                        conn,
                        tenant_id=tenant_id,
                        title="Call Usage Billing Shortfall",
                        message=f"Could not debit ₹{cost_paise / 100.0:.2f} for call {call_id}: {exc}",
                        category="billing",
                        severity="critical",
                        commit=False,
                    )

        # Record estimated provider COGS (BILL-F07) for real/billed duration once per completed call
        if is_completed and duration > 0 and not call["is_sandbox"]:
            cur.execute("SELECT 1 FROM provider_usage_costs WHERE call_id = ? LIMIT 1", (call_id,))
            if not cur.fetchone():
                mins = duration / 60.0
                tel_paise = int(round(mins * 40))  # ~₹0.40/min telephony carrier COGS estimate
                ai_paise = int(round(mins * 35))   # ~₹0.35/min STT+LLM+TTS COGS estimate
                tel_prov = (call["provider"] or "exotel") if dict(call).get("provider") else "exotel"
                cur.execute(
                    """
                    INSERT INTO provider_usage_costs (id, tenant_id, call_id, category, provider_name, units, estimated_cost_paise, created_at)
                    VALUES (?, ?, ?, 'telephony', ?, ?, ?, ?)
                    """,
                    (f"puc_{uuid.uuid4().hex[:8]}", tenant_id, call_id, tel_prov, round(mins, 3), tel_paise, now),
                )
                cur.execute(
                    """
                    INSERT INTO provider_usage_costs (id, tenant_id, call_id, category, provider_name, units, estimated_cost_paise, created_at)
                    VALUES (?, ?, ?, 'voice_ai', 'ai_pipeline', ?, ?, ?)
                    """,
                    (f"puc_{uuid.uuid4().hex[:8]}", tenant_id, call_id, round(mins, 3), ai_paise, now),
                )

        cur.execute("""
        UPDATE calls
        SET status = ?,
            duration_seconds = CASE WHEN COALESCE(duration_seconds, 0) < ? THEN ? ELSE duration_seconds END,
            billable_duration_seconds = CASE WHEN COALESCE(billable_duration_seconds, 0) < ? THEN ? ELSE billable_duration_seconds END,
            cost_paise = CASE WHEN COALESCE(cost_paise, 0) < ? THEN ? ELSE cost_paise END,
            recording_url = COALESCE(?, recording_url),
            ended_at = ?
        WHERE id = ?
        """, (
            event.status,
            event.duration_seconds,
            event.duration_seconds,
            billable_seconds,
            billable_seconds,
            cost_paise,
            cost_paise,
            event.recording_url,
            now,
            call_id
        ))
        cur.execute(
            "INSERT INTO call_events (id, call_id, tenant_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (f"cev_{uuid.uuid4().hex[:8]}", call_id, tenant_id, f"call.{event.status}", json.dumps({"duration": event.duration_seconds}), now),
        )
        if event.recording_url:
            cur.execute(
                """
                INSERT OR IGNORE INTO call_recordings (id, call_id, tenant_id, url, duration_seconds, is_simulated, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (f"rec_{uuid.uuid4().hex[:8]}", call_id, tenant_id, event.recording_url, event.duration_seconds, 1 if call["is_sandbox"] else 0, now),
            )
        conn.commit()

        if event.status in ("completed", "failed", "busy", "no-answer", "cancelled"):
            try:
                from services.disposition_service import DispositionService
                from services.webhook_service import WebhookService
                mapped_disp = DispositionService.resolve_disposition(conn, tenant_id, call["outcome"] or event.status)
                WebhookService.dispatch_event(
                    conn=conn,
                    tenant_id=tenant_id,
                    event_type=f"call.{event.status}",
                    payload={
                        "call_id": call_id,
                        "status": event.status,
                        "mapped_disposition": mapped_disp,
                        "duration_seconds": event.duration_seconds,
                        "cost_paise": cost_paise,
                        "phone": call["phone"],
                        "contact_name": call["contact_name"],
                        "transcript": call["transcript"],
                    },
                    idempotency_key=f"wh_call_{call_id}_{event.status}",
                )
            except Exception:
                pass

        if call["campaign_id"] and event.status in ("completed", "failed", "busy", "no-answer", "cancelled"):
            try:
                from services.campaign_service import CampaignService
                CampaignService.handle_call_outcome_for_job(conn, tenant_id, call["campaign_id"], call_id, event.status)
                CampaignService.advance_campaign_queue(conn, tenant_id, call["campaign_id"])
            except Exception:
                pass

        return {
            "status": "updated",
            "call_id": call_id,
            "call_status": event.status,
            "duration_seconds": event.duration_seconds,
            "cost_paise": cost_paise,
            "cost_inr": cost_paise / 100.0
        }
