# TRIVAANA AI — Complete Codebase Audit (Evidence-Based)

**Audit Date:** November 11, 2026  
**Repository:** `Narayaaana11/trivaana-ai` (Local workspace: `c:\Narayana\Earning\projects\Trivaana AI Calling Agent`, HEAD commit `fe11cbe`)  
**Methodology:** Direct source inspection of backend routers/services/providers/database/voice engine, frontend routes/panels/API client, deployment files, existing docs, and live execution of backend & frontend test/build/lint suites. Existing `DEVELOPMENT_STATUS.md` and `docs/QA/*` claims were treated as hypotheses until verified against actual code and command output.

---

## 1. Live Verification Summary (Executed During Audit)

| Check | Command Run | Verified Result | Notes vs. `DEVELOPMENT_STATUS.md` |
|---|---|---|---|
| **Backend Tests** | `python -m pytest -v tests` (in `backend/`) | **54/54 passed** (`12.87s`, 1 Starlette deprecation warning) | `DEVELOPMENT_STATUS.md` claimed `53/53`; actual suite has 54 tests. Tests run against SQLite WAL & mock/monkeypatched external APIs (`httpx`/`requests`/`TestClient`), not live PSTN, Razorpay, LiveKit, or PostgreSQL servers. |
| **Frontend Lint** | `npm run lint --prefix frontend` (`oxlint`) | **0 errors, 0 warnings** (`66` files, `116` rules, `58ms`) | Verified clean. |
| **Frontend Unit Tests** | `npm run test --prefix frontend` (`vitest run`) | **13/13 passed** (`939ms` test time, `3.98s` total) | Component rendering/smoke tests in `frontend/src/__tests__/components.test.tsx`. |
| **Frontend Build** | `npm run build --prefix frontend` (`tsc -b && vite build`) | **Succeeded** (`875ms`, `dist/assets/index-CwZuCE0F.js`) | Clean TypeScript + Vite multi-chunk build. |
| **Docker / Postgres Stack** | Inspected `docker-compose.yml`, `backend/Dockerfile`, `frontend/nginx.conf` | **Not executed** | Docker Desktop not verified locally; static inspection found critical configuration and schema drift bugs (see Section 5 & 7). |

---

## 2. Executive Classification Matrix

