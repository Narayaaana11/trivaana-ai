"""
TRIVAANA AI: LiveKit Agents Standalone Worker Entrypoint
Run in production when LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and OPENAI_API_KEY are configured.
"""

import os
import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("trivaana.livekit.worker")


def get_worker_capabilities() -> dict:
    """Inspect whether livekit-agents SDK is installed and environment is configured."""
    try:
        import livekit.agents  # type: ignore  # noqa: F401
        sdk_installed = True
    except ImportError:
        sdk_installed = False

    return {
        "sdk_installed": sdk_installed,
        "livekit_configured": bool(
            os.environ.get("LIVEKIT_URL")
            and os.environ.get("LIVEKIT_API_KEY")
            and os.environ.get("LIVEKIT_API_SECRET")
        ),
        "openai_configured": bool(os.environ.get("OPENAI_API_KEY")),
        "gemini_configured": bool(os.environ.get("GEMINI_API_KEY")),
        "sarvam_configured": bool(os.environ.get("SARVAM_API_KEY")),
        "sip_configured": bool(os.environ.get("LIVEKIT_SIP_CONFIG")),
    }


def build_agent_context_instructions(metadata: dict) -> str:
    """Enrich LiveKit agent instructions with Knowledge Base RAG chunks from PostgreSQL/SQLite."""
    base_instructions = metadata.get(
        "system_prompt",
        "You are a helpful, concise Trivaana AI voice employee. Assist the caller politely.",
    )
    tenant_id = metadata.get("tenant_id")
    agent_id = metadata.get("agent_id")
    if not tenant_id:
        return base_instructions
    try:
        from database import get_connection
        from services.knowledge_service import KnowledgeService

        conn = get_connection()
        try:
            hits = KnowledgeService.search(
                conn=conn,
                tenant_id=tenant_id,
                query=metadata.get("rag_seed_query") or base_instructions[:200],
                agent_id=agent_id,
                top_k=4,
            )
        finally:
            conn.close()
        if hits:
            kb_block = "\n".join(f"- [{h['title']}]: {h['content']}" for h in hits)
            return f"{base_instructions}\n\nVerified Business Knowledge:\n{kb_block}"
    except Exception as exc:
        logger.warning("Failed to preload KB context for LiveKit agent: %s", exc)
    return base_instructions


