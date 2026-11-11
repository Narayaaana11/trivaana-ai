# TRIVAANA AI — Customer Application Blueprint

**Scope:** All 17 customer-facing modules across `#/home` through `#/developers` + responsive mobile experience.  
**Design Principle:** Simple enough for a non-technical Indian SMB owner to launch in `< 15 minutes`, backed by deep enterprise power.

---

## 1. Customer Navigation & Information Architecture

```
TRIVAANA AI CUSTOMER WORKSPACE
├── Core
│   ├── Overview (#/home)
│   └── Analytics & Business ROI (#/performance)
├── AI Workforce
│   ├── AI Employees Studio (#/employees)
│   ├── Agent Testing Lab (#/testing-lab)
│   ├── Voice Studio (#/voices)
│   └── Knowledge Hub (#/knowledge)
├── Calling & Operations
│   ├── Live Call Command Center (#/live-calls)
│   ├── Campaign Studio (#/campaigns)
│   ├── Instant Leads (#/instant)
│   ├── Incoming Calls (#/inbound)
│   └── Voice Broadcast (#/broadcast)
├── CRM & Business Automation
│   ├── Leads, Pipeline & Customer Journey (#/leads)
│   ├── Call History & Conversation Intelligence (#/conversations)
│   ├── Visual Automation Studio (#/automations)
│   └── Appointment Manager (#/appointments)
└── Workspace & Platform
    ├── Integrations Hub (#/integrations)
    ├── Numbers & Channels (#/numbers)
    ├── Team Management (#/team)
    ├── Billing & Wallet (#/billing)
    ├── Compliance & Settings (#/settings)
    └── Developer Portal (#/developers)
```

---

## 2. Module-by-Module Blueprint (With Required Changes & Acceptance Criteria)

### 2.1 Overview (`#/home`) — Priority: P0
- **Current Status:** `OverviewPanel.tsx` displays basic KPIs, quick prompt builder, 14-category template drawer, JSON script import, daily chart, and recent calls.
- **Required Changes:**
  - **Frontend:** Add guided 5-step Onboarding Checklist (persisted in backend `tenant.onboarding_state_json`), Wallet Runway indicator (`days remaining` at current burn), and ROI snapshot (Qualified Leads + Appointments Booked + Cost/Conversion).
  - **Backend / DB / API:** Add `GET/PATCH /api/workspaces/onboarding`; fix `tenant.py` `ORDER BY day DESC` windowing bug so daily charts show the *most recent* `N` days.
  - **Dependencies:** `tenant.py`, `analytics`.
  - **Security & Testing:** Tenant-scoped queries; Vitest + Playwright onboarding persistence check.
  - **Acceptance Criteria:** A newly registered user sees a zero-fake-metric empty state with an actionable 5-step checklist and real-time spend/runway once calls start.

### 2.2 AI Employees Studio (`#/employees`) — Priority: P0
- **Current Status:** `AgentStudioPanel.tsx` & `AgentWorkflowCanvas.tsx` implement 22+ fields, OpenAI/template prompt generation, version history/compare/restore, `@xyflow/react` call graph, and lifecycle states (`draft`, `testing`, `published`, `active`, `paused`, `archived`).
- **Required Changes:**
  - **Frontend:** Separate **Draft vs. Published** working copy UX; attach evaluation scorecards directly to each `agent_versions` row (`v1`, `v2`, `v3`) with one-click rollback; enforce `POST /api/agents/{id}/lifecycle` on publish/pause buttons instead of raw `PUT`; add one-click "Clone Employee".
  - **Backend / DB / API:** Add `published_version_id` on `agents`, `eval_score` + `eval_summary_json` on `agent_versions`; add `POST /api/agents/{id}/clone`; validate publish gate (must have greeting, system prompt, voice, and passing smoke check or explicit override).
  - **Security & Testing:** RBAC `owner/admin/manager` for publish/delete; pytest lifecycle state machine & rollback tests.
  - **Acceptance Criteria:** Editing a live agent creates a new draft version without disrupting running calls until explicitly published; rollback restores exact prompt, voice, tools, and flow graph atomically.

