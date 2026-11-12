# TRIVAANA AI — Real Voice Calling & Compliance Gap Report (`HEAD d1d4319`)

**Audit Date:** 2026-11-11  
**Commit:** `d1d4319b47a9fa3bbcec2ac02b4a7eca63e92fff`  
**Scope:** End-to-end call tracing across Instant Lead, Bulk Campaign, Inbound, and Voice Broadcast modes; Exotel/Twilio/Plivo/Vobiz adapters; LiveKit; WebSocket audio pipeline; STT/LLM/TTS; and Indian telecom compliance.

---

## 1. End-to-End Call Pipeline Trace (Ideal vs Actual Code)

```
Lead Intake / Campaign / Inbound
  └─> Compliance Gate (local DNC + IST hours only; NO DLT/NCPR; CSV auto-opted-in)
        └─> CallService.initiate_call() (checks global env keys, ignores per-tenant integrations & kill switch)
              ├─> Twilio: <Gather><Say> -> handle_twiml_gather() -> hardcoded Telugu + <Hangup/> (NO AI loop)
              ├─> Exotel: Calls/connect.json -> passthru returns static JSON WITHOUT StreamUrl
              ├─> Plivo/Vobiz: <Stream> XML -> unauthenticated XML endpoints mint WS tokens
              ├─> LiveKit: standalone worker has NO outbound SIP dial, NO per-turn RAG, NO tools, NO billing
              └─> WS /api/calls/stream/{call_id}: synchronous STT->LLM->TTS on event loop; MP3 sent as PCM16
```

---

## 2. P0 Findings (Critical Release Blockers)

### VOICE-F01 — Voice Broadcast Debits Real Wallet Without Placing Any Calls
- **Severity:** `P0`
- **Source File & Function:** `backend/routers/broadcasts.py:199-260` (`start_broadcast`)
- **Evidence:** When `use_sandbox` is `False` (Exotel or Twilio configured), `start_broadcast` loops over `pending` recipients (`L225-242`), calls `BillingService.debit_wallet(amount_paise=120)` (`L228`), and sets `voice_broadcast_recipients.status = 'playing'` (`L237`) and `voice_broadcasts.status = 'running'` (`L251`) **without ever calling `get_telephony_provider()`, `CallService`, or TTS synthesis**. Also omits `settings.has_plivo` / `settings.has_vobiz` (`L220`) and skips TRAI calling hours.
- **Reproduction:** Create a broadcast with Exotel configured in env -> call `POST /api/broadcasts/{id}/start` -> wallet is debited ₹1.20/recipient while zero carrier HTTP requests occur.
- **Expected Behavior:** Initiate real carrier playback calls (with synthesized/uploaded audio URL), enforce TRAI hours, and debit upon carrier delivery/connect events.
- **Actual Behavior:** Wallet debited immediately with zero telephony calls made.
- **Recommended Fix:** Dispatch real carrier playback calls via telephony provider / worker queue, enforce TRAI 10 AM–6 PM IST window, include Plivo/Vobiz readiness, and debit on carrier status callbacks.
- **Regression Test:** `test_broadcast_start_invokes_telephony_provider_before_debiting`.
- **Acceptance Criteria:** Live broadcast start dials each eligible recipient via configured carrier and only bills verified attempts.

