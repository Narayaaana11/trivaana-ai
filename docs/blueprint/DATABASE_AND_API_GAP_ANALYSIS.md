# TRIVAANA AI — Database & API Gap Analysis

**Date:** November 11, 2026  
**Sources Audited:** `backend/database.py`, `backend/database/schema.py`, `backend/database/postgres_pgvector_schema.sql`, `backend/routers/*.py`, `frontend/src/lib/trivaana-api.ts`, `frontend/src/components/dashboard/*.tsx`.

---

## 1. Database Engine & Schema Drift Audit

### 1.1 Dead / Conflicting Module
* `backend/database.py` (325 lines) defines an obsolete v1 SQLite schema with floating-point money (`wallet_balance REAL`, `rate_per_min REAL`, `cost REAL`) and `tenants.api_key` plaintext column. Because `backend/database/` is a Python package (`__init__.py`), imports resolve to `backend/database/`, leaving `backend/database.py` as dead code that risks accidental execution (`python database.py`). **Action:** Delete `backend/database.py` after verifying zero imports.

### 1.2 SQLite (`schema.py`) vs. PostgreSQL (`postgres_pgvector_schema.sql`) Drift
| Table / Object | SQLite (`schema.py`) | PostgreSQL (`postgres_pgvector_schema.sql`) | Impact & Fix |
|---|---|---|---|
| `tenants.api_key_hash` | `UNIQUE NOT NULL` | `NOT NULL` (missing `UNIQUE`) | Add `UNIQUE` constraint |
| `users.email` | `UNIQUE NOT NULL` | `NOT NULL` (missing `UNIQUE`) | **Critical:** Duplicate emails possible on PG! Add `UNIQUE` |
| `auth_tokens.token_hash` | `UNIQUE NOT NULL` | `NOT NULL` (missing `UNIQUE`) | Add `UNIQUE` |
| `api_keys.key_hash` | `UNIQUE NOT NULL` | `NOT NULL` (missing `UNIQUE`) | Add `UNIQUE` |
| `agents.slug` | `UNIQUE` index / column | Non-unique index `idx_agents_slug` | Make `UNIQUE` so `lead-intake/{slug}` is unambiguous |
| `transactions.idempotency_key` | `TEXT UNIQUE` | `TEXT` (missing `UNIQUE`) | **Critical:** Double-credit race condition on PG! Add `UNIQUE` |
| `invoices.invoice_number` | `TEXT UNIQUE` | `TEXT NOT NULL` (missing `UNIQUE`) | `INSERT OR IGNORE` -> `ON CONFLICT DO NOTHING` does nothing without unique constraint |
| `webhook_deliveries.idempotency_key` | `UNIQUE` | Missing `UNIQUE` | Add `UNIQUE` |
| `compliance_policies.tenant_id` | `UNIQUE` | Missing `UNIQUE` | Add `UNIQUE` |
| `webhooks.include_transcripts` | Added via `_safe_add_columns` (`schema.py:916`) | **COMPLETELY MISSING** | Queries referencing `include_transcripts` crash on PG! |
| `campaigns.suppression_list_id`, `calling_days_json` | Added via `_safe_add_columns` | **COMPLETELY MISSING** | Campaign creation crashes on PG! |
| `CREATE INDEX ...` (L727–742) | `IF NOT EXISTS` | Missing `IF NOT EXISTS` | Re-init throws errors silently swallowed by `except Exception: conn.rollback()` |
| `knowledge_chunks_pg` | N/A | `embedding vector(1536)` | `KnowledgeService.ingest_document` never writes here; local embeddings are `128` dims (dimension mismatch error on insert) |

### 1.3 Connection Pooling & Query Bugs
* `backend/database/connection.py:101-130`: `get_connection()` creates a fresh `psycopg.connect(...)` per HTTP request with no `psycopg_pool.ConnectionPool` -> exhausts Postgres connections under concurrency.
* `backend/routers/tenant.py:113-133`: `ORDER BY day ASC LIMIT ?` fetches the *oldest* 30 days instead of the *most recent* 30 days.
* `backend/routers/inbound.py:48`: `SELECT * FROM phone_numbers WHERE phone_number = ? LIMIT 1` lacks deterministic tenant/verified filtering if duplicate sandbox numbers exist.

---

## 2. Required New Database Tables (Target v3.0 Schema via Alembic)

