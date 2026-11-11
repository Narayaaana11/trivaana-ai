# TRIVAANA AI — Super Admin Platform Control Centre Blueprint

**Scope:** Dedicated platform-owner console isolated from customer workspaces (`/admin/*` or standalone Admin SPA route), replacing the minimal 4-tab `SuperAdminPanel.tsx` and 10-endpoint `routers/admin.py`.  
**Core Rule:** Every state-changing admin action MUST require explicit authorization, record `actor_staff_id`, `reason`, `ip_address`, and write an immutable `admin_audit_logs` entry.

---

## 1. Current State vs. Target Gap
* **Currently Implemented (`admin.py`, `SuperAdminPanel.tsx`):**
  * `GET /api/admin/overview` (workspace/user/call/error counts)
  * `GET /api/admin/workspaces`, `POST .../suspend`, `POST .../activate`
  * `GET /api/admin/users` (backend only — **not rendered in UI**)
  * `GET /api/admin/settings`, `PUT /api/admin/settings/tariffs`
  * `GET /api/admin/feature-flags`, `PUT /api/admin/feature-flags/{key}`
  * `GET /api/admin/failed-calls`, `GET /api/admin/system-errors`, `GET /api/admin/audit-logs`
  * **Security flaw:** `MissionControl.tsx` allows any tenant to navigate to `#/admin` and fire 403 errors; `seed.py` auto-promotes `demo@trivaana.ai` to `is_super_admin=1`.
* **Missing:** Financial control (liabilities vs revenue vs provider COGS, refunds, adjustments, GST reconciliation), Provider Control Centre (credentials, health checks, failover routing), Subscriptions CRUD, Live Call & Campaign global monitor, Compliance & KYC approvals, Support escalation view, Emergency Kill Switches, and Infrastructure telemetry.

---

## 2. Complete 22-Section Super Admin Navigation & Module Specs

| # | Section | Priority | Core Capabilities & Controls |
|---|---|---|---|
| 1 | **Dashboard (Platform Overview)** | P0 | Real-time MRR/ARR, Active Tenants, Prepaid Liabilities vs. Earned Revenue, Calls Today, Active Concurrent Channels, P95 Voice Latency, Live Service Health (`API`, `Voice Worker`, `PostgreSQL`, `Redis`, `Razorpay`, `Exotel/Twilio/Sarvam`). |
| 2 | **Customers / Tenants** | P0 | Search/filter tenants; view plan, wallet, concurrency cap, KYC status; create enterprise tenant; adjust concurrency/plan limits; suspend/activate with mandatory reason; link to audited "View as Customer". |
| 3 | **Users** | P0 | Wire & expand `GET /api/admin/users`: search across platform, view MFA/email verification/last login, force session revoke (`token_version++`), disable compromised user account. |
| 4 | **Subscriptions** | P0 | Manage subscription plans catalog (`PayG`, `Starter`, `Growth`, `Enterprise`, `Custom`), trials, renewals, upgrades/downgrades, grace periods, and enterprise custom rate cards. |
| 5 | **Wallet Management** | P0 | Manual credit/debit adjustments, promotional credit grants (with expiry & cap), refunds — **all requiring `reason` + dual-control approval above threshold (e.g. > ₹5,000)** and immutable transaction entry. |
| 6 | **Revenue & Finance** | P0 | Separate **Customer Wallet Liabilities (Prepaid Balances)** from **Recognized Platform Revenue (Usage + Subscriptions + Rentals)**, **Provider COGS**, **GST Collected (SAC 998313)**, **Gross Margin per Tenant/Plan**, Razorpay settlement reconciliation report. |
| 7 | **AI Employees** | P1 | Platform-wide inventory of active agents, language distribution, failure/hallucination error rates (privacy-preserving: metadata/metrics without exposing raw customer PII unless ticket-authorized). |
| 8 | **AI Providers (LLM/STT)** | P0 | Provider Control Centre for `OpenAI`, `Gemini`, `Whisper`, `Faster-Whisper`, `IndicConformer`, `Sarvam ASR`: encrypted keys, test connection, error logs, rate limits, default/fallback routing rules. |
| 9 | **Voice Management (TTS)** | P0 | Global `voice_profiles` catalogue manager: enable/disable voices, map Standard vs. Premium billing tiers, run live verification probes, set per-language TTS fallback chain (e.g., `te-IN`: Sarvam -> ElevenLabs). |
| 10 | **Telephony** | P0 | Carrier Control Centre (`Exotel`, `Twilio`, `Plivo`, `Vobiz`, `LiveKit SIP`): trunk health, DLT/KYC verification approval queue for tenant numbers, 140/160 series assignment, carrier webhook diagnostics. |
| 11 | **Live Call Monitor** | P1 | Cross-tenant real-time active call count, concurrent channel utilization vs. carrier trunk capacity, failure spike alerts, ability to force-terminate runaway/abusive calls. |
| 12 | **Campaign Management** | P0 | View running/scheduled campaigns across tenants; pause or emergency-kill abusive or broken campaigns; inspect circuit-breaker trips (`401/402/403`). |
| 13 | **Usage & Costs** | P0 | Per-provider metering (`STT seconds`, `LLM tokens`, `TTS chars`, `Telephony mins`) vs. tenant billed amount (`paise`) to detect negative-margin accounts. |
| 14 | **Integrations** | P1 | Global OAuth app credentials (`Google`, `Meta WhatsApp`, `Zoho`, `HubSpot`), integration error rate monitor, webhook delivery failure queue. |
| 15 | **Compliance Centre** | P0 | Approve/reject tenant **Principal Entity (PE) ID / DLT / KYC** submissions, manage global platform suppression lists, review `bypass_trai` exemption requests, DPDP deletion queue. |
| 16 | **Support Centre** | P1 | View escalated tickets from Internal Staff Portal, SLA breaches, and customer incident timelines. |
| 17 | **Notifications** | P1 | Broadcast platform announcements, scheduled maintenance banners, or provider incident notices to all/selected tenants. |
| 18 | **Feature Flags** | P0 | Global AND **per-tenant override** feature flags (`feature_flags` + `tenant_feature_overrides`) for gradual rollouts and beta access. |
| 19 | **Infrastructure** | P0 | Live container/worker telemetry: PostgreSQL pool utilization, Redis memory/queue depth, Celery/ARQ worker heartbeat, LiveKit room count, S3 storage usage, error triage (`resolve` system errors). |
| 20 | **Security Centre** | P0 | Failed login bursts, IP rate-limit blocks, API key anomaly spikes, active admin/staff sessions, secret rotation status. |
| 21 | **Developer Management** | P2 | Platform API usage quotas, per-tenant webhook rate limits, global API deprecation notices. |
| 22 | **System Settings & Audit Logs** | P0 | Global tariffs, GST %, maintenance mode toggle, retention policies, and searchable/exportable immutable `audit_logs` explorer. |