### VOICE-F02 — Twilio Adapter Uses Single-Turn Hardcoded Telugu `<Gather><Say>` Instead of Bidirectional AI Stream
- **Severity:** `P0`
- **Source File & Function:** `backend/providers/twilio_adapter.py:149-188` (`generate_twiml`), `backend/routers/calls.py:461-490` (`handle_twiml_gather`)
- **Evidence:** `generate_twiml` returns `<Gather input="speech" ...><Say voice="Polly.Aditi">` instead of `<Connect><Stream url="wss://.../api/calls/stream/{call_id}?provider=twilio">`, and line `186` hardcodes a Telugu fallback `<Say>` for non-Telugu calls. `handle_twiml_gather` (`calls.py:479, 487`) never invokes `RealtimeVoicePipeline` or `LLMAdapter`; it appends `Agent: ధన్యవాదాలు! మీ వినతి స్వీకరించబడింది.` and returns `<Hangup/>`. Also `twilio_adapter.py:52` falls back to `/api/calls/twiml-default`, which does not exist in `calls.py`.
- **Reproduction:** Answer a Twilio call or POST to `/api/calls/twiml-gather/{id}` with `SpeechResult="What is the 3BHK price?"` -> returns hardcoded Telugu `<Say>` + `<Hangup/>`.
- **Expected Behavior:** Twilio TwiML connects `<Connect><Stream>` to `/api/calls/stream/{call_id}` (or runs `RealtimeVoicePipeline.run_turn` in gather fallback).
- **Actual Behavior:** Every Twilio call ends after one utterance with a hardcoded Telugu sentence.
- **Recommended Fix:** Emit `<Connect><Stream>` with signed `token` in `generate_twiml` (and wire `RealtimeVoicePipeline.run_turn` in `handle_twiml_gather` as fallback).
- **Regression Test:** `test_twilio_twiml_emits_bidirectional_stream_and_gather_uses_pipeline`.
- **Acceptance Criteria:** Twilio calls stream multi-turn audio via `/api/calls/stream/{call_id}` in the agent's configured language.

### VOICE-F03 — MP3 Audio From ElevenLabs / OpenAI Corrupts Telephony WebSocket PCM16/Mu-Law Streams
- **Severity:** `P0`
- **Source File & Function:** `backend/voice_engine/telephony_stream.py:196-202` (`_encode_outbound_media`), `backend/providers/voice_adapters.py:165-225`
- **Evidence:** `ElevenLabsVoiceProvider` (`output_format=mp3_44100_128`, `L161-162`) and `OpenAIVoiceProvider` (`response_format="mp3"`, `L217`) return MP3 bytes. `TelephonyStreamSession._encode_outbound_media` calls `extract_pcm16_from_audio` (`L197`, which only parses `RIFF/WAVE` headers) and passes raw MP3 bytes directly to `pcm16_to_mulaw` (`L199`) or raw PCM16 output (`L201`).
- **Reproduction:** Assign an ElevenLabs or OpenAI voice to an agent and handle a call over `/api/calls/stream/{call_id}` -> outbound audio frames contain distorted static from MP3 compressed bytes treated as PCM16 samples.
- **Expected Behavior:** Request telephony-native PCM/mu-law (`pcm_8000` / `ulaw_8000` on ElevenLabs, `pcm`/`wav` resampled to 8kHz on OpenAI) or decode MP3 to 8kHz mono PCM16 before mu-law/L16 framing.
- **Actual Behavior:** MP3 bytes are framed directly as raw PCM16/mu-law.
- **Recommended Fix:** Request `ulaw_8000`/`pcm_8000` (or transcode/resample to 8kHz mono PCM16) in telephony TTS synthesis.
- **Regression Test:** `test_telephony_stream_validates_pcm_or_transcodes_non_wav_tts`.
- **Acceptance Criteria:** Outbound telephony frames from all configured TTS providers are valid 8kHz mu-law or PCM16 audio.

### VOICE-F04 — Delayed Public Lead Intake Calls Silently Dropped Without Redis/Celery
- **Severity:** `P0`
- **Source File & Function:** `backend/routers/public_intake.py:196-218` (`public_lead_intake`), `backend/worker/tasks.py:73-91` (`schedule_delayed_intake_call`)
- **Evidence:** When `delay_seconds > 0` and `celery_app is None` (`REDIS_URL` unset), `schedule_delayed_intake_call` (`tasks.py:91`) returns `{"status": "scheduled", "task_id": None, "backend": "deferred_queue"}` without inserting any DB job or scheduling any timer.
- **Reproduction:** Call `POST /api/public/lead-intake/{slug}` with `delay_seconds: 15` when `REDIS_URL=""` -> API returns `200 status: "call_scheduled"`, no call is ever placed.
- **Expected Behavior:** Persist delayed intake jobs in DB (e.g. `scheduled_at` in a queue table polled by worker) or return `503` if scheduler backend is unavailable.
- **Actual Behavior:** Returns `"call_scheduled"` and discards the request.
- **Recommended Fix:** Enqueue delayed intake calls into a durable DB table (`scheduled_calls` or `campaign_jobs`) with `scheduled_at` polled by the worker when Celery is unconfigured.
- **Regression Test:** `test_delayed_public_intake_persists_and_executes_without_redis`.
- **Acceptance Criteria:** Delayed calls survive process restarts and are dialed at `now + delay_seconds`.

