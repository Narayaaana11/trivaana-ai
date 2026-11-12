# TRIVAANA AI — Master Remediation Roadmap (`HEAD d1d4319`)

**Status:** **PENDING USER APPROVAL — NO APPLICATION CODE EDITS MADE YET**  
**Prepared From:** Independent Forensic Audit of commit `d1d4319b47a9fa3bbcec2ac02b4a7eca63e92fff`  
**Primary Milestone Goal:** *"One real AI Employee, one real phone number, one real customer call, one completed business action, one accurate CRM record, and one correct wallet debit."*

---

## Phase 1 — Security, Compliance & Financial Integrity (`P0` Release Blockers)

### 1.1 Auth, RBAC, API Scopes & WebSocket Hardening
- **Fix `SEC-F01` (`/plivo-xml` & `/vobiz-xml` WS Token Oracle):** Require carrier HMAC/capability auth on `/api/calls/twiml/{id}`, `/exotel-passthru/{id}`, `/plivo-xml/{id}`, and `/vobiz-xml/{id}`; bind WS stream tokens to `(call_id, provider, exp)` and verify `call["provider"]` matches query `provider`.
- **Fix `SEC-F02` (API Key Scopes & Legacy Keys):** Enforce `require_scope("<domain>:<action>")` across all routers (fail closed on empty scopes) and deprecate/disable unrevocable `tenants.api_key_hash`.
- **Fix `SEC-F03` (Missing `require_roles`):** Add `require_roles(...)` guards on all ~30+ mutating and spend-generating endpoints (`calls.py`, `campaigns.py`, `broadcasts.py`, `agents.py`, `leads.py`, `phone_numbers.py`, `compliance.py`, `actions.py`, `knowledge.py`, `workflows.py`, `appointments.py`, `integrations.py`, `billing.py`).
- **Fix `SEC-F05`, `SEC-F06`, `SEC-F07`, `SEC-F08`, `SEC-F10`:**
  - Scope `POST /api/inbound/simulate` to `tenant["id"]` before reading/writing DB rows.
  - Require carrier ownership match or staff KYC review before activating `POST /api/phone-numbers`.
  - Apply `token_version`, `users.status`, and `tenants.status` checks to all WebSocket auth paths (`voice_engine.py`, `calls.py`) and `get_current_user`-only endpoints.
  - Enforce `ENCRYPTION_MASTER_KEY` (>=32 chars) in `validate_production_security()`, fail loudly on decryption error instead of returning `""`, remove compose fallback secret bypasses (`SEC-F12`), and gate `dev_*_token` behind explicit debug flag.
  - Pin validated public DNS IPs in `is_safe_public_url` HTTP clients (preventing DNS rebinding) and validate URLs at webhook/action creation.

### 1.2 Billing, Razorpay & Kill Switch Correctness
- **Fix `BILL-F01` & `BILL-F02`:** Replace `requests.get` with `httpx.get` in `backend/providers/razorpay_adapter.py:128`; reject Razorpay sandbox orders & signatures with `503` whenever `ENVIRONMENT in ("production", "prod")`.
- **Fix `BILL-F03` (Emergency Kill Switch):** Enforce `platform_settings['emergency_outbound_pause']` inside `ComplianceService.evaluate_pre_call`, `CallService.initiate_call`, `CampaignService`, and `broadcasts.py`.
- **Fix `BILL-F04`, `BILL-F05`, `BILL-F06`:**
  - Route all call & broadcast pricing through `BillingService.get_pricing_catalog(conn)` (respecting Super Admin tariffs and `RATE_PREMIUM_PAISE_PER_MIN`).
  - Handle `InsufficientBalanceError` gracefully on carrier callbacks so call status/duration/recording always persist; add concurrency balance reservation on `initiate_call`.
  - Add `commit: bool = True` to `BillingService.debit_wallet()` and use `UPDATE ... RETURNING wallet_balance_paise`.
  - Reconcile all 8+ pricing displays (`HeroSection`, `VoiceShowcaseSection`, `PublicPages`, `DocsPortalPage`, `FinancialLedgerPanel`, `PhoneNumbersPanel`, `PricingSection`) against `GET /api/billing/pricing`, and align GST-inclusive vs GST-exclusive checkout math and subscription GST invoices.
