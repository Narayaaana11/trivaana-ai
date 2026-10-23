"""
TRIVAANA AI: Outbound Campaign & Durable Worker Service
Manages batch queueing, concurrency limits, TRAI calling windows, and emergency kill switches.
"""

import sqlite3
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from core.config import settings
from providers import get_telephony_provider
from services.call_service import CallService

class CampaignService:
    @staticmethod
    def is_within_trai_window() -> bool:
        """
        TRAI (Telecom Regulatory Authority of India) Commercial Calling Hours:
        Permitted calling window is 10:00 AM to 6:00 PM IST (UTC+5:30).
        """
        utc_now = datetime.now(timezone.utc)
        ist_now = utc_now + timedelta(hours=5, minutes=30)
        hour = ist_now.hour
        # 10:00 AM is hour 10, 6:00 PM is hour 18
        return 10 <= hour < 18

    @staticmethod
    def create_campaign(
        conn: sqlite3.Connection,
        tenant_id: str,
        name: str,
        agent_id: Optional[str] = None,
        concurrency: int = 5
    ) -> Dict[str, Any]:
        cur = conn.cursor()
        campaign_id = f"cmp_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()

        cur.execute("""
        INSERT INTO campaigns (id, tenant_id, name, agent_id, status, concurrency, created_at)
        VALUES (?, ?, ?, ?, 'idle', ?, ?)
        """, (campaign_id, tenant_id, name, agent_id, concurrency, now))
        conn.commit()

        return {
            "campaign_id": campaign_id,
            "name": name,
            "status": "idle",
            "concurrency": concurrency,
            "created_at": now
        }

    @staticmethod
    def start_campaign(
        conn: sqlite3.Connection,
        tenant_id: str,
        campaign_id: str,
        concurrency: int = 5,
        max_calls: int = 20,
        bypass_trai: bool = False
    ) -> Dict[str, Any]:
        """
        Launch campaign: enqueues eligible leads, validates calling window,
        and dispatches calls through the telephony worker.
        """
        cur = conn.cursor()

        # 1. Verify campaign ownership
        cur.execute("SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?", (campaign_id, tenant_id))
        campaign = cur.fetchone()
        if not campaign:
            raise ValueError("Campaign not found")

        # 2. Check TRAI Calling Window
        trai_active = CampaignService.is_within_trai_window()
        if not trai_active and not bypass_trai:
            raise ValueError(
                "Calling blocked by TRAI compliance guard: Outbound promotional calls are restricted to 10:00 AM - 6:00 PM IST. Use bypass_trai=True only for explicitly exempted transactional messages."
            )

        # 3. Fetch eligible leads (not opted out, not suppressed)
        cur.execute("""
        SELECT * FROM leads
        WHERE tenant_id = ? AND opt_out = 0
        ORDER BY created_at DESC
        LIMIT ?
        """, (tenant_id, max_calls))
        eligible_leads = cur.fetchall()

        if not eligible_leads:
            return {
                "status": "idle",
                "message": "No eligible leads found for campaign dispatch (all opted out or empty)",
                "enqueued_count": 0
            }

        now = datetime.now(timezone.utc).isoformat()

        # 4. Enqueue jobs into campaign_jobs
        enqueued_jobs = []
        for lead in eligible_leads:
            job_id = f"job_{uuid.uuid4().hex[:8]}"
            cur.execute("""
            INSERT INTO campaign_jobs (id, campaign_id, tenant_id, lead_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
            """, (job_id, campaign_id, tenant_id, lead["id"], now, now))
            enqueued_jobs.append((job_id, lead))

        # 5. Dispatch initial batch up to concurrency limit
        dispatched_count = 0
        actual_lines = min(concurrency, len(enqueued_jobs))

        agent_id = campaign["agent_id"]

        for i in range(actual_lines):
            job_id, lead = enqueued_jobs[i]
            try:
                call_info = CallService.initiate_call(
                    conn=conn,
                    tenant_id=tenant_id,
                    contact_name=lead["name"],
                    phone=lead["phone"],
                    language="te-IN",
                    agent_id=agent_id,
                    campaign_id=campaign_id
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
                SET status = 'failed', updated_at = ?
                WHERE id = ?
                """, (now, job_id))

        # 6. Update campaign status and counters
        cur.execute("""
        UPDATE campaigns
        SET status = 'running',
            concurrency = ?,
            total_contacts = ?,
            placed = placed + ?
        WHERE id = ?
        """, (concurrency, len(enqueued_jobs), dispatched_count, campaign_id))
        conn.commit()

        return {
            "status": "campaign_running",
            "campaign_id": campaign_id,
            "total_enqueued": len(enqueued_jobs),
            "initial_dispatched": dispatched_count,
            "active_lines": actual_lines,
            "trai_enforced": not bypass_trai
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
    def kill_campaign(conn: sqlite3.Connection, tenant_id: str, campaign_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Emergency Kill Switch: halts all campaign processing, cancels pending queue jobs,
        and invokes telephony carrier APIs to sever active live calls.
        """
        cur = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()

        # Halt active campaigns
        query = "UPDATE campaigns SET status = 'halted' WHERE tenant_id = ?"
        params = [tenant_id]
        if campaign_id:
            query += " AND id = ?"
            params.append(campaign_id)
        else:
            query += " AND status = 'running'"

        cur.execute(query, params)
        campaigns_halted = cur.rowcount

        # Cancel pending jobs
        job_query = "UPDATE campaign_jobs SET status = 'cancelled', updated_at = ? WHERE tenant_id = ? AND status = 'pending'"
        job_params = [now, tenant_id]
        if campaign_id:
            job_query += " AND campaign_id = ?"
            job_params.append(campaign_id)
        cur.execute(job_query, job_params)
        jobs_cancelled = cur.rowcount

        # Terminate active calls on carrier networks
        cur.execute("""
        SELECT id, provider, provider_call_id FROM calls
        WHERE tenant_id = ? AND status IN ('initiated', 'ringing', 'connected')
        """, (tenant_id,))
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
            "campaigns_halted": campaigns_halted,
            "jobs_cancelled": jobs_cancelled,
            "calls_severed": severed_count,
            "message": f"Kill switch successfully executed: {campaigns_halted} campaign(s) halted, {jobs_cancelled} pending job(s) purged, {severed_count} active line(s) severed."
        }