---

## 3. Dedicated Emergency Controls Panel (P0)

Every Super Admin screen must include rapid access to an audited **Emergency Control Panel** with explicit confirmation modal + mandatory reason field:
1. **Global Outbound Kill Switch:** Immediately pause all `running` and `scheduled` campaigns & broadcasts platform-wide (`feature_flag: global_outbound_enabled = false` + worker pause).
2. **Tenant Kill Switch:** Freeze all active/queued calls and API dialing for a single tenant.
3. **Provider Circuit-Break:** Disable a failing or compromised provider (`exotel`, `sarvam`, `openai`, etc.) and automatically activate configured fallback provider.
4. **Account / API Key Freeze:** Revoke all active JWTs (`token_version++`) and API keys for a compromised user/workspace.
5. **Maintenance Mode:** Return `503 Service Unavailable` with status banner on customer mutations while keeping health/admin endpoints accessible.

---

## 4. Technical Implementation Specs (Summary Matrix)

* **Frontend Changes:** Isolate Super Admin into dedicated route tree (`/admin/*`) gated by `staff_session` (not inside customer `MissionControl` sidebar); build modular sub-views for Provider Control Centre, Financial Liabilities/Margin Ledger, Emergency Controls, KYC Queue, and User Manager.
* **Backend Changes:** Split `routers/admin.py` into `routers/admin_tenants.py`, `admin_finance.py`, `admin_providers.py`, `admin_operations.py`, `admin_compliance.py`; enforce `require_staff_role(["super_admin"])` or granular staff permissions.
* **Database Changes:** Add `provider_configs` (encrypted), `provider_health_checks`, `provider_usage_costs`, `tenant_feature_overrides`, `kyc_submissions`, `wallet_adjustments` (with dual-approval), `platform_incidents`, `staff_audit_logs`.
* **Security Requirements:** Never return plaintext provider secrets (`config_json` encrypted via `ENCRYPTION_MASTER_KEY`, masked on read); require 2FA/TOTP + re-authentication for Emergency Controls and Wallet Adjustments; block `seed.py` super-admin creation in production.
* **Testing Requirements:** Pytest suite verifying non-super-admin/non-staff `403`, dual-control adjustment limits, provider failover routing, and emergency kill switch propagation to workers.