- **Fix `BILL-F07` & `BILL-F08`:** Wire `workers/billing/reconciler.py` (`record_provider_cogs`) into call/TTS/STT completion; separate promo/sandbox/subscription/usage categories in `/api/admin/finance/summary`; add monthly number/channel rental billing.

### 1.3 Telecom Consent & PostgreSQL Parity
- **Fix `VOICE-F05` / `SEC-F11` (Consent Integrity):** Change CSV/paste/manual lead import defaults from `consent_status='opted_in'` to `'pending'` unless verifiable consent metadata is provided and recorded in `consent_records`; enforce `compliance_policies` flags (`enforce_dnd_scrubbing`, `require_explicit_consent`, `approved_series_prefix`); restrict `bypass_trai`/`bypass_calling_hours`; add pluggable NCPR/DLT scrubbing adapter.
- **Fix `DB-F01`–`DB-F06` (PostgreSQL Parity):**
  - Replace SQLite-only `MAX(a, b)` in `call_service.py:163-165` with dialect-aware `GREATEST` / `MAX`.
  - Sync `postgres_pgvector_schema.sql` with missing `UNIQUE` constraints (`auth_tokens.token_hash`, `invoices.invoice_number`, `webhook_deliveries.idempotency_key`, `compliance_policies.tenant_id`, `leads(tenant_id, phone)`, `phone_numbers(phone_number)`), and fix `appointments` partial unique index (`WHERE status = 'scheduled'`).
  - Activate PostgreSQL RLS (`SET LOCAL app.current_tenant_id`) on every tenant DB session and cover all tenant tables.
  - Update `.github/workflows/ci.yml` to run `pytest` against the CI PostgreSQL service container.

---

## Phase 2 — Real End-to-End Voice Calling (`P0` / `P1`)

- **Fix `VOICE-F01` (Voice Broadcast):** Wire `start_broadcast` to real telephony playback + TTS synthesis + TRAI hours before billing recipients.
- **Fix `VOICE-F02` (Twilio Bidirectional AI):** Emit `<Connect><Stream>` in `TwilioTelephonyProvider.generate_twiml` and wire `RealtimeVoicePipeline.run_turn` into `handle_twiml_gather` fallback.
- **Fix `VOICE-F03` (Audio Codec Integrity):** Request `ulaw_8000`/`pcm_8000` from ElevenLabs/OpenAI (or transcode MP3 -> 8kHz PCM16) before telephony WS framing; chunk outbound frames to 20ms.
- **Fix `VOICE-F04` & `VOICE-F10` (Worker Queue & Campaign Reliability):** Persist delayed public intake calls in DB when Redis/Celery is absent; align `workers/Dockerfile` with Celery or unified dispatcher; fix `requeued_count` vs `dispatched` mismatch; resolve agent `language` in `process_due_retries` and `advance_campaign_queue`; enforce concurrency & TRAI window in worker ticks; wire HTTP 401/402/403 circuit breaker.
- **Fix `VOICE-F06`–`VOICE-F09` & `VOICE-F11` (LiveKit, Exotel, STT, Inbound):**
  - Emit `StreamUrl` in Exotel passthru; add Plivo/Vobiz inbound routes & `CallUUID` callback matching; wire `after_hours_mode="transfer"`.
  - Offload blocking STT/LLM/TTS I/O off the FastAPI WS event loop (or stream LLM tokens -> sentence TTS).
  - Implement `DeepgramSTT`, local `FasterWhisperSTT` audio file passing, and LiveKit SIP dispatch + per-turn RAG + transcript/billing closure; fix `voice-engine/Dockerfile` entrypoint CLI arg.