| Area | Implemented & Working | Partially Implemented / Credential-Gated | Mocked / Simulated / Stubbed | Critical Gaps / Bugs |
|---|---|---|---|---|
| **Public Site & Auth** | 8 public routes, JWT (`HS256`), PBKDF2 password hashing, API key auth, password reset & email verify token tables | SMTP email delivery (falls back to `dev_reset_token` / `dev_verification_token` in non-prod) | Unconfigured SMTP skips sending; demo tenant auto-seeded & force-promoted to `is_super_admin=1` (`seed.py:74-81`) | Unconditional `₹5,000` (`500000` paise) credit on every `POST /api/auth/register` (`auth.py:72-74`); no `/accept-invite` flow for invited members; no JWT revocation (`token_version`/`jti`) on password reset or user suspension; `require_roles` ignores `ROLE_HIERARCHY`; API keys ignore `scopes_json` and hardcode `role="admin"`; legacy `tenants.api_key_hash` unrevocable |
| **AI Employee Builder** | 22+ fields, prompt version history/compare/restore, `@xyflow/react` flow graph persistence, lifecycle states, JSON export | OpenAI structured JSON prompt generation (falls back to deterministic templates) | Deterministic template fallback (`AIPromptService._deterministic_template`) | No real automated agent regression testing / evaluation suite, hallucination scoring, or side-by-side A/B call outcome evaluation |
| **Voice Engine & Telephony** | Exotel, Twilio, Plivo, Vobiz adapters; G.711 mu-law <-> PCM16 codec; SHA-256 `TTSCache`; LiveKit token generator & standalone worker script | Sarvam REST/WS TTS, ElevenLabs TTS, OpenAI Whisper/TTS, Faster-Whisper, IndicConformer, LiveKit (`livekit_agent_worker.py`) | `MockTelephonyProvider`; fake MP3 header fallback bytes when TTS unconfigured (`voice_adapters.py:54`); browser `speechSynthesis` in UI simulator | **Synchronous blocking turn loop** in `RealtimeVoicePipeline.run_turn()` (`pipeline.py:36`); `LiveCallSimulatorModal` is text-only (no mic / WebRTC client); `Exotel` `Calls/connect.json` sends `From=to_phone, To=to_phone` without ExoML `Url`; `livekit_agent_worker.py` has no KB RAG, no `ActionService`, and is never dispatched by `CallService` |
| **4 Calling Modes** | Instant calling, Bulk campaigns, Inbound routing, Voice broadcast CRUD + CSV/audio upload + DNC scrubbing | Scheduled campaign activation (`worker/tasks.py`), retry tick (`process_due_retries`) | `simulate-progress` deterministic campaign advancer; inbound simulator (`POST /api/inbound/simulate`) | `CampaignService.start_campaign` hardcodes `language="te-IN"` (`campaign_service.py:219`); `CampaignManagerPanel` sends `calling_hours` as string `'09:00-18:00'` to Dict Pydantic model (422 error); `public_intake.py` accepts `delay_seconds` but dials immediately; `celery_app` tasks are never `.delay()`-invoked; `IncomingCallsPanel` `messages` tab renders all inbound calls identically to `calls` |
| **Knowledge Base (RAG)** | Text/FAQ/PDF/DOCX/CSV/URL ingestion, chunking with overlap, OpenAI or 128-dim local hash embeddings, cosine + lexical search | `KnowledgeService.search_pgvector` SQL query | Local 128-dim feature-hash embedding (`_local_deterministic_embedding`) when `OPENAI_API_KEY` missing | `KnowledgeService.ingest_document` never writes to `knowledge_chunks_pg`; `postgres_pgvector_schema.sql` enforces `vector(1536)` which crashes on 128-dim local embeddings; basic HTML regex stripping for URLs |
| **During-Call Actions & CRM** | `agent_actions` CRUD, `leads` 4-view UI + CSV column mapper + `caller_memories` opt-in store + `disposition_mappings` | Meta WhatsApp Cloud API message dispatch, Custom REST API with `is_safe_public_url` | `google_calendar`, `google_sheets`, `whatsapp_template`, `call_transfer` return `simulated` in sandbox | **`google_calendar` only `GET`s 5 events** (never creates/reschedules/cancels bookings); **`google_sheets` makes zero HTTP calls** and returns `executed` (`action_service.py:140-142`); **`call_transfer` never calls carrier transfer API** (`action_service.py:178-180`); `ActionService` is not wired into `RealtimeVoicePipeline` tool execution |
| **Billing & Razorpay** | Integer-paise `wallet_balance_paise`, `BillingService.debit_wallet`/`credit_wallet`, 18% GST SAC 998313 invoice records | Razorpay Order + Payment verification + Webhook | `order_sandbox_*` / `sandbox_topup` in dev | **Razorpay order marked `'paid'` & committed BEFORE `credit_wallet()`** (`billing.py:242-259, 298-318`); webhook doesn't check `event` type or `payment.status == 'captured'`; `PricingSection.tsx` advertises `₹5.00/₹6.80` while `core/config.py` charges `₹6.50/₹8.50` and `CallService` ignores `premium` tier & admin tariff overrides; Phone Numbers & Channels add ₹0 to billing |
| **Super Admin & Internal Team** | Isolated `/api/admin/*` endpoints (`overview`, `workspaces`, `suspend/activate`, `users`, `tariffs`, `feature-flags`, `failed-calls`, `system-errors`, `audit-logs`) | `SuperAdminPanel.tsx` 4 sub-tabs | Single `is_super_admin` flag on demo user | **No Internal Staff Portal** or 7-role staff RBAC; **no Provider Control Centre**, **no Financial Liabilities vs Revenue vs COGS ledger**, **no Refund/Credit adjustment**, **no Subscription management**, **no Live Call Monitor**, **no Support Ticketing**, **no Compliance Centre**, **no audited "View as Customer"** |

---

## 3. Module-by-Module Deep Audit

