# TRIVAANA AI — PostgreSQL & Database Audit (`HEAD d1d4319`)

**Audit Date:** 2026-11-11  
**Commit:** `d1d4319b47a9fa3bbcec2ac02b4a7eca63e92fff`  
**Important Note:** Local SQLite tests (`61/61`) do **not** validate PostgreSQL. `psql` and `docker` are not installed on this host, and CI (`.github/workflows/ci.yml:37-39`) currently executes `pytest` against SQLite.

---

## 1. P0 Findings (Runtime Crashes on PostgreSQL)

### DB-F01 — `CallService.process_call_event` Uses SQLite Two-Argument `MAX(a, b)`
- **Severity:** `P0`
- **Source File & Function:** `backend/services/call_service.py:160-170` (`CallService.process_call_event`)
- **Evidence:**
  ```sql
  duration_seconds = MAX(duration_seconds, ?),
  billable_duration_seconds = MAX(billable_duration_seconds, ?),
  cost_paise = MAX(cost_paise, ?),
  ```
  In PostgreSQL, `MAX()` is a single-argument aggregate function; scalar max across columns/values requires `GREATEST(a, b)`.
- **Reproduction:** Trigger any call completion/carrier callback on PostgreSQL -> `psycopg` raises `function max(integer, integer) does not exist`.
- **Expected Behavior:** Cross-engine compatible SQL (`GREATEST` on Postgres / `MAX` on SQLite, or dialect-aware helper).
- **Actual Behavior:** Every terminal call callback crashes on PostgreSQL.
- **Recommended Fix:** Use dialect-specific helper (`GREATEST` for `postgresql`, `MAX` for `sqlite3`) and execute `pytest` in CI against live PostgreSQL.
- **Regression Test:** Run `test_calls.py` & `test_carrier_callbacks.py` in CI with `DATABASE_URL` pointing to Postgres.
- **Acceptance Criteria:** 100% of pytest suite passes against live PostgreSQL + `pgvector`.

---

## 2. P1 Findings (Schema Drift, Missing Constraints & Dormant RLS)

### DB-F02 — Missing `UNIQUE` Constraints in `postgres_pgvector_schema.sql` Break `INSERT OR IGNORE` Semantics
- **Severity:** `P1`
- **Source File & Function:** `backend/database/postgres_pgvector_schema.sql:58, 83, 353, 575, 661` vs `backend/database/schema.py:68, 95, 374, 601, 689`
- **Evidence:**
  - `auth_tokens.token_hash`: `UNIQUE` in `schema.py:68`, missing `UNIQUE` in `postgres_pgvector_schema.sql:58`.
  - `invoices.invoice_number`: `UNIQUE` in `schema.py:374`, missing `UNIQUE` in `postgres_pgvector_schema.sql:353`. `BillingService._record_invoice` (`billing_service.py:105`) uses `INSERT OR IGNORE` (translated to `ON CONFLICT DO NOTHING`) with a fresh UUID `id`; without `UNIQUE(invoice_number)`, PostgreSQL inserts duplicate invoice rows.
  - `webhook_deliveries.idempotency_key`: `UNIQUE` in `schema.py:601`, missing `UNIQUE` in `postgres_pgvector_schema.sql:575`.
  - `compliance_policies.tenant_id`: `UNIQUE` in `schema.py:689`, missing `UNIQUE` in `postgres_pgvector_schema.sql:661`. `ComplianceService.get_policy` (`compliance_service.py:25`) uses `INSERT OR IGNORE` to ensure 1 policy per tenant; PostgreSQL will insert duplicate policies.
  - `agents.slug`: non-unique in `schema.py:95`, **`UNIQUE`** in `postgres_pgvector_schema.sql:83`.
- **Recommended Fix:** Reconcile `schema.py` and `postgres_pgvector_schema.sql` into a single canonical Alembic/DDL schema and enforce identical `UNIQUE` constraints (`leads(tenant_id, phone)`, `phone_numbers(phone_number)`).