### VOICE-F05 — No TRAI DLT / NCPR Scrubbing + Unverified Consent Auto-Opt-In
- **Severity:** `P0`
- **Source File & Function:** `backend/services/compliance_service.py:83-145`, `backend/services/lead_service.py:95-98`, `backend/routers/leads.py:179, 334, 447`, `backend/routers/calls.py:345`
- **Evidence:** `ComplianceService.is_suppressed` checks only workspace-local tables; zero DLT entity/header/template registration verification or NCPR/NDNC registry integration exists. `compliance_policies` columns (`enforce_dnd_scrubbing`, `require_explicit_consent`, `require_recording_disclosure`, `approved_series_prefix`) are never read by `evaluate_pre_call`. CSV/paste/manual lead creation hardcodes `consent_status='opted_in'`; `/api/calls/instant` never verifies `consent_status == 'opted_in'`.
- **Reproduction:** Import arbitrary numbers via CSV -> `leads.consent_status` is set to `'opted_in'` with zero consent proof and dialed immediately.
- **Expected Behavior:** External NCPR/DLT scrubbing adapter (with explicit `not_configured` status when absent), enforced `compliance_policies`, and `consent_status='pending'` by default on bulk imports.
- **Actual Behavior:** Unverified lists are treated as opted-in; DLT/NCPR compliance is absent.
- **Recommended Fix:** Default imported leads to `'pending'` unless consent evidence is supplied; enforce `compliance_policies` in `evaluate_pre_call`; implement pluggable NCPR/DLT verification gates.
- **Regression Test:** `test_csv_leads_default_pending_and_blocked_without_consent`.
- **Acceptance Criteria:** Automated outbound campaigns refuse contacts lacking verified `consent_records` and DLT/NCPR clearance.

---

## 3. P1 & P2 Voice Pipeline, Adapter, and Mode Gaps

