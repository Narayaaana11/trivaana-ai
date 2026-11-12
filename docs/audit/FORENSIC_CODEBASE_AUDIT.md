# TRIVAANA AI — Independent Forensic Codebase Audit (`HEAD d1d4319`)

**Audit Date:** 2026-11-11  
**Repository:** `Narayaaana11/trivaana-ai` (`c:\Narayana\Earning\projects\Trivaana AI Calling Agent`)  
**Audited Commit:** `d1d4319b47a9fa3bbcec2ac02b4a7eca63e92fff` (`d1d4319`)  
**Audit Scope:** Complete source-level inspection + live automated test/lint/build execution (no application source files were modified; no external live carrier, Razorpay, LiveKit, Docker, or PostgreSQL servers were provisioned or mutated).

---

## 1. Executive Summary & Overall Verdict

Trivaana AI has a substantial multi-tenant SaaS application scaffold spanning a 20-router FastAPI backend, a multi-portal React 19/TypeScript frontend (Public, Customer, Staff, and Super Admin portals), SQLite WAL + PostgreSQL/`pgvector` DDL, and separate `voice-engine/` and `workers/` entrypoints.

**Production Verdict: NOT PRODUCTION READY (`NO-GO` for paying customers).**

While local sandbox/mock API tests pass, forensic inspection of `HEAD d1d4319` uncovered critical (`P0`) release blockers across security, billing, real-time voice execution, compliance, and database parity:

1. **Unauthenticated WebSocket Stream Token Minting (`P0`)**: `GET/POST /api/calls/plivo-xml/{call_id}` and `/api/calls/vobiz-xml/{call_id}` (`backend/routers/calls.py:503-522`) require no signature or auth and mint valid HMAC-SHA256 WebSocket stream tokens for any `call_id`, exposing target-tenant AI employees, Knowledge Base RAG, and caller memory over `/api/calls/stream/{call_id}`.
2. **Scoped API Keys & RBAC Bypassed (`P0`)**: `require_scope()` (`backend/core/dependencies.py:162-173`) has **zero usages** across all routers; legacy `tenants.api_key_hash` (`dependencies.py:98-109`) cannot be revoked; ~30+ mutating and spend-generating endpoints lack `require_roles()`, allowing read-only `viewer` accounts to place paid calls, kill campaigns, and overwrite agents.
3. **Live Razorpay Checkout Broken + Unblocked Sandbox Bypass (`P0`)**: `RazorpayPaymentProvider.fetch_payment()` (`backend/providers/razorpay_adapter.py:128`) calls `requests.get(...)` without importing `requests` (`NameError` -> HTTP `502` on live payments), while `create_order()` / `verify_payment_signature()` (`lines 53-93`) lack `ENVIRONMENT` guards and credit free wallets in production whenever Razorpay keys are absent.
4. **Live Voice Calling Disconnected Across Modes (`P0`)**:
   - `Voice Broadcast` (`backend/routers/broadcasts.py:199-260`) debits customer wallets and marks recipients `'playing'` **without ever invoking any telephony provider or TTS synthesis**.
   - `Twilio` TwiML (`backend/providers/twilio_adapter.py:149-188` & `calls.py:461-490`) uses single-turn `<Gather><Say>` and hardcodes a Telugu reply + `<Hangup/>` without invoking LLM/RAG/TTS.
   - `TelephonyStreamSession._encode_outbound_media` (`backend/voice_engine/telephony_stream.py:196-202`) feeds raw **MP3** bytes from ElevenLabs/OpenAI directly into PCM16/mu-law framing.
   - `Public Lead Intake` delayed calls (`delay_seconds > 0` in `public_intake.py:196-218`) are silently dropped when Redis/Celery is absent (`backend/worker/tasks.py:73-91`).
   - `LiveKit` worker (`backend/voice_engine/livekit_agent_worker.py`) lacks per-turn RAG, `ActionService` tools, transcript persistence, billing closure, and outbound SIP dialing (`LIVEKIT_SIP_CONFIG` unused).