| Domain | New Tables / Columns | Purpose |
|---|---|---|
| **Auth & Security** | `users.token_version`, `users.status`, `users.phone`; `promo_credits` | Instant JWT invalidation on password reset/removal; gated promo credits instead of free ₹5,000 |
| **Financial Ledger** | `ledger_accounts`, `ledger_entries` (double-entry: liability vs revenue vs COGS), `provider_usage_costs`, `wallet_adjustments` | Separate prepaid customer liabilities from earned revenue, track provider COGS & gross margin |
| **Internal Staff Portal** | `staff_users`, `staff_roles`, `staff_sessions`, `support_tickets`, `ticket_messages`, `staff_tasks`, `approval_requests`, `impersonation_sessions`, `staff_audit_logs` | 7-role internal RBAC, support ticketing with SLAs, dual-control refunds/exemptions, audited View-as-Customer |
| **Provider Control** | `provider_configs` (encrypted), `provider_routing_rules`, `provider_health_checks`, `kyc_submissions` | Platform provider management, failover chains, DLT/PE/140-160 KYC approvals |
| **AI Studio & Testing Lab** | `agent_versions` (`eval_score`, `eval_summary_json`), `agents.published_version_id`, `agent_test_suites`, `agent_test_cases`, `agent_eval_runs` | Draft vs published separation, automated persona/latency/hallucination evals |
| **CRM & Automation** | `leads` (`assigned_user_id`, `lead_score`, `score_tier`, `score_reasons_json`), `lead_activities`, `appointments`, `calendar_connections`, `automation_workflows`, `automation_runs` | Customer Journey Timeline, lead scoring, double-booking-safe appointments, visual workflows |
| **Call Intelligence** | `call_extractions` (`intents_json`, `objections_json`, `competitors_json`, `unanswered_questions_json`, `csat_score`, `qa_flags_json`) | Structured conversation intelligence |
| **Feature Overrides** | `tenant_feature_overrides` | Per-tenant feature flag overrides |

---

## 3. Frontend ↔ Backend API Contract Gap Matrix

### 3.1 Broken / Mismatched Contracts (Observed in Code)
| Location | Frontend Sends / Displays | Backend Expects / Implements | Impact |
|---|---|---|---|
| `CampaignManagerPanel.tsx:49,121` -> `POST /api/campaigns` | `calling_hours: "09:00-18:00"` (string) | `CreateCampaignRequest.calling_hours: Optional[Dict[str, Any]]` | **HTTP 422 Validation Error** on campaign creation from UI |
| `PricingSection.tsx:102,115,126` vs `core/config.py:168-172` & `billing.py:125-128` | Header says `₹5.00/₹6.80`; Cards say `₹6.50/₹8.50`, Starter = `2` channels, Growth = `10` channels | `core/config.py` = `650/850` paise; `billing.py` Starter = `5` channels, Growth = `15` channels | Customer confusion & mismatched billing expectations |
| `CallService.process_call_event` (`call_service.py:142`) | Expects Standard vs Premium voice rate + Admin tariff overrides | Hardcoded `settings.RATE_STANDARD_PAISE_PER_MIN` (`650`) | Premium ElevenLabs calls billed at Standard rate; Admin tariff changes ignored! |
| `CampaignService.start_campaign` (`campaign_service.py:219`) | Agent configured in `hi-IN`/`ta-IN`/`en-IN` | Hardcodes `language="te-IN"` to `CallService.initiate_call` | Non-Telugu campaigns create call logs tagged `te-IN` |
| `public_intake.py:56,225` | `delay_seconds` field (`0..3600`) | Accepts & echoes `delay_seconds` but dials **immediately** | Delayed callbacks execute instantaneously |
| `IncomingCallsPanel.tsx:163-179` | `Messages` sub-tab | Renders `inboundCalls` identically to `Calls` tab | No dedicated voicemail/message filtering |
| `CallIntelligencePanel.tsx:96` | `Test Inbound Call` button | Hardcodes `to_number: '+918047361234'` | Fails (`404`/`403`) for non-demo workspaces |
| `InstantLeadsPanel.tsx:146` | SLA metric card | Hardcoded `<SplitFlapText text="< 15S" />` | Displays fake constant instead of measured intake-to-dial latency |
| `SettingsPanel.tsx:44-48` | Alert preference toggles (`liveCallBanner`, `failedWebhookAlerts`, `lowBalanceThresholdInr`) | Local `useState` only | Preferences lost on page reload |
| `ActionService` (`action_service.py:61,140,178`) | `google_calendar`, `google_sheets`, `call_transfer` tools | `google_calendar` only `GET`s 5 events; `google_sheets` makes **0 HTTP calls**; `call_transfer` makes **0 carrier API calls** | Actions report `"executed"` without performing real bookings, sheet appends, or PSTN transfers |

### 3.2 Existing Backend Endpoints Missing from Frontend UI
* `GET /api/admin/users` (exists in `admin.py:122`, missing in `SuperAdminPanel.tsx` & `trivaana-api.ts`)
* `GET /api/billing/subscription` & `POST /api/billing/subscription` (exists in `billing.py:102-164`, missing in `trivaana-api.ts` & `FinancialLedgerPanel.tsx`)
* `POST /api/voice-engine/livekit-token` (exists in `voice_engine.py:75`, missing in `trivaana-api.ts` & `LiveCallSimulatorModal.tsx`)
* `GET /api/public/lead-intake/{slug}/schema` (exists in `public_intake.py:64`, not fetched by `InstantLeadsPanel.tsx`)
* `DELETE /api/agents/{agent_id}` & `POST /api/agents/{id}/lifecycle` (partially bypassed by raw `PUT`)
* `DELETE /api/workspaces/api-keys/{key_id}` (missing in `trivaana-api.ts`)

