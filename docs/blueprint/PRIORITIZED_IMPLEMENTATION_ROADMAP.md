# TRIVAANA AI — Prioritized Implementation Roadmap

**Execution Strategy:** Fix security, financial, database, and core calling blockers first (Phase 1) before expanding UI modules (Phase 2–5). Do not build new features on top of broken Razorpay commits, schema drift, or synchronous blocking voice turns.

---

## Phase 1: Production Foundation & Release Blockers (Weeks 1–3)
**Goal:** Eliminate every `P0` security, billing, schema, and calling reliability blocker so the core SaaS is safe for paying pilots.

| Task | Key Deliverables & Files | Dependencies | Verification / Exit Criteria |
|---|---|---|---|
| **1.1 Payment & Registration Integrity** | • Remove unconditional `₹5,000` credit in `auth.py`; add `promo_credits` + email/OTP gate<br>• Wrap Razorpay `payment_orders` + `credit_wallet` + `invoices` in single atomic DB transaction with unified idempotency key `razorpay_order_{order_id}`<br>• Validate `event in ("payment.captured","order.paid")` & `payment.status == "captured"` + require `RAZORPAY_WEBHOOK_SECRET` in prod<br>• Bill `RATE_PREMIUM_PAISE_PER_MIN` & `platform_settings` overrides dynamically + charge/gate phone numbers & channels | `auth.py`, `billing.py`, `billing_service.py`, `call_service.py`, `razorpay_adapter.py` | Concurrent Razorpay webhook + client verification test yields exact single credit; failed wallet credit leaves order un-paid; zero free ₹5,000 on raw signup. |
| **1.2 Auth, RBAC & Multi-Tenant Hardening** | • Fix `/api/media/{storage_key}` path traversal (`is_relative_to(base / tenant_id)` + DB ownership check)<br>• Enforce `require_roles` using `ROLE_HIERARCHY` across `compliance.py`, `integrations.py`, `billing.py`, `phone_numbers.py`<br>• Implement `POST /api/auth/accept-invite` + invitation email; add `users.token_version` for JWT revocation on reset/removal<br>• Enforce `api_keys.scopes_json`; encrypt `integrations.config_json` & `webhooks.signing_secret` at rest<br>• Fix DNS-resolving SSRF check (`webhook_service.py`) & trusted proxy `RateLimitMiddleware` (`rate_limit.py`)<br>• Guard `#/admin` route in `MissionControl.tsx`; remove `seed.py` prod admin auto-promotion | `dependencies.py`, `workspaces.py`, `storage_service.py`, `compliance.py`, `integrations.py`, `webhook_service.py`, `rate_limit.py`, `MissionControl.tsx` | All `SEC-01`..`SEC-09` regression tests pass in pytest; viewer role returns `403` on compliance/integration mutations. |
| **1.3 PostgreSQL, Alembic & Cleanup** | • Delete orphaned `backend/database.py`, `frontend/src/lib/elevenlabs.ts`, `SpeedToLeadPanel.tsx`<br>• Fix `postgres_pgvector_schema.sql` (`UNIQUE` constraints, missing columns, `IF NOT EXISTS` indexes)<br>• Add `psycopg_pool.ConnectionPool` + Alembic migrations<br>• Dual-write/query `knowledge_chunks_pg` cleanly<br>• Fix `tenant.py` `ORDER BY day DESC` windowing bug | `database/`, `knowledge_service.py`, `tenant.py`, `docker-compose.yml` | Full pytest suite passes against live PostgreSQL 16 + `pgvector` container via `docker compose up --build`. |
| **1.4 Durable Queues & UI-Backend Fixes** | • Wire Celery/ARQ `.delay()` for campaigns, `delay_seconds` intake scheduling, and webhook retries<br>• Fix `CampaignManagerPanel` `calling_hours` dict bug (422), `CampaignService` hardcoded `te-IN`, `PricingSection` rate sync, `IncomingCallsPanel` messages filter, `CallIntelligencePanel` hardcoded `+918047361234`, `SettingsPanel` alert persistence | `worker/tasks.py`, `campaign_service.py`, `public_intake.py`, `CampaignManagerPanel.tsx`, `PricingSection.tsx` | Campaign created in UI in `hi-IN` dials via worker in `hi-IN`; `delay_seconds=30` executes after 30s; webhook retries automatically on 500. |
| **1.5 Streaming Voice & Live Telephony Fixes** | • Refactor `RealtimeVoicePipeline` to async streaming (`Streaming STT -> Streaming LLM + Tool Calling -> Sentence-Chunked Sarvam/ElevenLabs WS TTS`) with Romanized code-switching detection<br>• Fix `Exotel` `Calls/connect.json` payload & verify live PSTN leg + `livekit_agent_worker.py` RAG/Actions/DB persistence<br>• Integrate Sentry SDKs (`sentry-sdk`, `@sentry/react`) | `voice_engine/*`, `exotel_adapter.py`, `ai_prompt_service.py` | Measured P95 turn-taking latency `< 900ms` with live barge-in `clear` and persisted transcript/cost. |

