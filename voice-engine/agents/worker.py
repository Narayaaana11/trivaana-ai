"""
TRIVAANA AI: Standalone Voice Engine Worker Entrypoint
Runs LiveKit Agents worker as an independent deployable process (`voice-engine/`).
"""

import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from voice_engine.livekit_agent_worker import get_worker_capabilities, run_worker  # noqa: E402

__all__ = ["get_worker_capabilities", "run_worker"]

if __name__ == "__main__":
    os.environ.setdefault("TRIVAANA_SERVICE_NAME", "trivaana-voice-engine")
    run_worker()

