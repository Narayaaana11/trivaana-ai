"""
TRIVAANA AI: Outbound Campaign & Durable Worker Service
Manages batch queueing, duplicate prevention, verified consent enforcement, concurrency limits,
retry attempts, TRAI calling windows, and isolated emergency kill switches.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from core.config import settings
from providers import get_telephony_provider
from services.call_service import CallService
from services.compliance_service import ComplianceService


class CampaignService:
    @staticmethod
    def is_within_trai_window() -> bool:
        """
        TRAI (Telecom Regulatory Authority of India) Commercial Calling Hours:
        Permitted calling window is 10:00 AM to 6:00 PM IST (UTC+5:30).
        """
        utc_now = datetime.now(timezone.utc)
        ist_now = utc_now + timedelta(hours=5, minutes=30)
        return 10 <= ist_now.hour < 18

    @staticmethod
    def create_campaign(
        conn: sqlite3.Connection,
        tenant_id: str,
        name: str,
        agent_id: Optional[str] = None,
        concurrency: int = 5,
        list_id: Optional[str] = None,
        suppression_list_id: Optional[str] = None,
        retry_attempts: int = 2,
        retry_delay_minutes: int = 30,
        calling_hours: Optional[Dict[str, Any]] = None,
        calling_days: Optional[List[str]] = None,
        scheduled_at: Optional[str] = None,
        is_sandbox: bool = False,
    ) -> Dict[str, Any]:
        cur = conn.cursor()
        campaign_id = f"cmp_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        initial_status = "scheduled" if scheduled_at else "idle"

        cur.execute("""
        INSERT INTO campaigns (
            id, tenant_id, name, agent_id, list_id, suppression_list_id, status, concurrency,
            calling_hours_json, calling_days_json, retry_attempts, retry_delay_minutes, scheduled_at,
            is_sandbox, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            campaign_id, tenant_id, name, agent_id, list_id, suppression_list_id, initial_status, concurrency,
            json.dumps(calling_hours or {"start": "10:00", "end": "18:00", "timezone": "Asia/Kolkata"}),
            json.dumps(calling_days or ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]),
            retry_attempts, retry_delay_minutes, scheduled_at, 1 if is_sandbox else 0, now
        ))
        conn.commit()

        return {
            "campaign_id": campaign_id,
            "name": name,
            "status": initial_status,
            "concurrency": concurrency,
            "retry_attempts": retry_attempts,
            "retry_delay_minutes": retry_delay_minutes,
            "scheduled_at": scheduled_at,
            "created_at": now
        }

    @staticmethod
    def start_campaign(
        conn: sqlite3.Connection,
        tenant_id: str,
        campaign_id: str,
        concurrency: int = 5,
        max_calls: int = 20,
        bypass_trai: bool = False,
        is_sandbox: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """
        Launch campaign:
        1. Enforces TRAI commercial calling hours (10:00 AM - 6:00 PM IST) unless bypassed.
        2. Strictly requires verified consent (opt_out == 0 AND consent_status == 'opted_in') and DNC check.
        3. Deduplicates contacts so the same number is never dialed twice in one campaign.
        4. Enqueues all jobs durably into campaign_jobs.
        5. Dispatches the initial concurrency batch and reports remaining queued jobs.
        """
        cur = conn.cursor()

        cur.execute("SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?", (campaign_id, tenant_id))
        campaign = cur.fetchone()
        if not campaign:
            raise ValueError("Campaign not found")

        use_sandbox = bool(campaign["is_sandbox"]) if is_sandbox is None else is_sandbox

        trai_active = CampaignService.is_within_trai_window()
        if not trai_active and not bypass_trai:
            raise ValueError(
                "Calling blocked by TRAI compliance guard: Outbound promotional calls are restricted to 10:00 AM - 6:00 PM IST. Use bypass_trai=True only for explicitly exempted transactional messages."
            )

        if not bypass_trai and not use_sandbox and "calling_days_json" in campaign.keys() and campaign["calling_days_json"]:
            try:
                allowed_days = json.loads(campaign["calling_days_json"])
                hours_cfg = json.loads(campaign["calling_hours_json"] or "{}") if "calling_hours_json" in campaign.keys() else {}
                if not ComplianceService.is_within_calling_hours(
                    hours_cfg.get("start", "10:00"),
                    hours_cfg.get("end", "18:00"),
                    calling_days=allowed_days,
                ):
                    raise ValueError(
                        "Calling blocked by campaign schedule: outside configured calling days or IST window."
                    )
            except json.JSONDecodeError:
                pass

        # Fetch eligible leads (from contact list if attached, else tenant's opted-in leads)
        if campaign["list_id"]:
            cur.execute("""
            SELECT l.* FROM leads l
            JOIN contact_list_members clm ON clm.lead_id = l.id
            WHERE clm.list_id = ? AND l.tenant_id = ? AND l.opt_out = 0 AND l.consent_status = 'opted_in'
            ORDER BY l.created_at DESC
            LIMIT ?
            """, (campaign["list_id"], tenant_id, max_calls))
        else:
            cur.execute("""
            SELECT * FROM leads
            WHERE tenant_id = ? AND opt_out = 0 AND consent_status = 'opted_in'
            ORDER BY created_at DESC
            LIMIT ?
            """, (tenant_id, max_calls))
        eligible_leads = cur.fetchall()

        if not eligible_leads:
            return {
                "status": "idle",
                "message": "No eligible leads found for campaign dispatch (all opted out, unverified, or empty)",
                "enqueued_count": 0,
                "queued_remaining": 0
            }

        # Existing phones already queued/called in this campaign + suppression list phones
        cur.execute("SELECT phone FROM campaign_jobs WHERE campaign_id = ?", (campaign_id,))
        already_queued_phones = {r["phone"] for r in cur.fetchall() if r["phone"]}
        if "suppression_list_id" in campaign.keys() and campaign["suppression_list_id"]:
            cur.execute(
                """
                SELECT l.phone FROM leads l
                JOIN contact_list_members clm ON clm.lead_id = l.id
                WHERE clm.list_id = ? AND l.tenant_id = ?
                """,
                (campaign["suppression_list_id"], tenant_id),
            )
            for sr in cur.fetchall():
                already_queued_phones.add(sr["phone"])

        now = datetime.now(timezone.utc).isoformat()
        max_retries = campaign["retry_attempts"] if "retry_attempts" in campaign.keys() else 2

        enqueued_jobs = []
        for lead in eligible_leads:
            if lead["phone"] in already_queued_phones:
                continue
            sup = ComplianceService.is_suppressed(conn, tenant_id, lead["phone"])
            if sup["suppressed"]:
                continue
            if not use_sandbox:
                cap = ComplianceService.check_daily_call_cap(conn, tenant_id, lead["phone"], max_per_day=3)
                if not cap["allowed"]:
                    continue

            already_queued_phones.add(lead["phone"])
            job_id = f"job_{uuid.uuid4().hex[:8]}"
            cur.execute("""
            INSERT INTO campaign_jobs (
                id, campaign_id, tenant_id, lead_id, contact_name, phone,
                custom_fields_json, status, retry_count, max_retries, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)
            """, (
                job_id, campaign_id, tenant_id, lead["id"], lead["name"], lead["phone"],
                lead["custom_fields_json"] if "custom_fields_json" in lead.keys() else "{}",
                max_retries, now, now
            ))
            enqueued_jobs.append((job_id, lead))

        if not enqueued_jobs:
            return {
                "status": "idle",
                "message": "All matching contacts were already queued or suppressed by DNC.",
                "enqueued_count": 0,
                "queued_remaining": 0,
            }

        # Enforce tenant concurrency limit
        cur.execute("SELECT concurrency_limit FROM tenants WHERE id = ?", (tenant_id,))
        t_row = cur.fetchone()
        tenant_cap = t_row["concurrency_limit"] if t_row else concurrency
        effective_concurrency = min(concurrency, tenant_cap)

        dispatched_count = 0
        actual_lines = min(effective_concurrency, len(enqueued_jobs))
        agent_id = campaign["agent_id"]
        agent_language = "te-IN"
        if agent_id:
            cur.execute("SELECT language FROM agents WHERE id = ? AND tenant_id = ?", (agent_id, tenant_id))
            ag_row = cur.fetchone()
            if ag_row and ag_row["language"]:
                agent_language = ag_row["language"]

        for i in range(actual_lines):
            job_id, lead = enqueued_jobs[i]
            try:
                call_info = CallService.initiate_call(
                    conn=conn,
                    tenant_id=tenant_id,
                    contact_name=lead["name"],
                    phone=lead["phone"],
                    language=agent_language,
                    agent_id=agent_id,
                    campaign_id=campaign_id,
                    is_sandbox=use_sandbox,
                )
                cur.execute("""
                UPDATE campaign_jobs
                SET status = 'calling', call_id = ?, updated_at = ?
                WHERE id = ?
                """, (call_info["call_id"], now, job_id))
                dispatched_count += 1
            except Exception as e:
                cur.execute("""
                UPDATE campaign_jobs
                SET status = 'failed', last_error = ?, updated_at = ?
                WHERE id = ?
                """, (str(e)[:200], now, job_id))

        queued_remaining = max(0, len(enqueued_jobs) - dispatched_count)

        cur.execute("""
        UPDATE campaigns
        SET status = 'running',
            concurrency = ?,
            started_at = COALESCE(started_at, ?),
            total_contacts = total_contacts + ?,
            placed = placed + ?
        WHERE id = ?
        """, (effective_concurrency, now, len(enqueued_jobs), dispatched_count, campaign_id))
        conn.commit()

        return {
            "status": "campaign_running",
            "campaign_id": campaign_id,
            "total_enqueued": len(enqueued_jobs),
            "initial_dispatched": dispatched_count,
            "queued_remaining": queued_remaining,
            "active_lines": actual_lines,
            "trai_enforced": not bypass_trai,
            "is_sandbox": use_sandbox,
            "message": f"Dispatched {dispatched_count} calls. {queued_remaining} remain durably queued."
        }

    @staticmethod
    def pause_campaign(conn: sqlite3.Connection, tenant_id: str, campaign_id: str) -> Dict[str, Any]:
        cur = conn.cursor()
        cur.execute("UPDATE campaigns SET status = 'paused' WHERE id = ? AND tenant_id = ?", (campaign_id, tenant_id))
        conn.commit()
        return {"status": "paused", "campaign_id": campaign_id}

    @staticmethod
    def resume_campaign(conn: sqlite3.Connection, tenant_id: str, campaign_id: str) -> Dict[str, Any]:
        cur = conn.cursor()
        cur.execute("UPDATE campaigns SET status = 'running' WHERE id = ? AND tenant_id = ?", (campaign_id, tenant_id))
        conn.commit()
        return {"status": "running", "campaign_id": campaign_id}

    @staticmethod
    def handle_call_outcome_for_job(conn: sqlite3.Connection, tenant_id: str, campaign_id: str, call_id: str, call_status: str):
        """Schedule retry if call failed/no-answer/busy and retry_count < max_retries, else finalize job."""
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM campaign_jobs WHERE campaign_id = ? AND tenant_id = ? AND call_id = ?",
            (campaign_id, tenant_id, call_id),
        )
        job = cur.fetchone()
        if not job:
            return
        cur.execute("SELECT retry_delay_minutes FROM campaigns WHERE id = ?", (campaign_id,))
        cmp = cur.fetchone()
        delay_mins = cmp["retry_delay_minutes"] if cmp else 30
        now = datetime.now(timezone.utc)

        if call_status in ("no-answer", "busy", "failed"):
            if (job["retry_count"] or 0) < (job["max_retries"] or 0):
                next_at = (now + timedelta(minutes=delay_mins)).isoformat()
                cur.execute(
                    """
                    UPDATE campaign_jobs
                    SET status = 'pending', retry_count = retry_count + 1, next_retry_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (next_at, now.isoformat(), job["id"]),
                )
            else:
                final_st = "no_answer" if call_status == "no-answer" else ("busy" if call_status == "busy" else "failed")
                cur.execute("UPDATE campaign_jobs SET status = ?, updated_at = ? WHERE id = ?", (final_st, now.isoformat(), job["id"]))
                if final_st == "no_answer":
                    cur.execute("UPDATE campaigns SET no_answer_count = no_answer_count + 1 WHERE id = ?", (campaign_id,))
                else:
                    cur.execute("UPDATE campaigns SET failed = failed + 1 WHERE id = ?", (campaign_id,))
        elif call_status in ("completed", "answered"):
            cur.execute("UPDATE campaign_jobs SET status = 'completed', updated_at = ? WHERE id = ?", (now.isoformat(), job["id"]))
            cur.execute("UPDATE campaigns SET connected = connected + 1 WHERE id = ?", (campaign_id,))
        conn.commit()
        if call_status in ("failed", "provider_error"):
            CampaignService.evaluate_provider_circuit_breaker(conn, tenant_id, campaign_id, failed_now=True)

    @staticmethod
    def evaluate_provider_circuit_breaker(
        conn: sqlite3.Connection,
        tenant_id: str,
        campaign_id: str,
        http_status: Optional[int] = None,
        failed_now: bool = False,
        min_samples: int = 5,
        failure_threshold: float = 0.6,
    ) -> Dict[str, Any]:
        """
        Provider Circuit Breaker (adapted cleanly from Dograh BSD-2-Clause):
        Immediately pauses a running campaign if a carrier/AI provider returns HTTP 401/402/403
        (invalid key or exhausted credits) or exceeds the failure-rate threshold.
        """
        cur = conn.cursor()
        trip_reason: Optional[str] = None
        if http_status in (401, 402, 403):
            trip_reason = f"Provider rejected request with HTTP {http_status} (auth/credit exhaustion)"
        elif failed_now:
            cur.execute("SELECT placed, connected, failed FROM campaigns WHERE id = ? AND tenant_id = ?", (campaign_id, tenant_id))
            cmp = cur.fetchone()
            if cmp:
                completed_or_failed = (cmp["connected"] or 0) + (cmp["failed"] or 0)
                if completed_or_failed >= min_samples and ((cmp["failed"] or 0) / completed_or_failed) >= failure_threshold:
                    trip_reason = f"High failure rate tripped circuit breaker ({cmp['failed']}/{completed_or_failed} failed)"

        if trip_reason:
            cur.execute(
                "UPDATE campaigns SET status = 'paused' WHERE id = ? AND tenant_id = ? AND status = 'running'",
                (campaign_id, tenant_id),
            )
            if cur.rowcount > 0:
                from services.audit_service import AuditService
                AuditService.log_event(
                    conn,
                    action="campaign.circuit_breaker_tripped",
                    resource_type="campaign",
                    resource_id=campaign_id,
                    tenant_id=tenant_id,
                    metadata={"reason": trip_reason, "http_status": http_status},
                    commit=True,
                )
            return {"tripped": True, "status": "paused", "reason": trip_reason}
        return {"tripped": False}

    @staticmethod
    def process_due_retries(conn: sqlite3.Connection, tenant_id: str, campaign_id: str) -> Dict[str, Any]:
        """Dispatch any retry-eligible jobs whose next_retry_at timestamp is due (or force-eligible)."""
        cur = conn.cursor()
        cur.execute("SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?", (campaign_id, tenant_id))
        cmp = cur.fetchone()
        if not cmp:
            raise ValueError("Campaign not found")

        now = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            SELECT * FROM campaign_jobs
            WHERE campaign_id = ? AND tenant_id = ? AND status = 'pending' AND retry_count > 0
              AND (next_retry_at IS NULL OR next_retry_at <= ?)
            ORDER BY created_at ASC
            """,
            (campaign_id, tenant_id, now),
        )
        due_jobs = cur.fetchall()
        dispatched = 0
        for job in due_jobs:
            cur.execute("SELECT * FROM leads WHERE id = ?", (job["lead_id"],))
            lead = cur.fetchone()
            if not lead or lead["opt_out"] == 1 or lead["consent_status"] != "opted_in":
                cur.execute("UPDATE campaign_jobs SET status = 'skipped', updated_at = ? WHERE id = ?", (now, job["id"]))
                continue
            try:
                call_info = CallService.initiate_call(
                    conn=conn,
                    tenant_id=tenant_id,
                    contact_name=lead["name"],
                    phone=lead["phone"],
                    language="te-IN",
                    agent_id=cmp["agent_id"],
                    campaign_id=campaign_id,
                    is_sandbox=bool(cmp["is_sandbox"]),
                )
                cur.execute(
                    "UPDATE campaign_jobs SET status = 'calling', call_id = ?, next_retry_at = NULL, updated_at = ? WHERE id = ?",
                    (call_info["call_id"], now, job["id"]),
                )
                cur.execute("UPDATE campaigns SET placed = placed + 1 WHERE id = ?", (campaign_id,))
                dispatched += 1
            except Exception as exc:
                cur.execute("UPDATE campaign_jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?", (str(exc)[:200], now, job["id"]))
        conn.commit()
        return {"status": "processed", "campaign_id": campaign_id, "due_found": len(due_jobs), "dispatched": dispatched}

    @staticmethod
    def advance_campaign_queue(conn: sqlite3.Connection, tenant_id: str, campaign_id: str):
        cur = conn.cursor()
        cur.execute("SELECT status, agent_id, is_sandbox FROM campaigns WHERE id = ? AND tenant_id = ?", (campaign_id, tenant_id))
        cmp = cur.fetchone()
        if not cmp or cmp["status"] != "running":
            return

        now = datetime.now(timezone.utc).isoformat()
        cur.execute("""
        SELECT * FROM campaign_jobs
        WHERE campaign_id = ? AND tenant_id = ? AND status = 'pending'
          AND (next_retry_at IS NULL OR next_retry_at <= ?)
        ORDER BY created_at ASC
        LIMIT 1
        """, (campaign_id, tenant_id, now))
        next_job = cur.fetchone()
        if not next_job:
            # Mark completed if no calling or pending jobs remain
            cur.execute(
                "SELECT COUNT(*) as rem FROM campaign_jobs WHERE campaign_id = ? AND status IN ('pending', 'queued', 'calling')",
                (campaign_id,),
            )
            if cur.fetchone()["rem"] == 0:
                cur.execute("UPDATE campaigns SET status = 'completed', completed_at = ? WHERE id = ?", (now, campaign_id))
                conn.commit()
            return

        cur.execute("SELECT * FROM leads WHERE id = ?", (next_job["lead_id"],))
        lead = cur.fetchone()
        if not lead or lead["opt_out"] == 1 or lead["consent_status"] != "opted_in":
            cur.execute("UPDATE campaign_jobs SET status = 'skipped', updated_at = ? WHERE id = ?", (now, next_job["id"]))
            conn.commit()
            return

        try:
            call_info = CallService.initiate_call(
                conn=conn,
                tenant_id=tenant_id,
                contact_name=lead["name"],
                phone=lead["phone"],
                language="te-IN",
                agent_id=cmp["agent_id"],
                campaign_id=campaign_id,
                is_sandbox=bool(cmp["is_sandbox"]),
            )
            cur.execute("""
            UPDATE campaign_jobs
            SET status = 'calling', call_id = ?, updated_at = ?
            WHERE id = ?
            """, (call_info["call_id"], now, next_job["id"]))
            cur.execute("UPDATE campaigns SET placed = placed + 1 WHERE id = ?", (campaign_id,))
            conn.commit()
        except Exception as e:
            cur.execute("""
            UPDATE campaign_jobs
            SET status = 'failed', last_error = ?, updated_at = ?
            WHERE id = ?
            """, (str(e)[:200], now, next_job["id"]))
            cur.execute("UPDATE campaigns SET failed = failed + 1 WHERE id = ?", (campaign_id,))
            conn.commit()

    @staticmethod
    def kill_campaign(conn: sqlite3.Connection, tenant_id: str, campaign_id: Optional[str] = None) -> Dict[str, Any]:
        cur = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()

        query = "UPDATE campaigns SET status = 'halted' WHERE tenant_id = ?"
        params = [tenant_id]
        if campaign_id:
            query += " AND id = ?"
            params.append(campaign_id)
        else:
            query += " AND status = 'running'"

        cur.execute(query, params)
        campaigns_halted = cur.rowcount

        job_query = "UPDATE campaign_jobs SET status = 'cancelled', updated_at = ? WHERE tenant_id = ? AND status = 'pending'"
        job_params = [now, tenant_id]
        if campaign_id:
            job_query += " AND campaign_id = ?"
            job_params.append(campaign_id)
        cur.execute(job_query, job_params)
        jobs_cancelled = cur.rowcount

        call_query = """
        SELECT id, provider, provider_call_id FROM calls
        WHERE tenant_id = ? AND status IN ('initiated', 'ringing', 'connected')
        """
        call_params = [tenant_id]
        if campaign_id:
            call_query += " AND campaign_id = ?"
            call_params.append(campaign_id)

        cur.execute(call_query, call_params)
        active_calls = cur.fetchall()

        severed_count = 0
        for c in active_calls:
            provider = get_telephony_provider(c["provider"])
            if c["provider_call_id"]:
                provider.terminate_call(c["provider_call_id"])
            cur.execute("""
            UPDATE calls
            SET status = 'cancelled', outcome = 'Severed by Emergency Kill Switch', ended_at = ?
            WHERE id = ?
            """, (now, c["id"]))
            severed_count += 1

        conn.commit()

        return {
            "status": "halted",
            "campaign_id": campaign_id,
            "campaigns_halted": campaigns_halted,
            "jobs_cancelled": jobs_cancelled,
            "calls_severed": severed_count,
            "message": f"Kill switch successfully executed: {campaigns_halted} campaign(s) halted, {jobs_cancelled} pending job(s) purged, {severed_count} active line(s) severed."
        }
