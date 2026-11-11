# TRIVAANA AI — Internal Staff Portal Blueprint

**Purpose:** Enable Trivaana AI's internal operations, support, sales, finance, engineering, and compliance employees to run day-to-day SaaS operations and managed enterprise onboarding **without** giving everyone unrestricted Super Admin access.

---

## 1. Current State & Why This Is Required
* **Current Codebase:** Only a single binary column `users.is_super_admin` exists (`schema.py:37`), tied to a customer `tenant_id` (`seed.py:77`). There is no internal staff table, no granular internal RBAC, no support ticketing, no onboarding task tracker, no refund approval workflow, and no audited "View as Customer" capability.
* **Target Architecture:** Separate `staff_users` identity domain (`@trivaana.ai` / SSO + mandatory TOTP MFA) accessing `/staff/*`, strictly isolated from customer `users` & `tenants`.

---

## 2. Internal Staff Role & Permission Matrix (7 Roles)

| Role | Scope & Authority | Explicitly Prohibited |
|---|---|---|
| **1. Super Admin** | Full platform authority, emergency kill switches, provider secret rotation, staff role assignment, approval overrides. | — |
| **2. Operations Manager** | Monitor live calls/campaigns, pause/halt runaway campaigns, manage carrier queue incidents, assign onboarding tasks, run audited read-only "View as Customer". | Cannot modify provider secrets, issue refunds, or alter tariffs/GST. |
| **3. Finance Manager** | View Razorpay orders, GST invoices, liabilities/revenue/COGS reports; approve refunds/wallet adjustments up to tier limit (e.g. `<= ₹25,000`; `> ₹25,000` requires Super Admin co-sign). | Cannot access customer call transcripts or modify providers/code. |
| **4. Customer Support** | Manage support tickets (Chatwoot/internal inbox), troubleshoot failed calls (`status/error_code` metadata), request audited time-bounded "View as Customer" (read-only), create onboarding notes. | Cannot silently impersonate, export bulk lead lists, or issue unapproved credits. |
| **5. Technical Team (Developer)** | Inspect system errors, webhook delivery failures, voice latency benchmarks, infrastructure queues, and API rate-limit logs. | Cannot read customer audio/PII transcripts without customer-granted support ticket consent. |
| **6. Sales & Growth** | Manage SaaS prospect pipeline, trial extensions, hybrid enterprise onboarding checklists, plan upgrade quotes, and customer ownership assignments. | Cannot access production secrets, raw call recordings, or financial adjustments. |
| **7. Compliance Officer** | Review and approve/reject tenant **KYC / DLT PE ID / 140-160 Header** submissions, manage global DND blocks, review `bypass_trai` requests, process DPDP erasure/export requests. | Cannot alter billing balances or disable DND guards silently. |

---

## 3. Core Staff Portal Modules & Workflows

### 3.1 Audited "View as Customer" (Support Impersonation) — P1
- **Strict Rules:**
  1. Staff user must enter an active **Support Ticket ID** and **Reason** (`min 10 chars`).
  2. Generates a short-lived (`15 min`), **read-only** scoped impersonation JWT (`impersonated_by`, `ticket_id`, `read_only=true`).
  3. All mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) are blocked unless the customer explicitly opted into write-assisted onboarding on the ticket.
  4. Persistent high-visibility banner across UI: *"Viewing Workspace X as Support Agent Y (Read-Only · Audited)"*.
  5. Writes to BOTH `staff_audit_logs` AND the customer's own visible `audit_logs` (`"Trivaana Support viewed workspace under Ticket #123"`).

### 3.2 Support & Ticketing Inbox (Integrated with Chatwoot or Native) — P1
- Unified ticket queue with **SLA Timers** (`First Response < 15m` Enterprise / `< 2h` Growth), Priority (`Urgent/High/Normal`), Customer Ownership tag, Internal Staff-Only Notes, and Escalation routing (`Support -> Ops / Tech / Finance / Compliance`).

### 3.3 Hybrid Onboarding & Task Management — P1
- Because Trivaana targets **Hybrid SaaS** (self-service + managed enterprise setup):
  - **Customer Ownership & Onboarding Checklists:** Track managed setup tasks (*"Collect DLT PE ID"*, *"Build Telugu Real Estate Agent v1"*, *"Upload Brochure PDFs"*, *"Run 10-case Testing Lab eval"*, *"Configure Zoho Webhook"*).
  - **Shift Handover & Announcements:** Shift schedule calendar + pinned internal ops/incident announcements + internal staff runbook Knowledge Base.

### 3.4 Dual-Control Approval Workflows — P1
- Queue for sensitive requests:
  - **Wallet Refunds / Credit Adjustments** (`Support/Sales requests -> Finance/Super Admin approves`).
  - **TRAI Window / Transactional Exemptions (`bypass_trai`)** (`Customer submits DLT proof -> Compliance Officer approves`).
  - **Concurrency / Channel Cap Increases** (`Sales requests -> Ops approves against carrier trunk headroom`).

---

## 4. Technical Implementation Specs

| Dimension | Specification |
|---|---|
| **Current Status** | **Not Implemented** (`0%` — only `users.is_super_admin` boolean exists). |
| **Frontend Changes** | New `/staff` route shell (`StaffPortalApp.tsx`) with modules: `My Queue & Tasks`, `Support Inbox`, `Customer Accounts (Read-Only/Impersonate)`, `KYC & Compliance Queue`, `Approvals`, `Staff Directory & Shifts`, `Internal Runbooks`. |
| **Backend Changes** | New `routers/staff_auth.py`, `routers/staff_tickets.py`, `routers/staff_tasks.py`, `routers/staff_approvals.py`, `services/impersonation_service.py`; middleware rejecting `read_only=true` impersonation tokens on mutations. |
| **Database Changes** | New tables: `staff_users`, `staff_roles`, `staff_sessions`, `support_tickets`, `ticket_messages`, `staff_tasks`, `approval_requests`, `customer_assignments`, `staff_audit_logs`, `staff_shifts`. |
| **Security Requirements** | Separate JWT audience (`aud="trivaana_staff"`), mandatory 2FA/TOTP, IP allowlist option, zero silent impersonation, automatic session expiry. |
| **Testing Requirements** | Pytest RBAC matrix tests verifying all 7 roles against allowed/forbidden endpoints + read-only impersonation mutation blocking (`403`). |
| **Acceptance Criteria** | Support agent can resolve a ticket via audited 15-min read-only View-as-Customer without gaining tariff/secret/refund permissions; Finance can approve a `₹2,000` credit adjustment logged in immutable ledger & audit trail. |

