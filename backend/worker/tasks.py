"""
TRIVAANA AI: Background Worker & Durable Task Dispatcher
Supports Celery + Redis when configured, plus standalone scheduled campaign activation,
automatic due-retry ticking, and running campaign queue progression.
"""

from datetime import datetime, timezone
import logging
import time
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
        return app
    except ImportError:
        return None


celery_app = create_celery_app()


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
        processed += int(res.get("requeued_count", 0))
    return processed


def run_worker_tick(conn) -> Dict[str, int]:
    activated = activate_due_scheduled_campaigns(conn)
    requeued = process_due_retries_tick(conn)
    advanced = 0
    cur = conn.cursor()
    cur.execute("SELECT id, tenant_id FROM campaigns WHERE status = 'running'")
    for row in cur.fetchall():
        CampaignService.advance_campaign_queue(conn, row["tenant_id"], row["id"])
        advanced += 1
    return {"activated": activated, "requeued": requeued, "advanced_campaigns": advanced}


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
