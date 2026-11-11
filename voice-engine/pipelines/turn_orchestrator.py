"""
TRIVAANA AI: Async Voice Turn Orchestrator
Unified contract shared by LiveKit Agents, Telephony WebSocket Gateway, and Testing Lab.
"""

import asyncio
from typing import Any, Dict, List, Optional
from voice_engine.pipeline import RealtimeVoicePipeline


class AgentTurnOrchestrator:
    @staticmethod
    async def execute_turn(
        conn: Any,
        tenant_id: str,
        agent: Dict[str, Any],
        user_text: Optional[str] = None,
        audio_bytes: Optional[bytes] = None,
        call_id: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        barge_in: bool = False,
        synthesize_audio: bool = True,
        lead_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            RealtimeVoicePipeline.run_turn,
            conn=conn,
            tenant_id=tenant_id,
            agent=agent,
            user_text=user_text,
            audio_bytes=audio_bytes,
            call_id=call_id,
            history=history,
            barge_in=barge_in,
            synthesize_audio=synthesize_audio,
            lead_context=lead_context,
        )