### 2.3 Agent Testing Lab (`#/testing-lab`) — Priority: P0
- **Current Status:** `LiveCallSimulatorModal.tsx` only offers text chat + browser `speechSynthesis` fallback (`livekit-token` unused; no microphone capture; no persona/noise/regression evals).
- **Required Changes:**
  - **Frontend:** Build dedicated Agent Testing Lab supporting: (1) Live browser microphone WebRTC (`livekit-client`) + WebSocket streaming audio, (2) Customer Persona & Objection Simulator (price negotiator, busy buyer, Telugu-English code-switcher), (3) Acoustic noise & speaking-rate stress toggles, (4) Multi-scenario **Automated Regression Suite** runner comparing `v(n)` vs `v(n-1)` on Latency (`STT/LLM/TTS`), KB Grounding/Hallucination check, and Goal Completion score.
  - **Backend / DB / API:** Add `agent_test_suites`, `agent_test_cases`, and `agent_eval_runs` tables; endpoints `POST/GET /api/agents/{id}/test-suites`, `POST /api/agents/{id}/evaluate`; wire `/api/voice-engine/livekit-token` into frontend API client.
  - **Dependencies:** `AgentTurnOrchestrator`, LiveKit WebRTC, `KnowledgeService`.
  - **Security & Testing:** Sandbox tests billed at `₹0.00` (flagged `is_sandbox=1`) with rate limit; pytest eval runner tests.
  - **Acceptance Criteria:** Business owner can speak via mic in Telugu/English code-switching, run 5+ scripted objection cases with one click, and view pass/fail scorecards before publishing.

### 2.4 Voice Studio (`#/voices`) — Priority: P0
- **Current Status:** `voices.py` + `AgentStudioPanel` voice tab + `/voices` public showcase.
- **Required Changes:**
  - **Frontend:** Dedicated Voice Studio tab with side-by-side provider comparison (`Sarvam` Standard vs `ElevenLabs` Premium), speed/pitch/stability sliders, custom sample text input in 7 languages, and transparent per-minute cost badge synchronized with `GET /api/billing/pricing`.
  - **Backend / API:** Sync `VoicePreviewRequest` parameters cleanly; surface `provider_configured` and verified test timestamps.
  - **Acceptance Criteria:** Voice preview accurately reflects selected provider/tier cost and never returns fake audio bytes as "verified".

### 2.5 Knowledge Hub (`#/knowledge`) — Priority: P0
- **Current Status:** `KnowledgeBasePanel.tsx` & `knowledge_service.py` ingest TXT/CSV/PDF/DOCX/URL/FAQ into SQLite `knowledge_chunks`. `knowledge_chunks_pg` exists in PG DDL but is never populated.
- **Required Changes:**
  - **Frontend:** Add per-chunk viewer & inline editor, URL crawl depth/refresh scheduler, document-to-agent multi-binding, and retrieval confidence breakdown (`vector_score` + `lexical_score`).
  - **Backend / DB / API:** Dual-write or unified `pgvector` ingestion on PostgreSQL; normalize embedding dimensions (`1536` OpenAI or `384` local microservice `bge-small` via `speech_microservice.py`); add `POST /api/knowledge/documents/{id}/refresh`.
  - **Security & Testing:** Strict SSRF DNS-resolved URL check on URL crawling; file size & MIME magic-byte verification.
  - **Acceptance Criteria:** Uploaded PDFs/URLs are indexed into `pgvector` in production and queried mid-call with `< 50ms` retrieval latency.

### 2.6 Leads, CRM & Customer Journey Timeline (`#/leads`) — Priority: P0
- **Current Status:** `LeadManagementPanel.tsx` supports 4 views (`List`, `Pipeline`, `Cards`, `Priority`), CSV Column Mapper, and basic Lead Drawer (`call_history`, `consent_history`).
- **Required Changes:**
  - **Frontend:** Upgrade Lead Drawer into a full **Customer Journey Timeline** merging: Lead Source -> Calls (with transcript/audio links) -> WhatsApp/SMS messages -> Appointments -> Rep Notes -> Consent Events -> Next Scheduled Action. Add **Sales Rep Assignment** dropdown and **Lead Score Badge** (`Hot / Warm / Cold / Callback / Not Interested`, 0–100 score).
  - **Backend / DB / API:** Add `leads.assigned_user_id`, `leads.lead_score`, `leads.score_tier`, `leads.score_reasons_json`, `lead_activities` unified timeline table; add `GET /api/leads/{id}/timeline` and configurable workspace scoring rules `GET/PUT /api/leads/scoring-rules`.
  - **Security & Testing:** Enforce `operator` scoping option if workspace restricts reps to assigned leads; fix CSV import default consent (`pending` unless explicit proof column mapped).
  - **Acceptance Criteria:** Clicking any lead displays complete chronological history across calls, messages, appointments, and score rationale.