### 3.1 Frontend (`frontend/src/`)
* **Routing & Shell**: `App.tsx` handles 8 public routes (`/`, `/voices`, `/pricing`, `/product/instant-leads`, `/product/campaigns`, `/product/inbound`, `/contact`, `/docs`) and `MissionControl.tsx` synchronizes 16 dashboard tabs (`overview`, `agents`, `leads`, `intelligence`, `analytics`, `campaigns`, `instant-leads`, `inbound`, `broadcast`, `knowledge`, `integrations`, `phone-numbers`, `billing`, `settings`, `developers`, `super-admin`) with `#/` hash sub-routes.
* **Orphaned / Duplicate Code**: `frontend/src/components/dashboard/SpeedToLeadPanel.tsx` (265 lines) exists in the codebase alongside `InstantLeadsPanel.tsx` and is never imported or rendered anywhere. `frontend/src/lib/elevenlabs.ts` (`@elevenlabs/elevenlabs-js`) is also dead unused client-side code.
* **Confirmed UI/API Bugs & Mismatches**:
  1. `CampaignManagerPanel.tsx:49,121`: `callingHours` state is a string `'09:00-18:00'`, passed directly as `calling_hours: callingHours` to `POST /api/campaigns`, where `CreateCampaignRequest` (`campaigns.py:31`) requires `Optional[Dict[str, Any]]` -> triggers HTTP 422 unless omitted/transformed.
  2. `PricingSection.tsx:102,115,126`: Headline & strip advertise `₹5.00/min` Standard and `₹6.80/min` Premium, while tier cards inside the same file (`lines 23, 46`) list `₹6.50/min` & `₹8.50/min`, and Starter card lists `2 Concurrent Calling Lines` while `billing.py:125-128` grants Starter `5` channels and Growth `15` channels (vs `10` on card).
  3. `IncomingCallsPanel.tsx:163-179`: The `Messages` sub-tab renders the unfiltered `inboundCalls` list (identical to `Calls` tab).
  4. `InstantLeadsPanel.tsx:146`: Displays a hardcoded `<SplitFlapText text="< 15S" />` SLA card rather than measured intake-to-dial latency.
  5. `CallIntelligencePanel.tsx:96`: `handleSimulateInbound` hardcodes `to_number: '+918047361234'`, which fails with 404/403 for any workspace other than the seeded demo workspace.
  6. `SettingsPanel.tsx:44-48`: `alertPrefs` (`liveCallBanner`, `failedWebhookAlerts`, `lowBalanceThresholdInr`) are local React state only and are never saved to the backend.
  7. `LiveCallSimulatorModal.tsx`: Text-input turn tester only; does not capture microphone audio, stream WebRTC via LiveKit (`POST /api/voice-engine/livekit-token` is not even in `trivaana-api.ts`), or test noise/interruptions/evals.
  8. `SuperAdminPanel.tsx` & `MissionControl.tsx`: Only covers Workspaces suspend/activate, Tariffs, Feature Flags, Failed Calls, System Errors, and Audit Logs. Does not render `/api/admin/users` (backend endpoint exists at `admin.py:122`, unused in UI!). Additionally, `MissionControl.tsx` maps `#/admin` without checking `userProfile?.is_super_admin`, causing unprivileged tenants to fire `403` errors rather than redirecting.
  9. **UX & Accessibility:** `MissionControl.tsx` conditionally unmounts panels on tab switch (losing unsaved form drafts); modals lack focus traps and `Escape` handlers; icon-only buttons lack `aria-label`; `@xyflow/react` canvas conflicts with mobile touch gestures.

### 3.2 Backend Routers, Services & Providers (`backend/`)
* **20 Routers Mounted in `main.py`**: `health`, `auth`, `workspaces`, `tenant`, `agents`, `voices`, `voice_engine`, `leads`, `calls`, `campaigns`, `broadcasts`, `inbound`, `public_intake`, `knowledge`, `actions`, `integrations`, `phone_numbers`, `compliance`, `billing`, `admin`.
* **Duplicate / Dead Code**:
  * `backend/database.py` (325 lines, legacy v1 `REAL` float schema) coexists with the `backend/database/` package (`__init__.py`, `connection.py`, `schema.py`, `seed.py`). Python resolves `from database import ...` to the package, leaving `backend/database.py` as dead, misleading code.