| ID | Sev | Source File & Function | Actual Behavior & Gap | Recommended Fix |
|---|---|---|---|---|
| **VOICE-F06** | `P1` | `backend/voice_engine/livekit_agent_worker.py:35-140`, `routers/voice_engine.py:87-94` | LiveKit worker loads RAG once at join (`L56-62`), registers zero `ActionService` tools, never logs `call_transcripts`, never updates `calls` completion/duration or triggers billing debit, and `LIVEKIT_SIP_CONFIG` (`config.py:137`) has zero SIP outbound/trunk code. `generate_livekit_token` omits `provider` and `call_id` from room metadata. | Wire SIP trunk dispatch, per-turn RAG, `ActionService` tools, transcript persistence, and `CallService.process_call_event` on room close. |
| **VOICE-F07** | `P1` | `backend/providers/exotel_adapter.py:179-239`, `calls.py:493-500`, `inbound.py:148-165` | `generate_passthru_response` returns static JSON without `StreamUrl` (`wss://.../api/calls/stream/{call_id}?token=...`); `verify_request` accepts `"test_exotel_token_valid"` when unconfigured; `verify_webhook` drops query params. | Emit signed `StreamUrl` in Exotel passthru responses and remove hardcoded test-token acceptance. |
| **VOICE-F08** | `P1` | `backend/voice_engine/pipeline.py:45-196`, `telephony_stream.py:238-340`, `calls.py:635` | `calls.py:635` runs synchronous HTTP STT/LLM/TTS on the async WS event loop; `pipeline.py:64` hardcodes `OpenAIWhisperSTT` (ignoring Deepgram/FasterWhisper/IndicConformer); `telephony_stream.py:242` discards custom `greeting_message` by passing `"Caller connected. Deliver greeting."` to LLM; `_build_outbound_frames` sends entire TTS audio in 1 unchunked message instead of 20ms frames; `detect_language_hint` only covers Unicode + ~25 Romanized tokens; `voice-engine/pipelines/turn_orchestrator.py` is unused dead code. | Offload blocking I/O to threads or async streaming clients; chunk outbound audio in 20ms frames; synthesize `greeting_message` directly on `start`. |
| **VOICE-F09** | `P1` | `backend/voice_engine/stt_providers.py:51-109`, `speech_microservice.py:37-66`, `config.py:123` | `DEEPGRAM_API_KEY` (`config.py:123`) and `voice-engine/providers/registry.py` declare Deepgram, yet **no Deepgram STT provider exists**. `FasterWhisperSTT` local mode sets `is_configured=True` (`L61-63`) yet returns `text=""` error (`L77`). `speech_microservice.py:59-66` returns HTTP `503` for IndicF5 and lacks IndicConformer. | Implement `DeepgramSTT`, temp-file audio passing in local `FasterWhisperSTT`, and document/gate IndicF5/IndicConformer endpoints truthfully. |
| **VOICE-F10** | `P1` | `backend/services/campaign_service.py:101-105, 275-279, 323-366, 401, 458`, `worker/tasks.py:144, 155` | `process_due_retries` (`L401`) and `advance_campaign_queue` (`L458`) hardcode `language="te-IN"` instead of resolving agent language; `process_due_retries` ignores `concurrency` and TRAI hours; `worker/tasks.py:144` reads nonexistent `requeued_count`; `run_worker_tick` ignores active call concurrency; `resume_campaign` doesn't dispatch pending jobs; `evaluate_provider_circuit_breaker` is never invoked with HTTP 401/402/403 from `initiate_call`. | Resolve `agent.language`, enforce `concurrency_limit` + TRAI window in retries & worker ticks, dispatch on resume, and wire `requeued_count`/`dispatched` contract. |
| **VOICE-F11** | `P1` | `backend/routers/inbound.py:34-189` | Live Twilio/Exotel inbound webhooks do not connect bidirectional AI streams; Plivo/Vobiz inbound webhooks do not exist; `after_hours_mode="transfer"` (`schema.py:414`) is ignored; inbound Twilio TwiML omits `StatusCallback` (no call-cost billing). | Add `/api/inbound/plivo` & `/vobiz`, connect bidirectional `<Stream>` with `StatusCallback`, and implement `after_hours_mode="transfer"`. |
| **VOICE-F12** | `P2` | `backend/providers/__init__.py:22-36`, `voice_adapters.py:54, 192-227` | Per-tenant credentials stored in `integrations` are ignored by `get_telephony_provider` / `get_voice_provider`; `OpenAIVoiceProvider` bypasses `tts_cache`; `SarvamVoiceProvider.synthesize_speech_ws` is dead code; `calls.py:441-443` omits Plivo/Vobiz `CallUUID` lookup in `carrier_callback`; `calls.py:287` post-call `/analyze` ignores Gemini. | Support per-tenant decrypted credentials, cache OpenAI TTS, add `CallUUID` lookup, and route `/analyze` through `LLMAdapter`. |

---

## 4. Verification Summary for Real Voice Calling

- **Sandbox/Mock Simulation:** `VERIFIED_WORKING` in CI (`test_voice_flow.py`, `test_oss_integrations.py`, `test_calls.py`).
- **Live PSTN End-to-End (Exotel / Twilio / Plivo / Vobiz / LiveKit SIP):** `NOT_VERIFIED` and currently blocked by `VOICE-F01` through `VOICE-F12`.
- **Recommendation Before First Live Customer Call:** Fix `VOICE-F01`–`VOICE-F11`, then run an explicit end-to-end call verification test on staging with one configured carrier (e.g., Exotel or Plivo), one configured TTS/STT/LLM pair, and verify transcript, tool execution, call completion callback, and exact wallet debit.

