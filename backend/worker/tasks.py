"""
TRIVAANA AI: Background Worker & Durable Task Dispatcher
Supports Celery + Redis when configured, plus standalone scheduled campaign activation,
automatic due-retry ticking, and running campaign queue progression.
"""

from datetime import datetime, timedelta, timezone
import logging
import time
import uuid
from typing import Any, Dict
from core.config import settings
from database import get_connection
from services.campaign_service import CampaignService
from services.webhook_service import WebhookService

logger = logging.getLogger("trivaana.worker")


def create_celery_app():
    """Create optional Celery app when REDIS_URL and celery package are installed."""
    if not settings.has_redis:
        return None
    try:
        from celery import Celery  # type: ignore

        app = Celery("trivaana_worker", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
        app.conf.task_serializer = "json"
        app.conf.accept_content = ["json"]
        app.conf.timezone = "Asia/Kolkata"
        app.task(name="trivaana.process_campaign_tick")(process_campaign_tick)
        app.task(name="trivaana.dispatch_webhook_async")(dispatch_webhook_async)
        app.task(name="trivaana.delayed_intake_call")(execute_delayed_intake_call)
        return app
    except ImportError:
        return None


celery_app = create_celery_app()


def execute_delayed_intake_call(
    tenant_id: str,
    lead_id: str,
    contact_name: str,
    phone: str,
    language: str,
    agent_id: str,
    call_category: str = "service",
    is_sandbox: bool = False,
):
    from services.call_service import CallService
    conn = get_connection()
    try:
        call_res = CallService.initiate_call(
            conn=conn,
            tenant_id=tenant_id,
            contact_name=contact_name,
            phone=phone,
            language=language,
            agent_id=agent_id,
            is_sandbox=is_sandbox,
        )
        conn.execute(
            "UPDATE calls SET lead_id = ?, call_category = ?, is_sandbox = ? WHERE id = ?",
            (lead_id, call_category, 1 if is_sandbox else 0, call_res["call_id"]),
        )
        conn.commit()
        return call_res
    finally:
        conn.close()


def schedule_delayed_intake_call(
    delay_seconds: int,
    tenant_id: str,
    lead_id: str,
    contact_name: str,
    phone: str,
    language: str,
    agent_id: str,
    call_category: str = "service",
    is_sandbox: bool = False,
) -> Dict[str, Any]:
    if celery_app is not None:
        task = celery_app.send_task(
            "trivaana.delayed_intake_call",
            args=[tenant_id, lead_id, contact_name, phone, language, agent_id, call_category, is_sandbox],
            countdown=max(1, int(delay_seconds)),
        )
        return {"scheduled": True, "backend": "celery", "task_id": str(task.id), "delay_seconds": delay_seconds}

    sched_id = f"sch_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc)
    scheduled_for = (now + timedelta(seconds=max(1, int(delay_seconds)))).isoformat()
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO scheduled_calls (
                id, tenant_id, lead_id, contact_name, phone, language, agent_id,
                call_category, is_sandbox, status, scheduled_for, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            """,
            (
                sched_id, tenant_id, lead_id, contact_name, phone, language, agent_id,
                call_category, 1 if is_sandbox else 0, scheduled_for, now.isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {"scheduled": True, "backend": "db_scheduler", "task_id": sched_id, "scheduled_for": scheduled_for, "delay_seconds": delay_seconds}


def process_campaign_tick(tenant_id: str, campaign_id: str):
    conn = get_connection()
    try:
        CampaignService.advance_campaign_queue(conn, tenant_id, campaign_id)
    finally:
        conn.close()


def dispatch_webhook_async(tenant_id: str, event_type: str, payload: Dict[str, Any]):
    conn = get_connection()
    try:
        return WebhookService.dispatch_event(conn, tenant_id, event_type, payload)
    finally:
        conn.close()


def activate_due_scheduled_campaigns(conn) -> int:
    """Auto-start any scheduled campaigns whose `scheduled_at` timestamp has arrived."""
    now_iso = datetime.now(timezone.utc).isoformat()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, tenant_id, is_sandbox FROM campaigns
        WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
        """,
        (now_iso,),
    )
    activated = 0
    for row in cur.fetchall():
        try:
            res = CampaignService.start_campaign(
                conn,
                row["tenant_id"],
                row["id"],
                bypass_trai=bool(row["is_sandbox"]),
            )
            if res.get("status") in ("campaign_running", "running"):
                activated += 1
        except Exception as exc:
            logger.warning("Failed to activate scheduled campaign %s: %s", row["id"], exc)
    return activated


def process_due_retries_tick(conn) -> int:
    """Re-queue due campaign retries across active/paused campaigns cleanly."""
    cur = conn.cursor()
    cur.execute("SELECT id, tenant_id FROM campaigns WHERE status IN ('running', 'scheduled')")
    processed = 0
    for row in cur.fetchall():
        res = CampaignService.process_due_retries(conn, row["tenant_id"], row["id"])
        processed += int(res.get("requeued_count", res.get("dispatched", 0)))
    return processed


def process_due_scheduled_calls(conn) -> int:
    """Atomically claim and dispatch persisted delayed intake calls whose scheduled_for timestamp is due."""
    now_iso = datetime.now(timezone.utc).isoformat()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM scheduled_calls WHERE status = 'pending' AND scheduled_for <= ? ORDER BY scheduled_for ASC LIMIT 50",
        (now_iso,),
    )
    candidates = cur.fetchall()
    dispatched = 0
    for row in candidates:
        cur.execute(
            "UPDATE scheduled_calls SET status = 'processing' WHERE id = ? AND status = 'pending'",
            (row["id"],),
        )
        if cur.rowcount == 0:
            continue
        conn.commit()
        try:
            call_res = execute_delayed_intake_call(
                tenant_id=row["tenant_id"],
                lead_id=row["lead_id"],
                contact_name=row["contact_name"],
                phone=row["phone"],
                language=row["language"],
                agent_id=row["agent_id"],
                call_category=row["call_category"],
                is_sandbox=bool(row["is_sandbox"]),
            )
            cur.execute(
                "UPDATE scheduled_calls SET status = 'dispatched', call_id = ? WHERE id = ?",
                (call_res.get("call_id"), row["id"]),
            )
            dispatched += 1
        except Exception as exc:
            cur.execute(
                "UPDATE scheduled_calls SET status = 'failed', last_error = ? WHERE id = ?",
                (str(exc)[:200], row["id"]),
            )
    conn.commit()
    return dispatched


def run_worker_tick(conn) -> Dict[str, int]:
    activated = activate_due_scheduled_campaigns(conn)
    requeued = process_due_retries_tick(conn)
    delayed_dispatched = process_due_scheduled_calls(conn)
    advanced = 0
    cur = conn.cursor()
    cur.execute("SELECT id, tenant_id FROM campaigns WHERE status = 'running'")
    for row in cur.fetchall():
        CampaignService.advance_campaign_queue(conn, row["tenant_id"], row["id"])
        advanced += 1
    return {
        "activated": activated,
        "requeued": requeued,
        "delayed_dispatched": delayed_dispatched,
        "advanced_campaigns": advanced,
    }


def run_worker_loop():
    """Standalone polling loop for environments running `python -m worker.tasks`."""
    logger.info(
        "Starting Trivaana AI Background Worker (Redis=%s, Celery=%s)",
        settings.has_redis,
        celery_app is not None,
    )
    while True:
        try:
            conn = get_connection()
            try:
                run_worker_tick(conn)
            finally:
                conn.close()
        except Exception as exc:
            logger.exception("Worker loop error: %s", exc)
        time.sleep(5)


if __name__ == "__main__":
    run_worker_loop()