* **Voice & Telephony Pipeline Gaps**:
  * `RealtimeVoicePipeline.run_turn()` (`backend/voice_engine/pipeline.py:36-155`) is strictly synchronous: full STT -> full LLM HTTP request -> full TTS synthesis -> return base64 audio. There is no LLM token streaming to sentence-chunked TTS, and `detect_language_hint()` (`lines 22-33`) only checks Unicode character ranges (fails on Romanized Telugu/Hindi/Tamil code-switching like *"Naku Telugu raadhu"*).
  * `TelephonyStreamSession` (`backend/voice_engine/telephony_stream.py:127`) uses a simple RMS energy threshold (`450.0`) + `12` silent frames without acoustic echo cancellation or semantic turn detection, and runs `RealtimeVoicePipeline.run_turn` synchronously inside the WebSocket loop.
  * `ExotelTelephonyProvider.initiate_call()` (`backend/providers/exotel_adapter.py:106-119`) sends `"From": to_phone, "To": to_phone` and omits `Url` (ExoML flow/app URL), which is incompatible with standard Exotel Connect v1 two-leg bridging unless configured via an Exotel App URL.
  * `livekit_agent_worker.py` (`backend/voice_engine/livekit_agent_worker.py:76-87`) builds a bare `Agent(instructions=instructions)` without Knowledge Base RAG, `ActionService` tools, call transcript persistence, or `CallService` billing hooks, and no dialing path creates LiveKit SIP calls.
* **Queue & Worker Gaps**:
  * `backend/worker/tasks.py` initializes `celery_app` when `REDIS_URL` is set, yet zero files in `backend/` call `.delay()` or `.apply_async()`. Campaign dispatch (`CampaignService.start_campaign`), webhook HTTP delivery (`WebhookService.dispatch_event`), and instant lead intake (`public_intake.py`) all execute synchronously inside FastAPI HTTP handlers.
  * `public_intake.py:56,225` accepts `delay_seconds` (0–3600) and echoes it in JSON, yet dials immediately without scheduling any delayed job.

### 3.3 Database & Schema Drift (`backend/database/`)
* `schema.py` (SQLite WAL) vs `postgres_pgvector_schema.sql` (PostgreSQL):
  * `postgres_pgvector_schema.sql` is missing `UNIQUE` constraints on `tenants.api_key_hash`, `users.email`, `api_keys.key_hash`, `transactions.idempotency_key`, and `agents.slug`.
  * `postgres_pgvector_schema.sql` is missing `webhooks.include_transcripts` (added via `_safe_add_columns` in `schema.py:916`), `campaigns.suppression_list_id`, and `campaigns.calling_days_json`.
  * `postgres_pgvector_schema.sql` lines 727–742 use `CREATE INDEX` without `IF NOT EXISTS`, causing re-execution in `create_tables()` (`schema.py:1034-1043`) to silently fail and swallow exceptions via `except Exception: conn.rollback()`.
  * No Alembic or versioned migration framework exists for PostgreSQL.

### 3.4 Performance & Scalability Bottlenecks
* **PostgreSQL Connection Exhaustion (`database/connection.py:101-130`):** `get_db()` opens a brand-new `psycopg.connect(...)` TCP/TLS connection per HTTP request and closes it on return with no `psycopg_pool.ConnectionPool`.
* **Chronological Inversion in Analytics (`routers/tenant.py:113-133`):** `ORDER BY day ASC LIMIT ?` retrieves the *oldest* `N` days from account inception instead of the *most recent* `N` days.
* `KnowledgeService.search()` (`knowledge_service.py:264-306`) loads ALL chunks for a tenant into Python memory and computes cosine similarity in a Python loop on every conversational turn.
* `RateLimitMiddleware` (`core/rate_limit.py`) falls back to an in-memory `defaultdict` when Redis is absent (unshared across workers), and its Redis branch (`lines 38-43`) implements a fixed-window counter susceptible to 2x boundary bursts.
* Synchronous `requests.post` calls inside FastAPI handlers (`ai_prompt_service.py`, `webhook_service.py`, `calls.py`, `voice_adapters.py`, `razorpay_adapter.py`) block worker threads under load.