5. **AI Actions, Call Transfers & Workflows Are Stubbed (`P0`)**:
   - `ActionService` tools (`google_calendar`, `google_sheets`, `whatsapp_template`, `custom_api`, `caller_memory`) are injected only as plain text into the LLM prompt (`ai_prompt_service.py:270`)—never wired as callable tools.
   - `call_transfer` (`action_service.py:205-217`, `calls.py:530-583`) never invokes any telephony carrier transfer API.
   - `workers/workflows/temporal_worker.py:13-77` marks every React Flow node `"completed"` locally without evaluating edges, conditions, or actions, and hangs in `"queued"` when `TEMPORAL_ADDRESS` is set (no `temporalio` dependency or worker exists).
6. **Admin Kill Switch Ignored & Compliance Gaps (`P0`)**: `POST /api/admin/emergency/kill-switch` (`admin.py:303-328`) writes `emergency_outbound_pause` to `platform_settings`, which is **never read** by any calling path. CSV/paste lead imports auto-set `consent_status='opted_in'` without evidence (`lead_service.py:96-97`), and DLT/NCPR scrubbing is absent.
7. **PostgreSQL Runtime Crash & Missing Constraints (`P0`)**: `CallService.process_call_event` (`backend/services/call_service.py:163-165`) executes SQLite-only two-argument `MAX(duration_seconds, ?)` (crashes on PostgreSQL), while CI (`.github/workflows/ci.yml:37-39`) runs `pytest` on SQLite rather than Postgres.

---

## 2. Live Verification Executed on `HEAD d1d4319`

| Check | Command Executed | Observed Result | Scope & Limitations |
|---|---|---|---|
| **Backend Pytest** | `python -m pytest -v tests` (in `backend/`) | **61 passed**, 1 Starlette `httpx` warning (`22.84s`) | Runs against ephemeral SQLite WAL & mocked/monkeypatched external HTTP providers (`conftest.py`); does **not** test live PostgreSQL, Redis, Celery, PSTN, Razorpay, LiveKit, or LLM APIs. |
| **Frontend Lint** | `npm run lint --prefix frontend` (`oxlint`) | **0 errors, 1 warning** (`74` files, `116` rules, `107ms`) | Warning: `react(incompatible-library)` on `useReactTable` in `AppointmentsPanel.tsx:114`. |
| **Frontend Unit Tests** | `npm run test --prefix frontend` (`vitest run`) | **17 passed** (`2` files: `portals.test.tsx` `4`, `components.test.tsx` `13`, `8.11s`) | `jsdom` unit/smoke tests with mocked API responses; no real browser click-through. |
| **Frontend Build** | `npm run build --prefix frontend` (`tsc -b && vite build`) | **Succeeded** (`1.27s`, `3173` modules) | Vite chunk size warning on `index-CHkvYa9k.js` (`668.86 kB`). |
| **Local Infra Tools** | `Get-Command docker, psql, redis-cli, temporal` | All 4 `NOT_INSTALLED` | Docker Compose, PostgreSQL + `pgvector`, Redis, and Temporal runtime were not live-tested on this host. |

---

## 3. Repository Inventory (`248` git-tracked files)

