"""
TRIVAANA AI: TRAI TCCCPR Compliance, Consent & DND Suppression Service
Enforces consent verification, Do-Not-Call scrubbing, calling hours, promotional vs service classification,
and approved numbering series checks before outbound dialing.
"""

from datetime import datetime, timezone, timedelta
import json
import sqlite3
import uuid
from typing import Any, Dict, Optional
from services.call_service import normalize_phone


class ComplianceService:
    @staticmethod
    def get_policy(conn: sqlite3.Connection, tenant_id: str) -> Dict[str, Any]:
        cur = conn.cursor()
        cur.execute("SELECT * FROM compliance_policies WHERE tenant_id = ?", (tenant_id,))
        row = cur.fetchone()
        if row:
            return dict(row)
        now = datetime.now(timezone.utc).isoformat()
        pol_id = f"pol_{uuid.uuid4().hex[:8]}"
        cur.execute(
            "INSERT OR IGNORE INTO compliance_policies (id, tenant_id, updated_at) VALUES (?, ?, ?)",
            (pol_id, tenant_id, now),
        )
        conn.commit()
        cur.execute("SELECT * FROM compliance_policies WHERE tenant_id = ?", (tenant_id,))
        return dict(cur.fetchone())

    @staticmethod
    def is_within_calling_hours(
        start_hhmm: str = "10:00",
        end_hhmm: str = "18:00",
        calling_days: Optional[list] = None,
    ) -> bool:
        utc_now = datetime.now(timezone.utc)
        ist_now = utc_now + timedelta(hours=5, minutes=30)
        if calling_days:
            weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            today_label = weekday_names[ist_now.weekday()]
            normalized_days = {str(d).strip()[:3].lower() for d in calling_days}
            if today_label.lower() not in normalized_days:
                return False
        cur_minutes = ist_now.hour * 60 + ist_now.minute
        try:
            sh, sm = [int(x) for x in start_hhmm.split(":")]
            eh, em = [int(x) for x in end_hhmm.split(":")]
            return (sh * 60 + sm) <= cur_minutes < (eh * 60 + em)
        except Exception:
            return 10 <= ist_now.hour < 18

    @staticmethod
    def check_daily_call_cap(
        conn: sqlite3.Connection,
        tenant_id: str,
        phone: str,
        max_per_day: int = 3,
    ) -> Dict[str, Any]:
        """Limit repeat automated outbound dials to the same phone number within 24 hours."""
        norm = normalize_phone(phone)
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT COUNT(*) as cnt FROM calls
            WHERE tenant_id = ? AND phone = ? AND direction = 'outbound'
              AND is_sandbox = 0 AND created_at >= ?
            """,
            (tenant_id, norm, cutoff),
        )
        cnt = cur.fetchone()["cnt"]
        if cnt >= max_per_day:
            return {
                "allowed": False,
                "attempts_24h": cnt,
                "reason": f"Daily outbound cap reached ({cnt}/{max_per_day} attempts in 24h) for {norm}",
            }
        return {"allowed": True, "attempts_24h": cnt, "reason": None}

    @staticmethod
    def is_suppressed(conn: sqlite3.Connection, tenant_id: str, phone: str) -> Dict[str, Any]:
        norm = normalize_phone(phone)
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM do_not_call_entries WHERE tenant_id = ? AND phone = ? LIMIT 1",
            (tenant_id, norm),
        )
        dnc = cur.fetchone()
        if dnc:
            return {"suppressed": True, "reason": f"On workspace Do-Not-Call list ({dnc['reason']})"}

        cur.execute(
            "SELECT opt_out, consent_status FROM leads WHERE tenant_id = ? AND phone = ? LIMIT 1",
            (tenant_id, norm),
        )
        lead = cur.fetchone()
        if lead and (lead["opt_out"] == 1 or lead["consent_status"] == "opted_out"):
            return {"suppressed": True, "reason": "Lead has opted out of calls"}

        cur.execute(
            "SELECT consent_status FROM consent_records WHERE tenant_id = ? AND phone = ? ORDER BY recorded_at DESC LIMIT 1",
            (tenant_id, norm),
        )
        rec = cur.fetchone()
        if rec and rec["consent_status"] in ("opted_out", "revoked"):
            return {"suppressed": True, "reason": "Customer consent revoked"}

        return {"suppressed": False, "reason": None}

    @staticmethod
    def get_emergency_pause(conn: sqlite3.Connection) -> Dict[str, Any]:
        """Check whether platform Super Admin has activated the global outbound calling kill switch."""
        try:
            cur = conn.cursor()
            cur.execute("SELECT value_json FROM platform_settings WHERE key = 'emergency_outbound_pause'")
            row = cur.fetchone()
            if row and row["value_json"]:
                cfg = json.loads(row["value_json"])
                if cfg.get("paused"):
                    return {"paused": True, "reason": cfg.get("reason") or "Emergency maintenance"}
        except Exception:
            pass
        return {"paused": False, "reason": None}

    @staticmethod
    def evaluate_pre_call(
        conn: sqlite3.Connection,
        tenant_id: str,
        phone: str,
        call_category: str = "service",
        bypass_calling_hours: bool = False,
        is_sandbox: bool = False,
    ) -> Dict[str, Any]:
        """Evaluate all pre-call regulatory checks before dialing."""
        pause = ComplianceService.get_emergency_pause(conn)
        if pause["paused"]:
            return {
                "allowed": False,
                "code": "EMERGENCY_KILL_SWITCH",
                "reason": f"Outbound calling paused by platform administrator: {pause['reason']}",
            }

        policy = ComplianceService.get_policy(conn, tenant_id)
        sup = ComplianceService.is_suppressed(conn, tenant_id, phone)
        if sup["suppressed"]:
            return {"allowed": False, "code": "DNC_OR_OPT_OUT", "reason": sup["reason"]}

        if policy.get("require_explicit_consent", 1) and not is_sandbox:
            norm = normalize_phone(phone)
            cur = conn.cursor()
            cur.execute(
                "SELECT consent_status FROM leads WHERE tenant_id = ? AND phone = ? LIMIT 1",
                (tenant_id, norm),
            )
            lead = cur.fetchone()
            if lead and lead["consent_status"] == "pending":
                return {
                    "allowed": False,
                    "code": "CONSENT_PENDING",
                    "reason": "Lead consent is still pending explicit confirmation before outbound dialing.",
                }

        if call_category == "promotional" and not policy.get("allow_promotional_calls", 0) and not is_sandbox:
            return {
                "allowed": False,
                "code": "PROMOTIONAL_CALLS_RESTRICTED",
                "reason": "Promotional automated calling requires explicit promotional sender/140-series registration and workspace policy enablement.",
            }

        if call_category == "promotional" and policy.get("require_dlt_for_promotional", 0) and not is_sandbox:
            dlt_check = ComplianceService.check_dlt_readiness(conn, tenant_id, call_category)
            if not dlt_check["approved"]:
                return {
                    "allowed": False,
                    "code": "DLT_NOT_APPROVED",
                    "reason": dlt_check["reason"],
                }

        if not bypass_calling_hours and not is_sandbox:
            if not ComplianceService.is_within_calling_hours(
                policy.get("calling_window_start", "10:00"),
                policy.get("calling_window_end", "18:00"),
            ):
                return {
                    "allowed": False,
                    "code": "OUTSIDE_CALLING_HOURS",
                    "reason": f"Blocked outside configured calling hours ({policy.get('calling_window_start')}-{policy.get('calling_window_end')} IST).",
                }

        return {"allowed": True, "code": "COMPLIANT", "policy": policy}

    @staticmethod
    def add_dnc(
        conn: sqlite3.Connection,
        tenant_id: str,
        phone: str,
        reason: str = "Customer opt-out",
        source: str = "manual",
    ) -> Dict[str, Any]:
        norm = normalize_phone(phone)
        now = datetime.now(timezone.utc).isoformat()
        cur = conn.cursor()
        cur.execute("SELECT id FROM do_not_call_entries WHERE tenant_id = ? AND phone = ?", (tenant_id, norm))
        existing = cur.fetchone()
        if existing:
            return {"id": existing["id"], "phone": norm, "status": "already_listed"}

        dnc_id = f"dnc_{uuid.uuid4().hex[:8]}"
        cur.execute(
            "INSERT INTO do_not_call_entries (id, tenant_id, phone, reason, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (dnc_id, tenant_id, norm, reason, source, now),
        )
        cur.execute(
            "UPDATE leads SET opt_out = 1, consent_status = 'opted_out', lead_status = 'do_not_call' WHERE tenant_id = ? AND phone = ?",
            (tenant_id, norm),
        )
        conn.commit()
        return {"id": dnc_id, "phone": norm, "status": "added"}

    @staticmethod
    def check_dlt_readiness(conn: sqlite3.Connection, tenant_id: str, call_category: str = "promotional") -> Dict[str, Any]:
        """Verify an approved DLT Principal Entity + Header/Template exists for the workspace."""
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, entity_name, pe_id, header_id, template_id
            FROM dlt_registrations
            WHERE tenant_id = ? AND status = 'approved'
              AND (call_category = ? OR call_category = 'all')
            ORDER BY reviewed_at DESC, created_at DESC LIMIT 1
            """,
            (tenant_id, call_category),
        )
        row = cur.fetchone()
        if row:
            return {"approved": True, "registration": dict(row), "reason": None}
        return {
            "approved": False,
            "registration": None,
            "reason": f"No approved DLT PE/Header registration found for '{call_category}' outreach. Submit and verify DLT registration first.",
        }

    @staticmethod
    def scrub_ncpr_numbers(
        conn: sqlite3.Connection,
        tenant_id: str,
        phones: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        """
        Scrub phone numbers against workspace DNC, opt-outs, revoked consent, and optional live NCPR API.
        Persists an auditable ncpr_scrub_jobs record.
        """
        import os
        cur = conn.cursor()
        if not phones:
            cur.execute("SELECT phone FROM leads WHERE tenant_id = ? LIMIT 500", (tenant_id,))
            phones = [r["phone"] for r in cur.fetchall() if r["phone"]]

        ncpr_api_url = (os.environ.get("NCPR_API_URL") or "").strip()
        provider_mode = "local_registry"
        external_blocked: set[str] = set()
        if ncpr_api_url:
            try:
                from core.ssrf import validate_external_url
                import httpx
                validate_external_url(ncpr_api_url)
                headers = {}
                ncpr_key = (os.environ.get("NCPR_API_KEY") or "").strip()
                if ncpr_key:
                    headers["Authorization"] = f"Bearer {ncpr_key}"
                resp = httpx.post(ncpr_api_url, json={"phones": phones}, headers=headers, timeout=8.0)
                if resp.status_code == 200:
                    payload = resp.json()
                    external_blocked = {normalize_phone(p) for p in payload.get("dnd_numbers", [])}
                    provider_mode = "live_ncpr"
            except Exception:
                provider_mode = "local_registry"

        eligible_phones: list[str] = []
        blocked_details: list[Dict[str, str]] = []
        for raw in phones:
            norm = normalize_phone(str(raw))
            if len(norm) < 10:
                blocked_details.append({"phone": str(raw), "reason": "invalid_phone"})
                continue
            if norm in external_blocked:
                blocked_details.append({"phone": norm, "reason": "ncpr_dnd_registered"})
                continue
            sup = ComplianceService.is_suppressed(conn, tenant_id, norm)
            if sup["suppressed"]:
                blocked_details.append({"phone": norm, "reason": sup["reason"] or "suppressed"})
                continue
            eligible_phones.append(norm)

        job_id = f"ncpr_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            INSERT INTO ncpr_scrub_jobs (
                id, tenant_id, total_checked, blocked_count, eligible_count,
                provider_mode, results_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id,
                tenant_id,
                len(phones),
                len(blocked_details),
                len(eligible_phones),
                provider_mode,
                json.dumps({"blocked_details": blocked_details[:100]}),
                now,
            ),
        )
        conn.commit()
        return {
            "id": job_id,
            "total_checked": len(phones),
            "blocked_count": len(blocked_details),
            "eligible_count": len(eligible_phones),
            "eligible_phones": eligible_phones,
            "blocked_details": blocked_details,
            "provider_mode": provider_mode,
            "created_at": now,
        }

