"""
TRIVAANA AI: LiveKit Agents Standalone Worker Entrypoint
Run in production when LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and OPENAI_API_KEY are configured.
"""

import os
import json
import logging

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
        "sip_configured": bool(os.environ.get("LIVEKIT_SIP_CONFIG")),
    }


def run_worker():
    """Start the LiveKit Voice Agent worker process."""
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
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        metadata = {}
        if ctx.room.metadata:
            try:
                metadata = json.loads(ctx.room.metadata)
            except Exception:
                pass

        instructions = metadata.get(
            "system_prompt",
            "You are a helpful, concise Trivaana AI voice employee. Assist the caller politely.",
        )
        lang = metadata.get("language", "te-IN")
        provider = str(metadata.get("provider", "sarvam")).lower()
        voice_id = metadata.get("voice_id", "meera" if provider == "sarvam" else "alloy")

        stt_engine = lk_openai.STT()
        tts_engine = lk_openai.TTS(voice=metadata.get("voice_id", "alloy"))

        if provider == "sarvam" and os.environ.get("SARVAM_API_KEY"):
            try:
                from livekit.plugins import sarvam as lk_sarvam  # type: ignore
                stt_engine = lk_sarvam.STT(language=lang)
                tts_engine = lk_sarvam.TTS(target_language_code=lang, speaker=voice_id)
            except ImportError:
                logger.warning("livekit-plugins-sarvam not installed; falling back to OpenAI STT/TTS.")

        session = AgentSession(
            stt=stt_engine,
            llm=lk_openai.LLM(model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini")),
            tts=tts_engine,
        )
        await session.start(
            room=ctx.room,
            agent=Agent(instructions=instructions),
        )
        greeting = metadata.get("greeting_message")
        if greeting:
            await session.generate_reply(instructions=f"Say this greeting warmly: {greeting}")

    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


if __name__ == "__main__":
    run_worker()