- **Backend (`backend/`)**: `main.py` (mounts 21 routers), `core/` (`config.py`, `dependencies.py`, `permissions.py`, `rate_limit.py`, `security.py`, `vault.py`), `database/` (`connection.py`, `schema.py`, `seed.py`, `models.py`, `sqlalchemy_engine.py`, `postgres_pgvector_schema.sql`), `migrations/` (`alembic.ini`, `env.py`, `0001_initial_pgvector_rls.py`), `providers/` (Exotel, Twilio, Plivo, Vobiz, Mock, Voice TTS adapters, LLM adapter, Razorpay), `routers/` (21 modules including `admin.py`, `agents.py`, `actions.py`, `appointments.py`, `auth.py`, `billing.py`, `broadcasts.py`, `calls.py`, `campaigns.py`, `compliance.py`, `health.py`, `inbound.py`, `integrations.py`, `knowledge.py`, `leads.py`, `phone_numbers.py`, `public_intake.py`, `support.py`, `tenant.py`, `voice_engine.py`, `voices.py`, `workflows.py`, `workspaces.py`), `services/` (13 service modules), `voice_engine/` (7 modules), `worker/tasks.py`, `tests/` (15 test files, 61 tests). *(Confirmed: legacy `backend/database.py` has been deleted.)*
- **Voice Engine Standalone (`voice-engine/`)**: `Dockerfile`, `agents/worker.py`, `evaluations/eval_harness.py`, `pipelines/turn_orchestrator.py`, `providers/registry.py`, `tools/call_tools.py`. *(Note: `turn_orchestrator.py`, `registry.py`, and `call_tools.py` are dead/unimported code.)*
- **Workers (`workers/`)**: `Dockerfile`, `billing/reconciler.py`, `campaigns/dispatcher.py`, `notifications/webhook_worker.py`, `workflows/temporal_worker.py`. *(Note: `reconciler.py` and `webhook_worker.py` are unimported/unused.)*
- **Frontend (`frontend/src/`)**: `App.tsx`, `stores/useAppStore.ts`, `apps/` (`public/PublicPortal.tsx`, `customer/CustomerPortal.tsx`, `staff/StaffPortal.tsx`, `admin/AdminPortal.tsx`), `components/dashboard/` (22 panel/modal components), `components/landing/` (10 public/marketing components), `components/reactbits/`, `lib/` (`trivaana-api.ts`, `brand.ts`, `charts.ts`, `templates.ts`), `services/platformService.ts`, `__tests__/` (`portals.test.tsx`, `components.test.tsx`).
- **Infrastructure & CI**: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `infrastructure/terraform/` (`main.tf`, `variables.tf`), `.github/workflows/ci.yml`.

---

## 4. Documentation Contradictions & Misleading Claims Reconciliation (Part 9)

| Document / Location | Claimed State | Actual Observed Code State on `d1d4319` |
|---|---|---|
| `README.md:21, 39-40` | Claims `"Autonomous OpenStreetMap (OSM) Lead Scout"`, `"11.4 seconds"` speed-to-lead, `"₹3.60/min"`, and lists deleted `backend/database.py`. | `LeadService.discover_leads_scout()` (`lead_service.py:115-135`) returns `status: "not_configured"` with zero OSM code, and `GET /api/leads/discover` is shadowed (`leads.py:116,360`). `config.py:192` bills `₹6.50/min`. |
| `DEVELOPMENT_STATUS.md:7-8, 29, 39-42` | Line 7 states `₹5/min` / `₹6.80/min`; Line 8 lists 16 tabs; Line 29 reports `53/53 pytest`, `8/8 Vitest`, `52` lint files, and "live Playwright Chromium QA"; Lines 39-42 report `13/13 Vitest` and `66` lint files. | Actual `d1d4319` has `₹6.50`/`₹8.50` in `config.py`, **20** tabs in `AppSidebar.tsx`, **61/61** `pytest`, **17/17** `vitest`, and **74** lint files. |
| `docs/QA/BROWSER_QA_REPORT.md:5, 43` vs `VISUAL_COMPARISON_REPORT.md:4, 20` | `BROWSER_QA_REPORT.md` states interactive Chromium UI was **`Not tested` (blocked)** (`6/6` Vitest); `VISUAL_COMPARISON_REPORT.md` states live Playwright Chromium QA passed (`8/8` Vitest). | `BROWSER_QA_REPORT.md` is dated `2026-11-11`; no Chromium E2E test suite exists in `frontend/package.json`. |
| `docs/QA/END_TO_END_TEST_REPORT.md:5-6` | Claims `53/53` backend tests and `6/6` frontend tests (`48` lint files). | Current `HEAD` has `61/61` backend tests and `17/17` frontend tests (`74` lint files). |
| `docs/QA/SECURITY_TEST_REPORT.md:19` | Claims per-IP auth rate-limiting middleware is not active at FastAPI layer. | `backend/main.py:60` mounts `RateLimitMiddleware` (`backend/core/rate_limit.py`). |
| `docs/blueprint/COMPLETE_CODEBASE_AUDIT.md`, `SECURITY_AND_COMPLIANCE_AUDIT.md`, `DATABASE_AND_API_GAP_ANALYSIS.md` | Target older commit `fe11cbe` (report deleted `backend/database.py`, `SpeedToLeadPanel.tsx`, `elevenlabs.ts`, and pre-fix `SEC-01`..`SEC-05` bugs that are now partially/fully fixed, while missing new `d1d4319` regressions). | Stale relative to `d1d4319`. Historical docs should be tagged with their inspected commit hash rather than treated as current truth. |
| `frontend/src/components/landing/DocsPortalPage.tsx:44` | Claims `"140+ industry templates"`. | `frontend/src/lib/templates.ts` contains 14 categories and **27** templates. |
| `frontend/src/components/landing/HeroSection.tsx:226, 256, 422, 424` | Claims `"₹5.00/min"`, `"₹500 Demo Wallet"`, `"50 free credits"`, `"Trusted by 5,000+ businesses"`. | Backend `config.py:192` charges `₹6.50/min`; `auth.py:70` grants `₹5,000` (`ALLOW_WELCOME_CREDIT=true`) or `₹0`. |

