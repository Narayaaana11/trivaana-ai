"""
TRIVAANA AI: Real-Time Voice Pipeline & Latency Benchmarking
Orchestrates: Audio -> STT -> Language Detection -> KB + Caller Memory -> LLM -> Action Execution -> TTS.
"""

import base64
import json
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from core.config import settings
from providers.voice_adapters import get_voice_provider
from services.ai_prompt_service import AIPromptService
from voice_engine.stt_providers import get_stt_provider


class RealtimeVoicePipeline:
    @staticmethod
    def detect_language_hint(text: str, default_lang: str = "en-IN") -> str:
        if any("\u0C00" <= ch <= "\u0C7F" for ch in text):
            return "te-IN"
        if any("\u0900" <= ch <= "\u097F" for ch in text):
            return "hi-IN"
        if any("\u0B80" <= ch <= "\u0BFF" for ch in text):
            return "ta-IN"
        if any("\u0C80" <= ch <= "\u0CFF" for ch in text):
            return "kn-IN"
        if any("\u0D00" <= ch <= "\u0D7F" for ch in text):
            return "ml-IN"
        tokens = set((text or "").lower().split())
        if tokens & {"naku", "cheppandi", "kavali", "meeru", "entha", "ekkada", "andhuke", "raadhu"}:
            return "te-IN"
        if tokens & {"mujhe", "chahiye", "namaste", "kya", "kitna", "aap", "bataiye", "nahi"}:
            return "hi-IN"
        if tokens & {"vanakkam", "venum", "sollunga", "epdi", "enna"}:
            return "ta-IN"
        if tokens & {"please", "stop", "remove", "connect", "manager", "human", "hello", "pricing", "price"}:
            return "en-IN"
        return default_lang

    @staticmethod
    def run_turn(
        conn: sqlite3.Connection,
        tenant_id: str,
        agent: Dict[str, Any],
        user_text: Optional[str] = None,
        audio_bytes: Optional[bytes] = None,
        call_id: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        barge_in: bool = False,
        synthesize_audio: bool = True,
        lead_context: Optional[Dict[str, Any]] = None,
        telephony_audio: bool = False,
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()
        stt_ms = 0
        transcript_text = (user_text or "").strip()

        # 1. STT if audio bytes provided
        if audio_bytes and not transcript_text:
            t_stt = time.perf_counter()
            stt = get_stt_provider()
            stt_res = stt.transcribe(audio_bytes, language=agent.get("language", "en-IN"))
            transcript_text = stt_res.get("text", "")
            stt_ms = int((time.perf_counter() - t_stt) * 1000)

        # 2. Language detection
        detected_lang = RealtimeVoicePipeline.detect_language_hint(
            transcript_text, default_lang=agent.get("language", "en-IN")
        )

        # 3. Caller memory recall if opt-in enabled on agent
        memory_context = {}
        caller_phone = (lead_context or {}).get("phone")
        if agent.get("caller_memory_enabled") and caller_phone:
            cur = conn.cursor()
            cur.execute(
                "SELECT summary, preferences_json, last_appointment FROM caller_memories WHERE tenant_id = ? AND phone = ?",
                (tenant_id, caller_phone),
            )
            mem = cur.fetchone()
            if mem:
                memory_context = {
                    "previous_summary": mem["summary"],
                    "preferences": json.loads(mem["preferences_json"] or "{}"),
                    "last_appointment": mem["last_appointment"],
                }

        # 4. Reasoning + KB retrieval
        t_llm = time.perf_counter()
        merged_context = {**(lead_context or {}), **({"caller_memory": memory_context} if memory_context else {})}
        turn_res = AIPromptService.simulate_agent_turn(
            conn=conn,
            tenant_id=tenant_id,
            agent=agent,
            user_message=transcript_text or "Hello",
            history=history or [],
            lead_context=merged_context,
        )
        llm_ms = int((time.perf_counter() - t_llm) * 1000)
        reply_text = turn_res["reply"]

        # 5. TTS Synthesis (with intelligent model selection & usage metering)
        t_tts = time.perf_counter()
        tts_provider_name = agent.get("provider", "sarvam")
        tts_provider = get_voice_provider(tts_provider_name)
        audio_b64 = None
        tts_mode = "browser_fallback"
        tts_model_used = None
        if synthesize_audio and getattr(tts_provider, "is_configured", False):
            try:
                from services.voice_ecosystem_service import VoiceSelectionService, VoiceUsageService
                voice_id = agent.get("voice_id") or ("EXAVITQu4vr4xnSDxMaL" if tts_provider_name == "elevenlabs" else "shubh")
                if tts_provider_name == "elevenlabs":
                    selection = VoiceSelectionService.select_model_and_settings(
                        language=detected_lang,
                        quality_profile=agent.get("quality_profile") or "balanced",
                        personality=agent.get("voice_personality") or "professional",
                        speed_override=agent.get("speech_rate"),
                        stability_override=agent.get("voice_stability"),
                        similarity_override=agent.get("voice_similarity"),
                        style_override=agent.get("voice_style"),
                        explicit_model_id=agent.get("tts_model_id"),
                        conn=conn,
                    )
                    tts_model_used = selection["model_id"]
                    vs = selection["voice_settings"]
                    audio_out, tts_meta = tts_provider.synthesize_speech(
                        text=reply_text,
                        language=detected_lang,
                        voice_id=voice_id,
                        stability=vs["stability"],
                        similarity_boost=vs["similarity_boost"],
                        style=vs["style"],
                        speed=vs["speed"],
                        use_speaker_boost=vs["use_speaker_boost"],
                        model_id=tts_model_used,
                        output_format="pcm_8000" if telephony_audio else None,
                        return_metadata=True,
                    )
                    est_paise = VoiceSelectionService.estimate_cost_paise(
                        len(reply_text), selection.get("cost_factor", 1.0)
                    )
                    VoiceUsageService.record_usage(
                        conn=conn,
                        tenant_id=tenant_id,
                        provider="elevenlabs",
                        model_id=tts_model_used,
                        voice_id=voice_id,
                        language=detected_lang,
                        quality_profile=selection["quality_profile"],
                        characters_requested=len(reply_text),
                        cache_hit=bool(tts_meta.get("cache_hit")),
                        latency_ms=int((time.perf_counter() - t_tts) * 1000),
                        provider_characters_reported=tts_meta.get("provider_characters_reported"),
                        estimated_cost_paise=est_paise,
                        agent_id=agent.get("id"),
                        call_id=call_id,
                    )
                elif tts_provider_name == "sarvam":
                    selection = VoiceSelectionService.select_sarvam_model_and_settings(
                        language=detected_lang,
                        quality_profile=agent.get("quality_profile") or "balanced",
                        personality=agent.get("voice_personality") or "professional",
                        speaker_id=voice_id,
                        speed_override=agent.get("speech_rate"),
                        explicit_model_id=agent.get("tts_model_id"),
                        conn=conn,
                    )
                    tts_model_used = selection["model_id"]
                    audio_out, tts_meta = tts_provider.synthesize_speech(
                        text=reply_text,
                        language=detected_lang,
                        voice_id=voice_id,
                        speed=selection["voice_settings"]["speed"],
                        model_id=tts_model_used,
                        output_audio_codec="linear16" if telephony_audio else "mp3",
                        speech_sample_rate=8000 if telephony_audio else 22050,
                        return_metadata=True,
                    )
                    est_paise = VoiceSelectionService.estimate_cost_paise(
                        len(reply_text), selection.get("cost_factor", 1.0)
                    )
                    VoiceUsageService.record_usage(
                        conn=conn,
                        tenant_id=tenant_id,
                        provider="sarvam",
                        model_id=tts_model_used,
                        voice_id=voice_id,
                        language=detected_lang,
                        quality_profile=selection["quality_profile"],
                        characters_requested=len(reply_text),
                        cache_hit=bool(tts_meta.get("cache_hit")),
                        latency_ms=int((time.perf_counter() - t_tts) * 1000),
                        provider_characters_reported=tts_meta.get("provider_characters_reported"),
                        estimated_cost_paise=est_paise,
                        agent_id=agent.get("id"),
                        call_id=call_id,
                    )
                elif telephony_audio and tts_provider_name == "openai":
                    pcm_24k = tts_provider.synthesize_speech(
                        text=reply_text,
                        language=detected_lang,
                        voice_id=voice_id,
                        response_format="pcm",
                    )
                    audio_out = b"".join(
                        pcm_24k[i : i + 2] for i in range(0, len(pcm_24k) - 1, 6)
                    )
                else:
                    audio_out = tts_provider.synthesize_speech(
                        text=reply_text,
                        language=detected_lang,
                        voice_id=voice_id,
                    )
                audio_b64 = base64.b64encode(audio_out).decode("ascii")
                tts_mode = tts_provider_name
            except Exception:
                tts_mode = "synthesis_error_fallback"
        tts_ms = int((time.perf_counter() - t_tts) * 1000)
        total_ms = int((time.perf_counter() - t0) * 1000)

        # 6. Persist turn transcripts, automatic opt-out DNC, & mid-call transfer action
        if turn_res.get("opt_out_detected") and caller_phone:
            try:
                from services.compliance_service import ComplianceService
                ComplianceService.add_dnc(
                    conn,
                    tenant_id,
                    caller_phone,
                    reason="Caller requested opt-out during live voice turn",
                    source="voice_turn_auto",
                )
            except Exception:
                pass

        action_events: List[Dict[str, Any]] = []
        if call_id and turn_res.get("transfer_requested") and agent.get("transfer_number"):
            try:
                from services.action_service import ActionService
                act_res = ActionService.execute_action(
                    conn=conn,
                    tenant_id=tenant_id,
                    call_id=call_id,
                    action_type="call_transfer",
                    action_name="Auto Warm Transfer",
                    arguments={"transfer_number": agent["transfer_number"]},
                    agent_id=agent.get("id"),
                    is_sandbox=not bool(settings.has_exotel or settings.has_twilio or settings.has_plivo),
                )
                action_events.append(act_res)
            except Exception:
                pass

        if call_id and turn_res.get("action_calls"):
            enabled_actions = {
                a["action_type"]: a for a in (turn_res.get("available_actions") or [])
            }
            for ac in turn_res["action_calls"]:
                atype = ac.get("action_type")
                if atype in enabled_actions:
                    try:
                        from services.action_service import ActionService
                        act_res = ActionService.execute_action(
                            conn=conn,
                            tenant_id=tenant_id,
                            call_id=call_id,
                            action_type=atype,
                            action_name=ac.get("action_name") or enabled_actions[atype]["name"],
                            arguments=dict(ac.get("arguments") or {}),
                            agent_id=agent.get("id"),
                            action_id=enabled_actions[atype]["id"],
                            is_sandbox=not bool(settings.has_exotel or settings.has_twilio or settings.has_plivo),
                        )
                        action_events.append(act_res)
                    except Exception:
                        pass

        if call_id:
            cur = conn.cursor()
            now = datetime.now(timezone.utc).isoformat()
            if transcript_text:
                cur.execute(
                    """
                    INSERT INTO call_transcripts (id, call_id, tenant_id, speaker, message, timestamp_ms, language, created_at)
                    VALUES (?, ?, ?, 'caller', ?, ?, ?, ?)
                    """,
                    (f"trn_{uuid.uuid4().hex[:8]}", call_id, tenant_id, transcript_text, total_ms, detected_lang, now),
                )
            cur.execute(
                """
                INSERT INTO call_transcripts (id, call_id, tenant_id, speaker, message, timestamp_ms, language, created_at)
                VALUES (?, ?, ?, 'ai', ?, ?, ?, ?)
                """,
                (f"trn_{uuid.uuid4().hex[:8]}", call_id, tenant_id, reply_text, total_ms, detected_lang, now),
            )
            cur.execute("UPDATE calls SET latency_ms = ? WHERE id = ? AND tenant_id = ?", (total_ms, call_id, tenant_id))
            conn.commit()

        return {
            "user_text": transcript_text,
            "reply_text": reply_text,
            "detected_language": detected_lang,
            "barge_in_handled": barge_in,
            "reasoning_mode": turn_res["mode"],
            "tts_mode": tts_mode,
            "audio_base64": audio_b64,
            "kb_chunks_used": turn_res["kb_chunks_used"],
            "opt_out_detected": turn_res["opt_out_detected"],
            "transfer_requested": turn_res["transfer_requested"],
            "action_events": action_events,
            "latency": {
                "stt_ms": stt_ms,
                "llm_ms": llm_ms,
                "tts_ms": tts_ms,
                "total_ms": total_ms,
            },
        }