### DB-F03 — PostgreSQL Row-Level Security (RLS) Is Uninvoked & Fails Open
- **Severity:** `P1`
- **Source File & Function:** `backend/database/postgres_pgvector_schema.sql:857-894`, `backend/database/sqlalchemy_engine.py:50-57`, `backend/database/connection.py:148`, `backend/core/dependencies.py:119-145`
- **Evidence:**
  1. `set_tenant_rls_context()` (`sqlalchemy_engine.py:50`) is **never called anywhere**. All routers depend on `get_db()` (`connection.py:148`), which never runs `SET LOCAL app.current_tenant_id`.
  2. All RLS policies begin with `NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL OR ...`, failing completely open when unset, and cover only 9 of ~35 tables (omitting `invoices`, `payment_orders`, `subscriptions`, `promo_credits`, `phone_numbers`, `calling_channels`, `users`, `api_keys`, `webhooks`, `knowledge_documents`).
- **Recommended Fix:** Set `SET LOCAL app.current_tenant_id` in `get_current_tenant` on Postgres transactions, extend RLS to all tenant-owned tables, and remove the `IS NULL OR` bypass for app queries.

### DB-F04 — Appointment `UNIQUE(tenant_id, scheduled_start, status)` Causes 500 on Multiple Cancellations
- **Severity:** `P1`
- **Source File & Function:** `backend/database/schema.py:781`, `backend/database/postgres_pgvector_schema.sql:751`, `backend/routers/appointments.py:166`
- **Evidence:** Full-table `UNIQUE(tenant_id, scheduled_start, status)` fails with `IntegrityError` when a second appointment at the same `scheduled_start` is updated to `'cancelled'` or `'completed'`.
- **Recommended Fix:** Replace with partial unique index `CREATE UNIQUE INDEX ... ON appointments(tenant_id, scheduled_start) WHERE status = 'scheduled'`.

### DB-F05 — `knowledge_chunks_pg` Orphaned Vectors, Vector Padding & Empty `ivfflat`
- **Severity:** `P1`
- **Source File & Function:** `backend/routers/knowledge.py:212-213, 244-245`, `backend/services/knowledge_service.py:114-120, 263-272, 377-397`, `postgres_pgvector_schema.sql:841-855`
- **Evidence:** `delete_document` / `reindex_document` never delete from `knowledge_chunks_pg` (no FK); `_to_pgvector_1536` zero-pads 128-d/768-d vectors into 1536-d space; `ivfflat ... WITH (lists = 100)` is created on an empty table (whereas `HNSW` builds cleanly incrementally).

---

## 3. P2 Findings (Migrations, Pools & Error Handling)

### DB-F06 — Alembic & ORM `models.py` Cover Only 7 of 35+ Tables; DDL Errors Swallowed
- **Severity:** `P2`
- **Source File & Function:** `backend/database/models.py:11-129`, `backend/migrations/versions/0001_initial_pgvector_rls.py:19-37`, `backend/database/schema.py:1138-1147`, `backend/database/connection.py:95-136`
- **Evidence:**
  - `models.py` models only 7 tables (`Tenant`, `User`, `Appointment`, `Workflow`, `WorkflowExecution`, `SupportTicket`, `ProviderUsageCost`), leaving ~28 core tables (`transactions`, `invoices`, `calls`, `campaigns`, `agents`, `leads`, `phone_numbers`, `api_keys`, etc.) unmodeled.
  - `0001_initial_pgvector_rls.py:36-37` has an empty `downgrade()` (`pass`) and splits DDL naively on `";"` (`L25`).
  - `schema.py:1143-1146` catches and suppresses PostgreSQL DDL errors (`except Exception: conn.rollback()`), masking broken migrations/extensions.
  - `connection.py:107-115` and `sqlalchemy_engine.py:33-34` instantiate two separate connection pools (`20` + `30` connections).
  - `connection.py:132-136` silently falls back to SQLite in non-prod if Postgres connection fails.
  - `PostgresCompatConnection` (`connection.py:42-88`) rewrites `?` placeholders and `INSERT OR IGNORE` via regex/string checks—fragile for string literals containing `?` or multi-statement SQL.
- **Recommended Fix:** Consolidate on one connection pool, log/raise DDL failures instead of swallowing, model all tables in Alembic migrations, and migrate away from regex SQL translation.