---

## 5. Companion Forensic Deliverables in `docs/audit/`

1. [`FORENSIC_CODEBASE_AUDIT.md`](./FORENSIC_CODEBASE_AUDIT.md) — Executive summary, baseline verification, inventory, and documentation reconciliation.
2. [`VERIFIED_FEATURE_MATRIX.md`](./VERIFIED_FEATURE_MATRIX.md) — Exhaustive feature-by-feature truth table with strict status classifications.
3. [`CRITICAL_SECURITY_FINDINGS.md`](./CRITICAL_SECURITY_FINDINGS.md) — `P0`–`P3` security audit and `SEC-01`..`SEC-09` status verification.
4. [`REAL_VOICE_CALLING_GAP_REPORT.md`](./REAL_VOICE_CALLING_GAP_REPORT.md) — End-to-end PSTN/LiveKit/STT/LLM/TTS/compliance gap analysis.
5. [`AI_ACTIONS_AND_WORKFLOW_AUDIT.md`](./AI_ACTIONS_AND_WORKFLOW_AUDIT.md) — AI Employee builder, Actions, Temporal/React Flow workflows, RAG, CRM, and Appointments.
6. [`BILLING_AND_FINANCIAL_INTEGRITY_REPORT.md`](./BILLING_AND_FINANCIAL_INTEGRITY_REPORT.md) — Razorpay, pricing discrepancies, ledger atomicity, COGS, and revenue/liability separation.
7. [`POSTGRESQL_AND_DATABASE_AUDIT.md`](./POSTGRESQL_AND_DATABASE_AUDIT.md) — SQLite vs PostgreSQL compatibility bugs, schema parity, RLS, and Alembic gaps.
8. [`FRONTEND_BACKEND_CONTRACT_REPORT.md`](./FRONTEND_BACKEND_CONTRACT_REPORT.md) — UI/API contract mismatches, route guards, unsaved state, hardcoded values, and dead code.
9. [`PRODUCTION_DEPLOYMENT_READINESS.md`](./PRODUCTION_DEPLOYMENT_READINESS.md) — Docker, workers, Terraform, CI/CD, and production Go/No-Go checklist.
10. [`MASTER_REMEDIATION_ROADMAP.md`](./MASTER_REMEDIATION_ROADMAP.md) — Sequenced Phase 1–5 engineering plan (**awaiting user approval before code edits**).