---

## Phase 2: Best-in-Class Customer Experience (Weeks 4–7)
**Goal:** Deliver an intuitive, high-conversion self-service studio for Indian SMB owners.
* **2.1 AI Employees Studio v2:** Draft vs. Published separation, one-click Clone, `agent_versions` eval scorecards & rollback, lifecycle endpoint wiring.
* **2.2 Agent Testing Lab (`#/testing-lab`):** Live microphone WebRTC (`livekit-client`) + WebSocket tester, customer objection personas, background noise & speed toggles, automated multi-case regression suites (hallucination/grounding/latency scoring).
* **2.3 Knowledge Hub Upgrade:** Per-chunk inspector, scheduled URL refresh, `pgvector` semantic + lexical hybrid ranking.
* **2.4 Leads CRM & Customer Journey Timeline:** Unified timeline drawer (`source -> calls -> WhatsApp -> appointments -> notes`), Intelligent Lead Scoring (`Hot/Warm/Cold/Callback`), sales rep assignment.
* **2.5 Live Call Command Center (`#/live-calls`):** Real-time Redis Pub/Sub transcript stream, silent Listen, Whisper, Warm Human Transfer (real carrier API bridge), and Hangup controls.

---

## Phase 3: Business Automation & Real Outcomes (Weeks 8–10)
**Goal:** Ensure every call drives real business outcomes rather than ending as a transcript.
* **3.1 Smart Appointment Manager (`#/appointments`):** Real Google Calendar FreeBusy + `POST/PATCH/DELETE` event creation + atomic local slot lock (no double-booking) + WhatsApp reminders.
* **3.2 Real AI Actions & CRM Sync:** Implement real Google Sheets `values:append`, Zoho CRM / LeadSquared / HubSpot bidirectional sync, and mid-call `ActionService` execution inside streaming LLM tool calling, plus real-time voice opt-out persistence into `do_not_call_entries`.
* **3.3 Visual Automation Builder (`#/automations`):** `@xyflow/react` trigger->condition->action workflow engine (`Call Completed` -> `Score` -> `CRM Deal` -> `WhatsApp` -> `Follow-up`) + n8n webhook bridge.
* **3.4 Conversation Intelligence & ROI Analytics:** Automated objection/competitor/unanswered-question extraction ("1-click Add to KB"), Business ROI Funnel (`Spend -> Qualified -> Appointments -> Cost/Conversion`).

---

## Phase 4: Complete Super Admin & Internal Staff Portal (Weeks 11–14)
**Goal:** Give the platform owner and internal team full operational control without database access.
* **4.1 Internal Staff Portal (`/staff/*`):** Dedicated `staff_users` + 7-role RBAC + TOTP MFA; audited 15-min read-only "View as Customer" with customer-visible audit log; Support Ticketing inbox (Chatwoot CE sidecar); Onboarding Tasks & Dual-Control Approvals.
* **4.2 Super Admin Control Centre (`/admin/*`):**
  - **Financial Control Centre:** Separate Prepaid Wallet Liabilities vs. Earned Usage Revenue vs. Provider COGS & Gross Margin; reconciliation & refund approval workflow.
  - **Provider Control Centre:** Encrypted platform secrets, live connection probes, per-language failover chains (`Sarvam <-> ElevenLabs <-> OpenAI`), circuit-breaker alerts.
  - **Compliance & KYC Queue:** DLT PE ID / 140-160 header approvals, `bypass_trai` exemption approvals, DPDP export/erasure queue.
  - **Emergency Controls Panel:** Global outbound kill switch, tenant freeze, provider disable, maintenance mode (all reason-logged & 2FA-gated).
  - **User Management & Feature Overrides:** Wire `/api/admin/users` + per-tenant feature flag overrides + error resolution workflow.

---

## Phase 5: Scale, Ecosystem & Polish (Weeks 15+)
* **5.1 Developer Ecosystem:** Scoped API key permissions UI, interactive API playground, TypeScript/Python SDK snippets, webhook retry dead-letter replay.
* **5.2 Observability & BI:** Metabase internal finance/margin BI over read-only Postgres replica; PostHog JS onboarding funnel analytics.
* **5.3 Mobile & White-Label:** Mobile card triage views, urgent escalation notifications, multi-region SIP & white-label workspace branding.

