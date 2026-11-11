# Smart OSS Integration Plan (Option C — Executed & Staged)

## 1. Completed Integrations in This Release
1. **Exotel Connect Voice AI & Security Hardening** *(from Dograh BSD 2-Clause `exotel/provider.py` + `ws_auth.py`)*
   - Updated `backend/providers/exotel_adapter.py`:
     - Enforced strict Exotel subdomain allowlist (`api.exotel.com`, `api.in.exotel.com`) preventing SSRF.
     - Added `_exotel_dial_number` normalizing Indian `+91` ExoPhone `CallerId` to `0`-prefixed national format while keeping destination `To`/`From` in E.164.
     - Added HMAC-SHA256 `?exotel_auth=` status callback capability token mint/verification and bidirectional `StreamUrl` `?token=` generation.
     - Removed insecure bare-`AccountSid` trust on unauthenticated callbacks.
   - Updated `backend/routers/calls.py`:
     - Passed query parameters into Exotel callback verification.
     - Protected `/api/calls/stream/{call_id}` WebSocket with `verify_stream_token` when Exotel credentials are configured.

2. **Campaign Provider Circuit Breaker** *(from Dograh BSD 2-Clause `circuit_breaker.py`)*
   - Added `CampaignService.evaluate_provider_circuit_breaker` in `backend/services/campaign_service.py` to auto-pause running campaigns when a carrier/AI provider returns HTTP `401 / 402 / 403` or exceeds `60%` terminal failures over >=5 attempts, writing `campaign.circuit_breaker_tripped` into `audit_logs`.

3. **OpenDialer Calling-Days & 24h Per-Phone Cap** *(from OpenDialer MIT `hours.ts` + `COMPLIANCE.md`)*
   - Upgraded `ComplianceService.is_within_calling_hours` to enforce weekday schedules (`Mon`–`Sun`) in IST.
   - Added `ComplianceService.check_daily_call_cap` (3 outbound non-sandbox attempts per 24 hours default) invoked inside `CampaignService.start_campaign`.

4. **LiveKit Agents + Sarvam Indian Multilingual Worker** *(from LiveKit Agents Apache 2.0 `livekit-plugins-sarvam`)*
   - Upgraded `backend/voice_engine/livekit_agent_worker.py` to select `livekit.plugins.sarvam` STT & TTS dynamically when `provider == 'sarvam'` and `SARVAM_API_KEY` is configured, keeping `livekit.plugins.openai` fallback.

5. **Outpero-Matched 6-Event Webhook Form**
   - Upgraded `frontend/src/components/dashboard/IntegrationsPanel.tsx` with the 6 selectable webhook events (`call.completed`, `call.not_connected`, `lead.qualified`, `call.inbound_answered`, `call.inbound_missed`, `campaign.status_changed`) and `Include call transcripts` toggle.

6. **Bidirectional PSTN WebSocket Audio, DTMF, TTS Cache & Sarvam WS Streaming** *(from Bolna MIT + Pipecat/Dograh BSD 2-Clause)*
   - Created `backend/voice_engine/telephony_stream.py` (`mulaw_to_pcm16`, `pcm16_to_mulaw`, `pcm16_to_wav`, RMS VAD, barge-in `clear` event, `DtmfAccumulator`, `TelephonyStreamSession`) wired into `/api/calls/stream/{call_id}` in `backend/routers/calls.py`.
   - Created `backend/voice_engine/tts_cache.py` (`TTSCache` SHA-256 disk/memory cache) and added `SarvamVoiceProvider.synthesize_speech_ws` in `backend/providers/voice_adapters.py`.

7. **Plivo & Vobiz Telephony Providers, Owned-Number Verify, Warm Transfer & CRM Disposition Mapping** *(from Dograh BSD 2-Clause + Bolna MIT)*
   - Created `backend/providers/plivo_adapter.py`, `backend/providers/vobiz_adapter.py`, `ExotelTelephonyProvider.verify_phone_numbers()`, `/api/phone-numbers/verify`, `/api/calls/{call_id}/transfer`, `backend/services/disposition_service.py` (`/api/compliance/dispositions`), and UI wiring in `PhoneNumbersPanel.tsx`, `CallIntelligencePanel.tsx`, `SettingsPanel.tsx`, and `LeadManagementPanel.tsx` CSV Column Mapper modal.

8. **Infrastructure Readiness: `.env.local` Auto-Load, PostgreSQL Compat Driver, Scheduled Worker, SMTP & Rate Limiting**
   - Added `.env`/`.env.local` loader in `backend/core/config.py`, `PostgresCompatConnection` + `pgvector` search hook in `backend/database/connection.py` & `knowledge_service.py`, `RateLimitMiddleware` (`backend/core/rate_limit.py`) + Nginx `limit_req_zone`, transactional SMTP (`backend/services/email_service.py`), scheduled campaign + retry tick in `backend/worker/tasks.py`, and vendor chunk splitting in `frontend/vite.config.ts`.

---

## 2. Optional Production Deployment Add-Ons (Credential/GPU-Activated)
1. **LiveKit + Sarvam SIP Worker Container**: Install `livekit-agents`, `livekit-plugins-openai`, `livekit-plugins-sarvam` (all Apache 2.0) in the worker container alongside `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `SARVAM_API_KEY`, and `OPENAI_API_KEY`.
2. **Self-Hosted Indian ASR/TTS Microservices (Optional Cost Optimization)**:
   - Deploy `faster-whisper` (MIT) or `IndicConformerASR` (MIT + NeMo GPU) behind `FASTER_WHISPER_BASE_URL` / `INDICCONFORMER_BASE_URL`.
   - Deploy `IndicF5` **only** via operator-managed external endpoint (`INDICF5_BASE_URL`) after confirming dataset license suitability; keep excluded from core Trivaana bundles.

