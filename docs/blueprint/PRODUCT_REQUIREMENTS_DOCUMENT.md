# TRIVAANA AI — Product Requirements Document (PRD)

**Version:** 3.0 Target Blueprint  
**Date:** November 11, 2026  
**Product Direction (Recommended & Parameterized):**
- **Market Strategy:** **India-first launch, global expansion architecture** (launch optimized for `te-IN`, `hi-IN`, `ta-IN`, `kn-IN`, `ml-IN`, `mr-IN`, `en-IN`, Indian PSTN carriers Exotel/Plivo/Vobiz, INR paise + 18% GST SAC 998313, TRAI/DLT compliance; multi-currency/multi-region SIP abstractions ready for global Twilio/LiveKit expansion).
- **Competitive Positioning:** **Complete AI Workforce + Business Automation Platform** — not a bare dialer or transcript viewer, but an end-to-end acquisition and communication operating system where every call leads to qualified CRM pipeline progression, booked appointments, WhatsApp confirmations, or warm human handoffs.
- **Business Model:** **Hybrid SaaS** (self-service SMB plans ₹2,999–₹24,999/mo + metered talk time, alongside managed enterprise onboarding and internal Staff Portal operations).

---

## 1. Five Core Product Pillars

1. **Customer Experience** — Simple enough for a non-technical Indian SMB owner (real estate builder, clinic owner, coaching institute) to launch in < 15 minutes using guided industry templates.
2. **AI Employee Experience** — Complete AI Employee Studio with versioning, regression testing lab, voice preview, grounded Knowledge Hub, and safe guardrails.
3. **Calling Infrastructure** — Sub-second streaming multilingual conversations (`STT -> LLM -> RAG -> Tools -> TTS`), carrier failover, and durable queued campaign execution.
4. **Business Automation** — Turn call outcomes into CRM opportunities, calendar bookings, WhatsApp follow-ups, visual workflow automations, and verifiable ROI metrics.
5. **Platform Administration** — Full Super Admin & Internal Staff Portal with RBAC, audited impersonation, Provider Control Centre, financial liabilities vs. revenue ledger, compliance oversight, and emergency kill switches.

---

## 2. Reference End-to-End Customer Journey (Real Estate Example)

- **Workspace Profile:** Real estate developer with 5,000 leads, 10 sales reps, and 200+ daily inbound/ad enquiries.
- **Step 1 — Onboarding:** Owner registers (verified email/phone OTP, zero exploitable live calling balance until verified/topped up), enters GSTIN & business details, invites 10 team members with role-based permissions (`manager`, `operator`, `viewer`).
- **Step 2 — AI Employee Creation:** Picks a Real Estate Telugu/English template in **AI Employee Studio**, configures identity, voice (`Sarvam` or `ElevenLabs`), objectives, objection handling, and fallback rules; saves as `v1 (Draft)`.
- **Step 3 — Training & Grounding:** Uploads project brochure PDFs, price sheets, RERA FAQs, and website URLs into **Knowledge Hub**; verifies retrieval chunks.
- **Step 4 — Pre-Launch QA:** Opens **Agent Testing Lab**, simulates Telugu-English code-switching (*"Mee project ekkada undi? Price konchem thagguthunda? Next Sunday visit cheyocha?"*) via text and live microphone, checks latency, hallucination guard, and goal completion score; publishes `v1`.
- **Step 5 — Lead Acquisition & Calling:** Connects Meta Lead Ads / website forms to **Instant Leads** (`< 30s` callback), imports CSVs with consent proofs into **Leads & CRM**, and schedules a **Bulk Campaign** within TRAI `10:00–18:00` IST hours.
- **Step 6 — Business Outcomes:** AI qualifies leads (`Hot / Warm / Cold`), books site visits in **Appointment Manager** (Google Calendar free/busy check), triggers **WhatsApp** location pin confirmation, updates **Customer Journey Timeline**, and escalates complex negotiations via warm **Human Handoff** while supervisors monitor in **Live Call Command Center**.
- **Step 7 — ROI & Billing:** Owner tracks spend (`₹`), cost per qualified lead, site visits booked, and downloads GST ITC tax invoices.