def finalize_call_session(
    conn,
    call_id: str,
    tenant_id: str,
    duration_seconds: int = 0,
    transcript_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist completed LiveKit session status, transcript, and idempotent usage billing."""
    from datetime import datetime, timezone
    from services.billing_service import BillingService, InsufficientBalanceError

    now = datetime.now(timezone.utc).isoformat()
    cur = conn.cursor()
    cur.execute("SELECT * FROM calls WHERE id = ? AND tenant_id = ?", (call_id, tenant_id))
    call = cur.fetchone()
    if not call:
        return {"updated": False, "reason": "call_not_found"}

    dur = max(0, int(duration_seconds or 0))
    billable_seconds = 0
    cost_paise = 0
    if dur > 0 and not call["is_sandbox"]:
        agent_rate = BillingService.get_agent_call_rate(conn, call["agent_id"])
        cost_info = BillingService.calculate_call_cost(
            duration_seconds=dur,
            rate_paise_per_min=agent_rate["rate_paise_per_min"],
            connected=True,
            increment_seconds=agent_rate["increment_seconds"],
        )
        billable_seconds = cost_info["billable_seconds"]
        cost_paise = cost_info["cost_paise"]
        if cost_paise > 0 and (call["cost_paise"] or 0) == 0:
            try:
                BillingService.debit_wallet(
                    conn=conn,
                    tenant_id=tenant_id,
                    amount_paise=cost_paise,
                    description=f"LiveKit Call usage: {call['contact_name']} ({call['phone']}) - {dur}s",
                    idempotency_key=f"call_debit_{call_id}",
                    invoice_id=f"INV-CALL-{call_id[-6:].upper()}",
                    commit=False,
                )
            except InsufficientBalanceError:
                pass

    cur.execute(
        """
        UPDATE calls
        SET status = 'completed',
            duration_seconds = CASE WHEN COALESCE(duration_seconds, 0) < ? THEN ? ELSE duration_seconds END,
            billable_duration_seconds = CASE WHEN COALESCE(billable_duration_seconds, 0) < ? THEN ? ELSE billable_duration_seconds END,
            cost_paise = CASE WHEN COALESCE(cost_paise, 0) < ? THEN ? ELSE cost_paise END,
            transcript = COALESCE(?, transcript),
            ended_at = ?
        WHERE id = ? AND tenant_id = ?
        """,
        (dur, dur, billable_seconds, billable_seconds, cost_paise, cost_paise, transcript_text, now, call_id, tenant_id),
    )
    conn.commit()
    return {"updated": True, "call_id": call_id, "billable_seconds": billable_seconds, "cost_paise": cost_paise}


def run_worker():
    """Start the LiveKit Voice Agent worker process."""
    import sys
    import time

    caps = get_worker_capabilities()
    if not caps["sdk_installed"]:
        raise RuntimeError(
            "livekit-agents package is not installed. Install livekit-agents and livekit-plugins-openai "
            "or run via the Docker worker container."
        )
    if not caps["livekit_configured"]:
        raise RuntimeError("LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are required to start the LiveKit worker.")

    from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli  # type: ignore
    from livekit.agents.voice import Agent, AgentSession  # type: ignore
    from livekit.plugins import openai as lk_openai  # type: ignore

    async def entrypoint(ctx: JobContext):
        started_at = time.monotonic()
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        metadata = {}
        if ctx.room.metadata:
            try:
                metadata = json.loads(ctx.room.metadata)
            except Exception:
                pass

        instructions = build_agent_context_instructions(metadata)
        lang = metadata.get("language", "te-IN")
        provider = str(metadata.get("provider", "sarvam")).lower()
        voice_id = metadata.get("voice_id", "meera" if provider == "sarvam" else "alloy")

        stt_engine = lk_openai.STT()
        tts_engine = lk_openai.TTS(voice=metadata.get("voice_id", "alloy"))
        llm_engine = None

        if os.environ.get("GEMINI_API_KEY"):
            try:
                from livekit.plugins import google as lk_google  # type: ignore
                llm_engine = lk_google.LLM(model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
            except ImportError:
                logger.warning("livekit-plugins-google not installed; falling back to OpenAI LLM.")

        if llm_engine is None:
            llm_engine = lk_openai.LLM(model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"))

        if provider == "elevenlabs" and os.environ.get("ELEVENLABS_API_KEY"):
            try:
                from livekit.plugins import elevenlabs as lk_elevenlabs  # type: ignore
                from services.voice_ecosystem_service import VoiceSelectionService

                sel = VoiceSelectionService.select_model_and_settings(
                    language=lang,
                    quality_profile=metadata.get("quality_profile") or "balanced",
                    personality=metadata.get("voice_personality") or "professional",
                    explicit_model_id=metadata.get("tts_model_id"),
                )
                tts_engine = lk_elevenlabs.TTS(
                    voice_id=voice_id or "EXAVITQu4vr4xnSDxMaL",
                    model=sel["model_id"],
                )
            except ImportError:
                logger.warning("livekit-plugins-elevenlabs not installed; falling back to default TTS.")
        elif provider == "sarvam" and os.environ.get("SARVAM_API_KEY"):
            try:
                from livekit.plugins import sarvam as lk_sarvam  # type: ignore
                stt_engine = lk_sarvam.STT(language=lang)
                tts_engine = lk_sarvam.TTS(target_language_code=lang, speaker=voice_id)
            except ImportError:
                logger.warning("livekit-plugins-sarvam not installed; falling back to OpenAI STT/TTS.")

        session = AgentSession(
            stt=stt_engine,
            llm=llm_engine,
            tts=tts_engine,
        )
        call_id = metadata.get("call_id")
        tenant_id = metadata.get("tenant_id")
        if call_id and tenant_id:
            try:
                from database import get_connection
                conn = get_connection()
                try:
                    conn.execute(
                        "UPDATE calls SET status = 'in_progress' WHERE id = ? AND tenant_id = ?",
                        (call_id, tenant_id),
                    )
                    conn.commit()
                finally:
                    conn.close()
            except Exception as exc:
                logger.warning("Failed to update call status for %s: %s", call_id, exc)

        try:
            await session.start(
                room=ctx.room,
                agent=Agent(instructions=instructions),
            )
            greeting = metadata.get("greeting_message")
            if greeting:
                await session.generate_reply(instructions=f"Say this greeting warmly: {greeting}")
        finally:
            if call_id and tenant_id:
                try:
                    from database import get_connection
                    conn = get_connection()
                    try:
                        finalize_call_session(conn, call_id, tenant_id, duration_seconds=int(time.monotonic() - started_at))
                    finally:
                        conn.close()
                except Exception as exc:
                    logger.warning("Failed to finalize call session for %s: %s", call_id, exc)

    if len(sys.argv) == 1:
        sys.argv.append("start")
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


if __name__ == "__main__":
    run_worker()

