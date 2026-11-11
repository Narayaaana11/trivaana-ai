"""
TRIVAANA AI: Campaign & Delayed Intake Worker Dispatcher
Supports Celery + Redis, AWS SQS, and deterministic inline fallback for local tests.
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from worker.tasks import celery_app, process_campaign_tick, run_worker_loop  # noqa: E402


def enqueue_campaign_advance(tenant_id: str, campaign_id: str) -> Dict[str, Any]:
    if celery_app is not None:
        task = celery_app.send_task("trivaana.process_campaign_tick", args=[tenant_id, campaign_id])
        return {"dispatched": "celery", "task_id": str(task.id)}
    process_campaign_tick(tenant_id, campaign_id)
    return {"dispatched": "inline"}


if __name__ == "__main__":
    os.environ.setdefault("TRIVAANA_SERVICE_NAME", "trivaana-workers")
    run_worker_loop()

