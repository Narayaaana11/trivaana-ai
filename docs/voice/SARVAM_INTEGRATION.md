# Sarvam AI Integration Architecture (Trivaana AI)

## 1. Design Principles
- **Strict Provider Isolation:** Sarvam AI and ElevenLabs are completely independent providers. Voice IDs, model IDs, and credentials are never mixed, and there are zero silent cross-provider fallbacks or silent model downgrades.
- **No Browser `speechSynthesis`:** All voice previews and live call synthesis use real neural audio from Sarvam AI (`bulbul:v3`, `bulbul:v4-flash`) or ElevenLabs.
- **Strict Validation:** Deprecated `bulbul:v2`, speaker/model mismatches (e.g., `bulbul:v3` speaker with `bulbul:v4-flash` or vice versa), and unsupported locales (`as-IN`, `ur-IN`) raise explicit validation errors (`400 Bad Request`).

## 2. Backend Components
- `backend/providers/voice_adapters.py`:
  - `SarvamVoiceProvider`: `verify_credentials()`, `discover_models()`, `discover_voices()`, `map_language_code()` (`or-IN` -> `od-IN`), `synthesize_speech()` (with `TTSCache` + inflight deduplication lock, retries, timeouts, typed auth/rate-limit/validation errors), and `synthesize_speech_ws()` (`AsyncSarvamAI.text_to_speech_streaming`).
  - `SarvamSTTProvider`: `saaras:v4` / `saaras:v3` transcription with `transcribe`, `translate`, `verbatim`, `translit`, and `codemix` modes.
- `backend/services/voice_ecosystem_service.py`:
  - `VoiceSelectionService.get_model_catalog(conn, provider=None)` includes both ElevenLabs and Sarvam models.
  - `VoiceSelectionService.select_sarvam_model_and_settings(...)` maps quality profile + personality + speaker compatibility.
  - `VoiceSyncService.sync_sarvam_catalog(conn)` syncs `2` models and `52` voices (`37` `bulbul:v3` + `15` `bulbul:v4-flash`) into `voice_models_catalog` and `voice_profiles`.
- `backend/routers/voices.py`:
  - `GET /api/voices/languages` (`sarvam_supported` flag)
  - `GET /api/voices/models?provider=...`
  - `GET /api/voices/verify?provider=...` (live verification for both providers)
  - `POST /api/voices/sync` (syncs both ElevenLabs & Sarvam)
  - `POST /api/voices/preview` (real Sarvam MP3 synthesis + `VoiceUsageService` metering)
- `backend/routers/integrations.py`:
  - `POST /api/integrations/sarvam/test` runs live `SarvamVoiceProvider.verify_credentials()` and returns model/speaker/STT details.
- `backend/voice_engine/pipeline.py` & `backend/voice_engine/livekit_agent_worker.py`:
  - Call execution pipeline synthesizes Sarvam audio (`linear16`/`8000` Hz for telephony, `mp3`/`22050` Hz for browser) and records `VoiceUsageService.record_usage(..., call_id=call_id)`.
  - LiveKit worker uses `bulbul:v3` TTS (default speaker `shubh`) and `saaras:v4` STT.

## 3. Frontend Components
- `frontend/src/lib/trivaana-api.ts`: Provider-aware `getVoiceModels(provider?)` and `verifyVoiceProviders(provider?)`.
- `frontend/src/components/dashboard/VoiceStudioPanel.tsx`: Provider filter (`All Providers`, `Sarvam AI`, `ElevenLabs`), live connection status pills for both providers, and provider-scoped TTS model dropdown.
- `frontend/src/components/dashboard/AgentStudioPanel.tsx`: Sarvam AI provider selection, synced Sarvam speaker cards, and explicit `Sarvam TTS Model` selector (`bulbul:v3` / `bulbul:v4-flash`).
- `frontend/src/components/dashboard/IntegrationsPanel.tsx`: Live test button displaying verified Sarvam TTS & STT models.
- `frontend/src/components/landing/VoiceShowcaseSection.tsx`: 2 verified Sarvam `bulbul:v3` audio showcase cards (`Priya · Sarvam AI` in `hi-IN` and `Shubh · Sarvam AI` in `te-IN`) backed by real `/audio/sarvam-priya.mp3` and `/audio/sarvam-shubh.mp3`.