---

## Phase 3 — Real AI Actions, Workflows, CRM & UI Contracts (`P1`)

- **Fix `ACT-F01` & `ACT-F02` (Tool Calling & Real Call Transfer):** Wire `agent_actions` as native Gemini/OpenAI function tools in `LLMAdapter.complete` + `simulate_agent_turn` + LiveKit worker; implement real provider transfer APIs in `ActionService` (`call_transfer`) and `/api/calls/{id}/transfer`.
- **Fix `ACT-F03`–`ACT-F05` & `INT-F01`:** Implement Google OAuth2 authorization/refresh for Calendar & Sheets; enforce `whatsapp_templates` approval + `components` params; encrypt `agent_actions.config_json`; make `POST /integrations/{key}/test` run real credential checks; normalize phone in `caller_memories`; sync UI-created appointments to Calendar cleanly.
- **Fix `WFL-F01` (Real Workflow Engine):** Build real DAG/condition/delay/action execution in Python + `temporalio` worker (or fail clearly if Temporal unconfigured), trigger workflows on domain events (`call_completed`, `lead_created`, `appointment_booked`), and add `key={activeWf?.id}` to `AgentWorkflowCanvas` in `WorkflowsPanel.tsx`.
- **Fix `FE-F01`–`FE-F10` & `CRM-F01`–`CRM-F02`:**
  - Fix `VoiceBroadcastPanel` (`added_count` -> `added`), `CampaignManagerPanel` (`requeued_jobs` -> `dispatched`), `LeadManagementPanel` (`email` CSV mapping + unshadow `/api/leads/discover`), `AgentStudioPanel` (duplicate test-turn message + selective version bumping), `MissionControl` (`#/admin` & `#/staff` `staff_role` guards + preserve drafts/sync sub-tabs), `SettingsPanel` (persist `alertPrefs`, `/accept-invite` UI, API key revocation), and align webhook event names (`call.not_connected`, `lead.created`, `campaign.status_changed`, etc.) between backend and UI.

---

## Phase 4 — Conversation Intelligence, Agent Evaluation & Documentation Hygiene (`P1` / `P2`)

- Expand `voice-engine/evaluations/eval_harness.py` into an Agent Studio UI scorecard covering knowledge grounding, Telugu/Hindi/English code-switching, opt-out compliance, and pre-publish gating.
- Expand `CallIntelligencePanel` & `/api/calls/{id}/analyze` (using `LLMAdapter` for Gemini + OpenAI) to extract intent, objections, competitor mentions, unanswered questions, and QA scores; add Lead Scoring & Customer Journey Timeline in CRM.
- Reconcile `README.md`, `DEVELOPMENT_STATUS.md`, `docs/QA/*`, and `docs/blueprint/*`: remove unverified claims (`Autonomous OSM Lead Scout`, `11.4s average`, `< 30s`, `140+ templates`, unverified `TRAI compliant`, `₹3.60/min`) and tag historical QA reports with commit hashes.

---

## Phase 5 — Enterprise Operations & Cloud Deployment (`P2`)

- Complete `infrastructure/terraform/` (VPC, RDS PostgreSQL `pgvector`, ElastiCache Redis, ECS task definitions/services, ALB/TLS, ECR, IAM) and align queue architecture (Celery/Redis vs SQS).
- Expand `StaffPortal` and `AdminPortal` with provider failover health, live call monitor, double-entry financial reconciliation (liabilities vs usage revenue vs COGS), compliance/DLT review center, refund/credit adjustments, and audited customer impersonation.
- Run full staging verification: Docker Compose stack, live PostgreSQL `pytest`, live Playwright Chromium E2E across all 4 portals, and 1 end-to-end live PSTN test call.

---

> **Execution Gate:** Per audit protocol, **all 10 forensic deliverables are complete in `docs/audit/`**. No application code or existing historical docs have been modified. **Waiting for explicit user approval to begin Phase 1 implementation.**

