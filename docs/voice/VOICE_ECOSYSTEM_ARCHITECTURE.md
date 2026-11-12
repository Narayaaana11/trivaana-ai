# Trivaana AI — Voice Ecosystem Architecture

## 1. End-to-End Voice Pipeline
Trivaana AI integrates ElevenLabs as its primary neural TTS provider across all customer-facing voice touchpoints while keeping modular provider interfaces (`BaseVoiceProvider`) for future multi-provider routing:

```text
Caller Audio / Text
  └─> Telephony Media Stream (Exotel / Twilio / Plivo / Vobiz) or LiveKit WebRTC
        └─> STT + Language Hint Detection (`backend/voice_engine/pipeline.py`)
              └─> Knowledge Base RAG + Caller Memory + LLM Reasoning (`AIPromptService`)
                    └─> Intelligent Voice Selection (`VoiceSelectionService`)
                          ├─> Quality/Cost Profile: economy | balanced | premium
                          ├─> 8 Personalities + 13-Language Indian Tuning
                          └─> Content-Addressed TTS Cache (`tts_cache.py`)
                                └─> `ElevenLabsVoiceProvider` (REST / Stream / pcm_8000)
                                      └─> `VoiceUsageService` (`voice_usage_logs`)
```

## 2. Backend Modules
- **Provider Adapter (`backend/providers/voice_adapters.py`):**
  - `ElevenLabsVoiceProvider`: authenticates via `ELEVENLABS_API_KEY` (`xi-api-key`), implements `verify_credentials()`, `discover_models()`, `discover_voices()`, `synthesize_speech()`, and `synthesize_stream()`, with explicit exception classes (`VoiceProviderAuthError`, `VoiceProviderPlanError`, `VoiceProviderRateLimitError`, `VoiceProviderValidationError`).
- **Ecosystem Services (`backend/services/voice_ecosystem_service.py`):**
  - `VoiceSelectionService`: selects eligible ElevenLabs model (`eleven_flash_v2_5`, `eleven_v4_turbo`, `eleven_v4`, `eleven_v3_conversational`, etc.) based on target Indian language, quality profile (`economy`, `balanced`, `premium`), and 8 calibrated voice personalities (`professional`, `friendly`, `conversational`, `warm`, `energetic`, `calm`, `formal`, `sales_oriented`).
  - `VoiceSyncService`: synchronizes real `/v1/models` and `/v1/voices` into `voice_models` and `voice_profiles` tables without inventing voice IDs.
  - `VoiceUsageService`: logs character-level usage, cache hits, estimated vs actual cost, and latency per tenant, agent, campaign, and call into `voice_usage_logs`.
- **API Router (`backend/routers/voices.py`):**
  - `GET /api/voices/languages` (13 Indian languages with model recommendations)
  - `GET /api/voices/models` (discovered models + Economy/Balanced/Premium profiles)
  - `GET /api/voices/personalities` (8 calibrated conversational personalities)
  - `GET /api/voices/verify` (live credential verification)
  - `POST /api/voices/sync` (on-demand catalog sync)
  - `GET /api/voices`, `POST/DELETE /api/voices/{id}/favorite`, `POST /api/voices/preview`, `GET /api/voices/usage`, `POST /api/voices/{id}/test`.
- **Database Tables (`backend/database/schema.py`):**
  - Extended `voice_profiles` and `agents` (backward-compatible `_safe_add_columns` migrations), plus `voice_models`, `voice_favorites`, and `voice_usage_logs`.

## 3. Frontend & Calling Integration
- **Voice Studio (`frontend/src/components/dashboard/VoiceStudioPanel.tsx`, `#/voices`):** Live catalog search, 13-language filter, category/favorites filter, side-by-side comparison, native/Romanised/code-switch quick test bench, Economy/Balanced/Premium selector, usage telemetry, and direct AI Employee assignment.
- **AI Employee Studio (`frontend/src/components/dashboard/AgentStudioPanel.tsx`):** Configures provider, `quality_profile`, `voice_personality`, `voice_id`, `language`, and speaking speed.
- **Real-Time Calling (`backend/voice_engine/pipeline.py` & `livekit_agent_worker.py`):** Uses `VoiceSelectionService` + `ElevenLabsVoiceProvider` (`pcm_8000` for telephony WebSockets; `livekit.plugins.elevenlabs.TTS` for LiveKit rooms) and records every synthesized turn in `voice_usage_logs`.