---

## 3. Four-Portal Platform Structure & Priority Matrix

### Portal A: Customer Application
| Module | Priority | Core Functional Requirement | Current Status in Codebase |
|---|---|---|---|
| **Overview** | P0 | Live KPIs, spend burn rate, quick-launch wizard, recent outcomes, system readiness banner | Implemented (missing spend burn/ROI KPIs, onboarding checklist persistence) |
| **AI Employees Studio** | P0 | 22+ structured fields, prompt architect, `@xyflow/react` visual call flow, draft/publish/rollback **versioning** with eval scores | Implemented (missing eval linkage on versions, template cloning polish) |
| **Agent Testing Lab** | P0 | Text + **live microphone WebRTC/WS**, simulated buyer personas/objections, noise/speed/code-switching tests, latency & hallucination scoring, regression suites | Text turn tester only (`LiveCallSimulatorModal.tsx`); missing mic, personas, noise, eval suite |
| **Voice Studio** | P0 | Multi-provider voice catalogue (`Sarvam`, `ElevenLabs`, `OpenAI`, `IndicF5`), speed/stability/emotion preview, verified status badge | Implemented (`voices.py`) |
| **Knowledge Hub** | P0 | PDF/DOCX/CSV/URL/FAQ upload, chunk preview, `pgvector` indexing, retrieval score tester | SQLite chunking works; `pgvector` ingestion missing; basic HTML strip |
| **Leads & CRM** | P0 | 4-view CRM, CSV column mapper, **Customer Journey Timeline**, **Intelligent Lead Scoring**, rep assignment | 4-view CRM + drawer exists; missing automated scoring, rep assignment, unified timeline |
| **Campaign Studio** | P0 | Reusable/suppression lists, weekday/IST hours, durable queue, retries, pause/resume/kill | Implemented (bugs: `calling_hours` UI 422, hardcoded `te-IN`, sync dispatch) |
| **Live Call Command Center** | P0 | Real-time active call grid, live streaming transcript, **Listen / Whisper / Join / Warm Transfer / End Call** controls | Basic `/calls/active` list & post-call transfer; missing real-time WS stream & supervisor barge-in/listen |
| **Call History & Intelligence** | P0 | Recordings, timestamped transcripts, intent/objection/sentiment/competitor extraction, unanswered question tracker | Basic summary/sentiment/extracted fields; missing objection/competitor/CSAT intelligence |
| **Team Management** | P0 | Invite/accept flow, 5-role RBAC enforcement across all endpoints, rep lead ownership | Invite creation exists; **no `/accept-invite`**, RBAC missing on several routers |
| **Billing & Wallet** | P0 | Razorpay atomic checkout/webhooks, GST SAC 998313 invoices, number/channel subscription billing, auto-recharge alerts | Core ledger exists; **critical Razorpay commit/race bugs & zero-cost numbers/channels** |
| **Automation Studio** | P1 | Visual trigger->condition->action builder (Call Completed -> Score -> CRM -> WhatsApp -> Follow-up) + n8n webhook bridge | Missing (only `@xyflow/react` call script canvas exists) |
| **Appointment Manager** | P1 | Calendar sync, real availability slots, book/reschedule/cancel without double-booking, reminders | Missing (`google_calendar` action only reads 5 events) |
| **Integrations Hub** | P1 | 18-connector marketplace with encrypted credentials, real OAuth flows, live health probe, sync retry | Plaintext `config_json`, stubbed `google_sheets`, fake `/test` probe |
| **Analytics & Business ROI** | P0 | Conversion funnel, cost per qualified lead, cost per appointment, agent comparison, recent-window daily series | Basic charts exist (`days` query bug shows oldest days); missing ROI & funnel |
| **Developer Portal** | P2 | Scoped API keys, HMAC webhooks, delivery retry logs, interactive API explorer & SDK snippets | API keys/webhooks UI exists; scopes ignored, webhook retries missing |
| **Mobile Experience** | P2 | Responsive drawer layout, mobile-friendly call/lead triage, push/WhatsApp urgent alerts | Responsive Tailwind classes exist; needs full mobile triage & alerts |