### 2.7 Campaign Studio (`#/campaigns`) — Priority: P0
- **Current Status:** `CampaignManagerPanel.tsx` + `campaigns.py` + `campaign_service.py`. Contains UI `calling_hours` string bug (422), hardcoded `te-IN` in `start_campaign`, and synchronous initial dispatch.
- **Required Changes:**
  - **Frontend:** Fix `calling_hours` payload (`{ start, end, timezone: "Asia/Kolkata" }`); add multi-step Campaign Wizard (Audience List + Suppression List -> AI Employee -> Schedule & Retry Policy -> TRAI/DLT Compliance Preflight -> Launch/Schedule); show live queued/dialing/retry/completed telemetry.
  - **Backend / DB / API:** Read `agent["language"]` instead of hardcoded `"te-IN"`; enqueue campaign execution to Redis/Celery worker; restrict `bypass_trai` to verified `transactional`/`service` exemptions; deduplicate `campaign_jobs` via unique index `(campaign_id, phone)`.
  - **Acceptance Criteria:** Creating and scheduling a Hindi/Tamil/Telugu campaign from UI succeeds with 0 schema errors, dials in the agent's language via background workers, and respects DNC/weekday/24h caps.

### 2.8 Live Call Command Center (`#/live-calls`) — Priority: P0
- **Current Status:** Only `GET /api/calls/active` polling and post-hoc `POST /api/calls/{id}/transfer` stub.
- **Required Changes:**
  - **Frontend:** New **Live Call Command Center** showing active calls table + real-time streaming transcript panel, caller sentiment indicator, call duration ticker, and supervisor actions: **Listen (Silent Monitor)**, **Whisper (Coach AI)**, **Join / Warm Transfer to Human**, **Force Hangup**.
  - **Backend / DB / API:** WebSocket feed `/api/calls/live/ws` backed by Redis Pub/Sub; live call control endpoints (`POST /api/calls/{id}/monitor`, `POST /api/calls/{id}/whisper`, `POST /api/calls/{id}/hangup`, and real carrier bridging in `POST /api/calls/{id}/transfer`).
  - **Security & Testing:** Require `owner`, `admin`, or `manager` role for monitor/whisper/hangup; audit every supervisor intervention.
  - **Acceptance Criteria:** Active calls appear within `< 1s` of answer with live streaming transcript turns and working Hangup/Transfer controls.

### 2.9 Call History & Conversation Intelligence (`#/conversations`) — Priority: P0
- **Current Status:** `CallIntelligencePanel.tsx` displays transcripts, `.txt` export, CSV export, summary/sentiment, and hardcoded `+918047361234` inbound test.
- **Required Changes:**
  - **Frontend:** Replace hardcoded `+918047361234` with workspace's own configured inbound number; display **Conversation Intelligence Cards**: Detected Intents, Objections Raised, Competitor Mentions, Unanswered Questions (with one-click "Add to Knowledge Base" button!), and QA/CSAT Score.
  - **Backend / DB / API:** Expand `call_extractions` with `intents_json`, `objections_json`, `competitors_json`, `unanswered_questions_json`, `csat_score`, `qa_flags_json`; automatically run post-call intelligence job in background worker on `call.completed`.
  - **Acceptance Criteria:** Every completed call automatically generates structured objections, unanswered questions, and disposition mapping without manual button click.

### 2.10 Visual Automation Studio (`#/automations`) — Priority: P1
- **Current Status:** Not implemented (only `@xyflow/react` call script canvas exists in `AgentStudioPanel`).
- **Required Changes:**
  - **Frontend:** Node-based trigger->condition->action workflow editor (`Call Completed` / `Lead Created` / `Appointment Booked` -> `If Score >= 70` -> `Create CRM Deal` + `Send WhatsApp Template` + `Notify Rep` + `Schedule Follow-up Call` + `Trigger n8n Webhook`).
  - **Backend / DB / API:** Tables `automation_workflows`, `automation_runs`; async rule evaluator triggered by domain events (`call.completed`, `lead.created`, `appointment.booked`); CRUD `/api/automations/*` + run history logs.
  - **Acceptance Criteria:** A workflow configured in UI executes reliably in background workers on `call.completed` with idempotent step logs.

### 2.11 Smart Appointment Manager (`#/appointments`) — Priority: P1
- **Current Status:** Missing (`ActionService` `google_calendar` only does `GET .../events?maxResults=5`).
- **Required Changes:**
  - **Frontend:** Calendar & list view of AI-booked site visits/consultations; working hours & slot buffer settings; reschedule/cancel/no-show controls.
  - **Backend / DB / API:** `appointments` & `calendar_connections` tables; real Google Calendar FreeBusy + `POST/PATCH/DELETE` event API + local slot lock preventing double-booking; automated WhatsApp/email reminders.
  - **Acceptance Criteria:** Mid-call `book_appointment` tool checks real availability, locks slot atomically, creates Google Calendar event, and sends WhatsApp confirmation.

