# Real ElevenLabs TTS Implementation

## Architecture Flow
1. **Preview & Testing (`VoiceStudioPanel.tsx` -> `POST /api/voices/preview`)**:
   - Frontend sends `voice_id`, `provider="elevenlabs"`, `language`, optional explicit `model_id`, `quality_profile`, `personality`, `speed`, and `text` (validated `1..1500` chars).
   - Backend enforces per-tenant rate limiting (`40` req / `60s`), validates model/language compatibility strictly via `VoiceSelectionService.select_model_and_settings`, and calls `ElevenLabsVoiceProvider.synthesize_speech`.
   - `TTSCache` caches audio bytes by `(provider, voice_id:model_id:speed:stability:output_format, language, text)` with per-key in-flight `threading.Lock` deduplication.
   - `VoiceUsageService.record_usage` logs preview requests with `call_id = NULL`, separate from production call minutes (`call_id IS NOT NULL`).
   - No browser `window.speechSynthesis`, OS TTS, or silent fallback is used; errors surface directly to the user.

2. **Real-Time AI Calling (`pipeline.py` & `livekit_agent_worker.py`)**:
   - `StreamingVoicePipeline.synthesize_reply` resolves the assigned agent's `voice_id`, `quality_profile`, `voice_personality`, `speech_rate`, `voice_stability`, `voice_similarity`, `voice_style`, and `tts_model_id` via `VoiceSelectionService`, synthesizes `pcm_8000` audio via `ElevenLabsVoiceProvider` for telephony/SIP, and records call-linked usage (`call_id` set).
   - `LiveKitAgentWorker` configures `livekit.plugins.elevenlabs.TTS(voice_id=..., model=..., api_key=...)` using the agent's selected ElevenLabs voice and model.

3. **Credential Safety**:
   - `ELEVENLABS_API_KEY` is read exclusively on the backend (`core/config.py`) and never returned in `/api/voices/verify`, `/api/voices`, `/api/voices/models`, or `/api/voices/preview` responses.