### Portal B: Internal Staff Portal (New — Required for Operations Team)
| Module | Priority | Core Functional Requirement |
|---|---|---|
| **Staff Auth & 7-Role RBAC** | P0 | Dedicated `staff_users` & role matrix (`Super Admin`, `Operations`, `Finance`, `Support`, `Developer`, `Sales`, `Compliance`) |
| **Audited "View as Customer"** | P1 | Reason-tagged, time-bounded read-only impersonation session with visible banner & customer audit log |
| **Support & Ticketing Inbox** | P1 | Ticket lifecycle, SLA timers, escalation, internal notes, Chatwoot integration |
| **Task & Customer Ownership** | P1 | Assign onboarding/implementation tasks and account managers to enterprise/hybrid customers |
| **Approval Workflows** | P1 | Dual-control approval for wallet refunds, manual adjustments, KYC approvals, and `bypass_trai` exemptions |

### Portal C: Super Admin Platform Control Centre
| Module | Priority | Core Functional Requirement |
|---|---|---|
| **Platform Command Overview** | P0 | Real MRR, active tenants, daily call volume, live error rate, API/Voice/DB/Gateway health |
| **Tenant & Subscription Control** | P0 | Create/suspend/activate workspaces, plan overrides, trial/promo credit limits, concurrency caps |
| **Financial Control Centre** | P0 | Prepaid Wallet Liabilities vs. Earned Usage Revenue vs. Provider COGS, GST reconciliation, refunds, gross margin |
| **Provider Control Centre** | P0 | Manage LLM/STT/TTS/Telephony/LiveKit/Razorpay/SMTP/S3 keys (encrypted), health probes, **language/latency/cost failover routing** |
| **Platform Live Call & Campaign Monitor** | P1 | Cross-tenant active calls, failure spikes, pause/kill any tenant campaign |
| **Compliance & Security Centre** | P0 | Platform DLT/PE/140-160 KYC approvals, global suppression, login anomaly detection, audit log explorer |
| **Emergency Controls Panel** | P0 | Global outbound kill switch, tenant kill switch, disable compromised provider, maintenance mode (all audited with reason) |

---

## 4. Non-Functional Requirements & Commercial SLAs

| Metric | P0 Commercial Target | Current Baseline / Gap |
|---|---|---|
| **Voice Turn-Taking Latency (P95)** | `< 900 ms` mouth-to-ear (streaming STT -> LLM -> TTS) | Synchronous turn execution (`RealtimeVoicePipeline.run_turn`) blocks on full STT + LLM + TTS |
| **Ledger & Payment Accuracy** | `0` paise drift; `100%` atomic payment-to-credit consistency; `0` double credits | Race condition & commit-before-credit bugs identified in `billing.py` |
| **Tenant Isolation** | `100%` scoped queries + verified media/storage isolation | Cross-tenant media traversal bug in `/api/media/*`; `inbound.py` `LIMIT 1` collision risk |
| **API Availability & Concurrency** | Pooled PostgreSQL (`psycopg_pool`), Redis-backed rate limits & Celery/ARQ queues | Single-connection-per-request Postgres; Celery tasks unused |
| **Security & Compliance** | Encrypted secrets at rest, scoped API keys, RBAC on all endpoints, TRAI/DLT/DPDP controls | Missing RBAC, plaintext `integrations.config_json`, unverified `bypass_trai` |