### 2.12 Integrations Hub (`#/integrations`) — Priority: P1
- **Current Status:** 20 catalog items in `integrations.py`, plaintext `config_json`, stubbed `google_sheets`, fake `/test`.
- **Required Changes:**
  - **Frontend:** OAuth 2.0 connect flows for Google Calendar/Sheets and Zoho/HubSpot/LeadSquared; clear `Connected / Degraded / Not Configured` badges; payload field mapper.
  - **Backend / DB / API:** Encrypt `config_json` at rest; implement real Google Sheets `values:append` API, Zoho/LeadSquared CRM upsert adapters, and real auth probe in `/test`.
  - **Acceptance Criteria:** Connecting an integration encrypts tokens, verifies live connectivity via real upstream API, and retries failed syncs in worker.

### 2.13 Analytics & Business ROI (`#/performance`) — Priority: P0
- **Current Status:** `AnalyticsPanel.tsx` shows basic call counts and daily bar chart (with oldest-days SQL bug).
- **Required Changes:**
  - **Frontend:** Add **Business ROI Funnel** (Total Leads -> Dialed -> Connected -> Qualified -> Appointments -> Converted), **Cost per Qualified Lead**, **Cost per Appointment**, **Estimated Pipeline Value**, campaign filter, and CSV/PDF report export.
  - **Backend / API:** Fix `ORDER BY day DESC` windowing; add `GET /api/analytics/roi` and funnel aggregation queries.
  - **Acceptance Criteria:** Business owner sees exact spend vs. qualified leads & cost per appointment for any 7/30/90-day window.

### 2.14 Team Management (`#/settings` / `#/team`) — Priority: P0
- **Current Status:** `workspaces.py` creates `invite_token` but has no `/accept-invite` endpoint, sends no email, and lacks `ROLE_HIERARCHY` guard on `update_member_role`.
- **Required Changes:**
  - **Frontend:** Dedicated Team tab/section with pending invite resend/revoke, role selector (`owner`, `admin`, `manager`, `operator`, `viewer`), and `/accept-invite?token=...` onboarding page.
  - **Backend / API:** Add `POST /api/auth/accept-invite`, send invitation via `EmailService`, enforce `ROLE_HIERARCHY` + `users.token_version` bump on suspension/removal.
  - **Acceptance Criteria:** Invited salesperson receives link, sets password, joins workspace with scoped RBAC enforced on every endpoint.

### 2.15 Billing & Wallet (`#/billing`) — Priority: P0
- **Current Status:** `FinancialLedgerPanel.tsx` + `billing.py` (has Razorpay commit/race bugs, pricing copy mismatch vs `PricingSection.tsx`, unbilled numbers/channels).
- **Required Changes:**
  - **Frontend:** Align `PricingSection.tsx` & `FinancialLedgerPanel.tsx` dynamically to `GET /api/billing/pricing` (zero hardcoded mismatched rates!); wire subscription plan upgrade UI (`GET/POST /api/billing/subscription`); add auto-recharge settings & low-balance banner.
  - **Backend / DB / API:** Fix atomic Razorpay transaction & unified idempotency key; charge `premium` vs `standard` voice tier dynamically from `platform_settings`; bill monthly number/channel rentals via recurring worker job; separate prepaid top-up receipts from usage tax invoices.
  - **Acceptance Criteria:** Zero payment double-credits or lost credits under concurrent webhook/client callback; number/channel additions debit wallet or enforce plan limits.

### 2.16 Developer Portal (`#/developers`) — Priority: P2
- **Current Status:** `DevelopersPanel.tsx` manages API keys, webhooks, and logs; API key scopes ignored in `dependencies.py`; `webhook.include_transcripts` ignored in `WebhookService`.
- **Required Changes:**
  - **Frontend:** Scope checkboxes when creating API keys, revoke button wired to `DELETE /api/workspaces/api-keys/{id}`, live webhook signature tester, interactive OpenAPI/cURL playground.
  - **Backend:** Enforce `api_keys.scopes_json` in `get_current_user`; honor `include_transcripts`; process webhook retries with exponential backoff in worker.

### 2.17 Mobile Experience — Priority: P2
- **Current Status:** Responsive Tailwind grid/sidebar drawer; tables overflow horizontally and `@xyflow/react` conflicts with touch scroll.
- **Required Changes:** Card-based mobile views for Leads/Calls/Campaigns, `overflow: hidden` body lock on mobile drawer open, read-only linear step view for Call Flow on `< 768px`, and WhatsApp/email/push urgent escalation alerts.

