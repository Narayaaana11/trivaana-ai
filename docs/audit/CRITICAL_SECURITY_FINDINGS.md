# TRIVAANA AI — Critical Security Findings (`HEAD d1d4319`)

**Audit Date:** 2026-11-11  
**Commit:** `d1d4319b47a9fa3bbcec2ac02b4a7eca63e92fff`  
**Methodology:** Direct source inspection across authentication, authorization, cryptography, SSRF, file uploads, rate limiting, webhooks, WebSockets, and multi-tenant isolation, reconciled against earlier findings `SEC-01` through `SEC-09`.

---

## 1. P0 Findings (Critical Security Blockers)

### SEC-F01 — Unauthenticated WebSocket Stream Token Minting Oracle (`/plivo-xml`, `/vobiz-xml`)
- **Severity:** `P0`
- **Source File & Function:** `backend/routers/calls.py:503-522` (`get_plivo_stream_xml`, `get_vobiz_stream_xml`), `backend/routers/calls.py:586-625` (`websocket_call_stream`), `backend/providers/plivo_adapter.py:35-37, 184-195`, `backend/providers/vobiz_adapter.py:34-36, 154-165`
- **Evidence:** Both XML endpoints accept unauthenticated `GET`/`POST` requests for any `call_id` without checking carrier signatures or verifying that `call["provider"]` matches `plivo`/`vobiz`. Both immediately call `generate_stream_xml()`, which mints a valid HMAC-SHA256 token (`build_stream_token(call_id)`) using `auth_token or settings.JWT_SECRET`. `websocket_call_stream` accepts `provider=plivo` whenever `settings.has_plivo or is_prod`.
- **Reproduction:**
  1. Send anonymous `GET /api/calls/plivo-xml/<target_call_id>`.
  2. Parse `?provider=plivo&token=<minted_token>` from the `<Stream>` XML response.
  3. Open WebSocket `WS /api/calls/stream/<target_call_id>?provider=plivo&token=<minted_token>`.
  4. Send `{"event": "transcript", "text": "What is your pricing?"}` -> executes `RealtimeVoicePipeline.run_turn` against the target tenant's agent, Knowledge Base, and `caller_memories`, returning private KB answers and burning LLM/TTS credits.
- **Expected Behavior:** XML/Passthru endpoints must verify carrier HMAC signatures or per-call capability tokens before emitting stream URLs, and stream tokens must be bound to the call's assigned provider.
- **Actual Behavior:** Anonymous callers can mint valid WebSocket stream tokens for any `call_id`.
- **Recommended Fix:** Require carrier signature or signed capability query token on `/twiml/{call_id}`, `/exotel-passthru/{call_id}`, `/plivo-xml/{call_id}`, and `/vobiz-xml/{call_id}`; bind stream tokens to `(call_id, provider, exp)` and verify `call["provider"]` matches `provider` in `websocket_call_stream`.
- **Regression Test:** `test_stream_xml_endpoints_require_carrier_auth_and_reject_anonymous_token_minting` asserting `401`/`403` on unsigned `GET/POST` to `/plivo-xml/{id}`, `/vobiz-xml/{id}`, `/twiml/{id}`, and `/exotel-passthru/{id}`.
- **Acceptance Criteria:** Zero unauthenticated calls to any carrier XML/Passthru endpoint can obtain a WebSocket stream URL or token.

### SEC-F02 — `require_scope()` Unused Everywhere + Unrevocable Legacy `tenants.api_key_hash`
- **Severity:** `P0`
- **Source File & Function:** `backend/core/dependencies.py:67-110` (`get_current_user`), `162-173` (`require_scope`), `backend/core/permissions.py:55-64` (`api_key_allows_scope`), `backend/routers/auth.py:66-75`, `backend/database/seed.py:84`
- **Evidence:** `require_scope` is defined at `dependencies.py:162` but has **0 usages** in any router. Scoped keys (`api_keys`) get `derived_role = "operator"` (`dependencies.py:82`), granting access to all `get_current_tenant` endpoints. Simultaneously, `tenants.api_key_hash` (`dependencies.py:98-109`, `voice_engine.py:194-197`) grants `"role": "admin"` and `["*"]` and cannot be revoked via `/api/workspaces/api-keys/{id}` (`workspaces.py:292-308`).
- **Reproduction:** Create an API key with `scopes: ["calls:read"]` via `POST /api/workspaces/api-keys`; use `X-API-Key` to call `POST /api/calls/instant` or `DELETE /api/leads/{id}` -> succeeds (`200 OK`). Revoke the `api_keys` row and reuse the legacy `api_key` from `/api/auth/register` -> still authenticates as `"admin"`.
- **Expected Behavior:** Endpoints enforce `require_scope("<resource>:<action>")` for API keys (failing closed on `scopes=[]`), and legacy `tenants.api_key_hash` is migrated/disabled.
- **Actual Behavior:** API key scopes are decorative only; legacy tenant keys cannot be revoked.
- **Recommended Fix:** Apply `require_scope(...)` across all routers (or enforce a route-to-scope dependency map), set `api_key_scopes=[]` fail-closed in `api_key_allows_scope`, and stop issuing/accepting `tenants.api_key_hash` (with key rotation/revocation endpoint if legacy support is temporarily needed).
- **Regression Test:** `test_api_key_scopes_strictly_enforced_and_revoked_legacy_keys_rejected`.
- **Acceptance Criteria:** A `calls:read` key returns `403` on all write/call-initiation endpoints and on unrelated read endpoints (`leads:read`, `billing:read`).

### SEC-F03 — Missing `require_roles` on ~30+ Cost-Incurring & Destructive Tenant Endpoints
- **Severity:** `P0`
- **Source File & Function:** `backend/routers/calls.py:264, 338, 530, 649`, `campaigns.py:167, 190, 280-326`, `broadcasts.py:52, 101, 158, 199, 263`, `agents.py:211, 279, 391, 413, 495, 555, 584`, `leads.py:143, 190, 240, 254, 297, 377, 420, 467`, `phone_numbers.py:229` (`DELETE /channels/{id}`), `compliance.py:131, 187`, `actions.py:77, 108, 149, 164, 212, 247`, `knowledge.py:70-228`, `workflows.py:55-98`, `appointments.py:58, 136`, `integrations.py:187, 366`, `billing.py:194`
- **Evidence:** All listed endpoints depend only on `get_current_tenant` (and optionally `get_current_user`) without `require_roles(...)`. `viewer` is level 1 in `WORKSPACE_ROLE_HIERARCHY` (`permissions.py:9-15`).
- **Reproduction:** Invite a user with `role="viewer"`, accept invite, call `POST /api/calls/instant`, `POST /api/campaigns/kill`, `DELETE /api/channels/{id}`, or `POST /api/agents/{id}/intake-secret/rotate` -> `200 OK`.
- **Expected Behavior:** `viewer` is strictly read-only; operations/mutations require `operator`+, and destructive/billing/config changes require `admin`/`owner`.
- **Actual Behavior:** `viewer` can spend wallet credits, delete channel pools/leads/KB docs, opt leads back in (`POST /api/compliance/consents`), and rotate agent secrets.
- **Recommended Fix:** Add explicit `require_roles(...)` dependencies to every mutating and spend-generating route.
- **Regression Test:** `test_viewer_role_cannot_mutate_or_initiate_calls` iterating mutating routes and asserting `403`.
- **Acceptance Criteria:** Zero mutating or wallet-spending endpoints return `200`/`201` for `viewer`.

### SEC-F04 — Unverified Razorpay Sandbox Bypass in Production (`billing.py`, `razorpay_adapter.py`)
- **Severity:** `P0`
- **Source File & Function:** `backend/providers/razorpay_adapter.py:53-67, 89-93` (`create_order`, `verify_payment_signature`), `backend/routers/billing.py:167-239`
- **Evidence:** `verify_payment_signature` returns `order_id.startswith("order_sandbox_") and payment_id.startswith("pay_sandbox_")` when `not self.is_configured`, without checking `settings.ENVIRONMENT`.
- **Reproduction:** Boot with `ENVIRONMENT=production` and empty `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`. Call `POST /api/billing/razorpay-order` -> returns `order_sandbox_*`. Call `POST /api/billing/razorpay-verification` with `payment_id="pay_sandbox_free"` -> credits wallet up to ₹5,00,000 for free.
- **Expected Behavior:** In production, missing payment gateway keys must fail closed (`503`) on order creation and payment verification.
- **Actual Behavior:** Sandbox orders and signatures are accepted in production when keys are empty.
- **Recommended Fix:** Reject sandbox fallback in `create_order` and `verify_payment_signature` whenever `ENVIRONMENT in ("production", "prod")`.
- **Regression Test:** `test_razorpay_order_and_verification_blocked_in_prod_when_unconfigured`.
- **Acceptance Criteria:** `POST /api/billing/razorpay-order` and `/razorpay-verification` return `503`/`403` in production if Razorpay credentials are unset.

---

## 2. P1 Findings (High Severity)

### SEC-F05 — Cross-Tenant Database Write in `POST /api/inbound/simulate`
- **Severity:** `P1`
- **Source File & Function:** `backend/routers/inbound.py:34-116` (`_process_inbound_routing`), `168-184` (`simulate_inbound_call`)
- **Evidence:** `simulate_inbound_call` calls `_process_inbound_routing` **before** checking `if routing["tenant_id"] != tenant["id"]` (`L182`). `_process_inbound_routing` queries `phone_numbers` globally without `tenant_id` (`L47-50`), reads the foreign tenant's `agents` and `caller_memories`, and `INSERT`s + `commit`s a synthetic call into `calls` and `call_transcripts` under the foreign `tenant_id` before line `183` raises `403`.
- **Reproduction:** Tenant B sends `POST /api/inbound/simulate` with Tenant A's `to_number` -> receives `403`, yet Tenant A's `calls` and `call_transcripts` now have a new injected record.
- **Expected Behavior:** Filter `phone_numbers` by `tenant["id"]` before any reads or inserts.
- **Actual Behavior:** Foreign-tenant DB mutation occurs prior to authorization check; enables number enumeration (`403` vs `404`).
- **Recommended Fix:** Pass `tenant_id=tenant["id"]` into `_process_inbound_routing` when called from `simulate_inbound_call` and return `404` if not owned by caller's tenant.
- **Regression Test:** `test_simulate_inbound_cannot_write_to_foreign_tenant`.
- **Acceptance Criteria:** Foreign-tenant `calls` count remains unchanged and `404` is returned.

### SEC-F06 — Self-Approved Phone Numbers (`POST /api/phone-numbers`)
- **Severity:** `P1`
- **Source File & Function:** `backend/routers/phone_numbers.py:87-157` (`request_or_connect_phone_number`), `backend/routers/inbound.py:47-50`
- **Evidence:** When any carrier env var is set (`provider_ready == True`), `POST /api/phone-numbers` sets `kyc_status = "verified"` and `status = "active"` (`L120-121`) for any arbitrary `req.phone_number`. `phone_numbers.phone_number` has no `UNIQUE` constraint (`schema.py:402-420`), and inbound routing selects `LIMIT 1` (`inbound.py:48`).
- **Reproduction:** Tenant B registers Tenant A's number via `POST /api/phone-numbers` when carrier env is configured -> immediately marked `verified`/`active`.
- **Expected Behavior:** Numbers require carrier inventory verification or staff KYC approval (`/api/staff/kyc-queue/{id}/review`), plus `UNIQUE(phone_number)`.
- **Actual Behavior:** Any admin/owner can self-verify any phone number string.
- **Recommended Fix:** Always create submitted numbers as `pending_kyc` unless confirmed against the live carrier `verify_phone_numbers` inventory; add `UNIQUE` index on `phone_numbers(phone_number)`.
- **Regression Test:** `test_post_phone_number_requires_kyc_or_carrier_ownership`.
- **Acceptance Criteria:** Unowned/unverified numbers cannot become `active` or hijack inbound routing.

### SEC-F07 — WebSocket Auth Skips `token_version`, User Suspension & Tenant Suspension
- **Severity:** `P1`
- **Source File & Function:** `backend/routers/voice_engine.py:169-198` (`_resolve_ws_tenant_id`), `backend/routers/calls.py:614-625`
- **Evidence:** `_resolve_ws_tenant_id` executes `SELECT tenant_id FROM users WHERE id = ?` (`L182`) without checking `users.status`, `token_version`, or `tenants.status`. Same omission on API-key path (`L189-197`) for `tenants.status`.
- **Reproduction:** Suspend a user or reset password (bumping `token_version`); HTTP routes reject old JWT with `401`/`403`, but `WS /api/voice-engine/ws/{agent_id}?token=<old_jwt>` still connects and executes turns.
- **Expected Behavior:** WebSocket auth must apply the identical revocation/suspension checks as `get_current_user` + `get_current_tenant`.
- **Actual Behavior:** Revoked JWTs and suspended users/tenants retain WebSocket access.
- **Recommended Fix:** Extract shared auth/tenant validation helper used by both HTTP dependencies and WebSocket handlers.
- **Regression Test:** `test_ws_rejects_revoked_token_and_suspended_tenant`.
- **Acceptance Criteria:** `WS` closes with `1008` on revoked `token_version` or suspended user/tenant.

### SEC-F08 — `ENVIRONMENT="development"` Default Leaks Reset Tokens & Couples Vault Key to `JWT_SECRET`
- **Severity:** `P1`
- **Source File & Function:** `backend/core/config.py:60, 283-299`, `backend/routers/auth.py:316-317, 360-361`, `backend/core/vault.py:14-18, 31-42`
- **Evidence:**
  1. `ENVIRONMENT` defaults to `"development"`, causing `POST /api/auth/password-reset/request` to return `"dev_reset_token"` in HTTP responses if `ENVIRONMENT` is accidentally omitted in deployment.
  2. `validate_production_security()` (`config.py:283-299`) never checks `ENCRYPTION_MASTER_KEY`. When empty, `vault.py:16` derives the Fernet key from `f"dev-vault:{settings.JWT_SECRET}"`, and `decrypt_secret()` (`L41-42`) catches `InvalidToken` and returns `""` (signing outbound webhooks with an empty HMAC key `""` if `JWT_SECRET` rotates!).
- **Reproduction:** Start backend without `ENCRYPTION_MASTER_KEY`, save a webhook, rotate `JWT_SECRET` -> `decrypt_secret` returns `""` silently.
- **Expected Behavior:** Require explicit `ENCRYPTION_MASTER_KEY` (>=32 chars) in production; fail loudly on decryption errors; require explicit debug opt-in for dev reset tokens.
- **Actual Behavior:** Silent fallback to `JWT_SECRET`-derived encryption and empty-string return on decryption failure.
- **Recommended Fix:** Enforce `ENCRYPTION_MASTER_KEY` in `validate_production_security()`; raise on `InvalidToken` instead of returning `""`; require `ENVIRONMENT in ("development", "test") and DEBUG` (or explicit `ALLOW_DEV_TOKENS`) for `dev_*_token`.
- **Regression Test:** `test_prod_requires_encryption_master_key_and_fails_on_invalid_token`.
- **Acceptance Criteria:** App refuses production startup without `ENCRYPTION_MASTER_KEY` and never signs webhooks with `""`.

### SEC-F09 — Inactive / Fail-Open PostgreSQL RLS Policies
- **Severity:** `P1`
- **Source File & Function:** `backend/database/postgres_pgvector_schema.sql:857-894`, `backend/database/sqlalchemy_engine.py:50-57`, `backend/database/connection.py:148`
- **Evidence:** `set_tenant_rls_context()` (`sqlalchemy_engine.py:50`) is **never called**; all routers use `get_db()` (`connection.py:148`) without setting `app.current_tenant_id`. Every RLS policy starts with `NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL OR ...`, failing completely open when unset, and covers only 9 of ~35 tables.
- **Reproduction:** Query `calls` on PostgreSQL without setting `app.current_tenant_id` -> returns all tenants' rows.
- **Expected Behavior:** Set `SET LOCAL app.current_tenant_id` per tenant-scoped request transaction on PostgreSQL and cover all customer tables.
- **Actual Behavior:** DB-level RLS is dormant and fails open.
- **Recommended Fix:** Issue `SET LOCAL app.current_tenant_id` inside `get_current_tenant` transaction lifecycle on PostgreSQL and remove the `IS NULL OR` bypass for non-admin roles.
- **Regression Test:** Integration test on PostgreSQL verifying cross-tenant `SELECT` yields 0 rows under tenant RLS context.
- **Acceptance Criteria:** PostgreSQL enforces tenant isolation even if an application query omits `WHERE tenant_id = ?`.

### SEC-F10 — TOCTOU DNS Rebinding in SSRF Guard (`webhook_service.py`, `action_service.py`, `knowledge_service.py`)
- **Severity:** `P1`
- **Source File & Function:** `backend/services/webhook_service.py:32-61, 114-130`, `backend/services/action_service.py:186-198`, `backend/services/knowledge_service.py:168-193`
- **Evidence:** `is_safe_public_url` resolves DNS (`socket.getaddrinfo`), then `httpx` performs a second DNS lookup upon connecting. Also, `POST /api/webhooks` (`integrations.py:276-285`) and `POST /api/agents/{id}/actions` (`actions.py:77`) do not call `is_safe_public_url` on creation.
- **Reproduction:** Configure a DNS record returning a public IP on query 1 and `127.0.0.1` / `169.254.169.254` on query 2.
- **Expected Behavior:** Validate URLs at registration time and connect directly to the validated IP (with `Host` header + SNI).
- **Actual Behavior:** Vulnerable to TTL=0 DNS rebinding.
- **Recommended Fix:** Pin resolved global IP in an `httpx` transport/request hook and validate URLs at creation time.
- **Regression Test:** `test_ssrf_blocks_dns_rebinding_and_private_urls_at_creation`.
- **Acceptance Criteria:** Second DNS resolution cannot redirect outbound HTTP requests to private/metadata IPs.

### SEC-F11 — Uncontrolled `bypass_trai` & Automatic `opted_in` Consent on CSV/Bulk Imports
- **Severity:** `P1`
- **Source File & Function:** `backend/services/lead_service.py:96-97`, `backend/routers/leads.py:179, 334, 447`, `backend/routers/campaigns.py:40, 223`, `backend/routers/calls.py:35, 350`, `backend/routers/public_intake.py:53, 57, 182`
- **Evidence:** CSV/bulk-paste/manual lead creation hardcodes `consent_status='opted_in', opt_out=0` with no consent timestamp/source. Any operator/viewer can pass `bypass_trai=True` or `bypass_calling_hours=True`.
- **Reproduction:** Upload any CSV -> all rows become `'opted_in'` with zero `consent_records`.
- **Expected Behavior:** Imported contacts default to `'pending'` unless verifiable consent metadata is supplied; `bypass_trai` restricted to verified transactional/service categories and `admin`+.
- **Actual Behavior:** Unverified lists become immediately callable.
- **Recommended Fix:** Require explicit consent evidence column or mark imported leads `consent_status='pending'` (`schema.py:181` default `'pending'`), and gate `bypass_*` flags on verified transactional policy.
- **Regression Test:** `test_csv_import_requires_consent_evidence_before_campaign_dial`.
- **Acceptance Criteria:** Leads without recorded `consent_records` are excluded from promotional outbound campaigns.

---

## 3. P2 & P3 Findings Summary

| ID | Sev | Location | Issue & Recommended Fix |
|---|---|---|---|
| **SEC-F12** | `P2` | `docker-compose.yml:36-37, 69-70` | Hardcoded compose fallback `JWT_SECRET` (`47` chars) & `ENCRYPTION_MASTER_KEY` are not in `known_dev_secrets` (`config.py:286-293`), bypassing `validate_production_security`. Add them to `known_dev_secrets` / require unset failure in compose prod overrides. |
| **SEC-F13** | `P2` | `actions.py:100,132`, `action_service.py:180` | `agent_actions.config_json` (custom REST API auth headers/keys) stored in plaintext JSON instead of `vault.encrypt_config_json`. |
| **SEC-F14** | `P2` | `integrations.py:187-228` | `test_integration` (`L210`) checks `bool(env or cfg)`, returning `"credentials verified"` for `{enabled: true}`. Perform real provider probes. |
| **SEC-F15** | `P2` | `workspaces.py:176-209` | Suspending a member via `PATCH /members/{id}` updates `workspace_members.status` (unvalidated) without setting `users.status = 'suspended'`, allowing re-login; `admin` can demote/remove another `admin`. |
| **SEC-F16** | `P2` | `dependencies.py:26-116` | `get_current_user` ignores `tenants.status == 'suspended'`, leaving `/api/auth/me`, `/profile`, `/email-verification/request` open to suspended tenants. |
| **SEC-F17** | `P2` | `auth.py:294-339`, `audit_service.py:24` | Password reset does not invalidate prior unused tokens or reject suspended users; login/failed-login/reset/member-role/key-revoke/DNC-remove lack `AuditService.log_event` calls; `ip_address` column never populated. |
| **SEC-F18** | `P2` | `rate_limit.py:46-48, 64, 112-121`, `public_intake.py:25-37` | `X-Real-IP` trusted ahead of `X-Forwarded-For`; only 4 POST prefixes rate-limited (omits `/accept-invite`, `/calls/instant`, `/knowledge/documents/url`, `/plivo-xml`); unbounded in-memory `_buckets`; global per-slug bucket in `public_intake.py` enables tenant DoS. |
| **SEC-F19** | `P2` | `broadcasts.py:158-171`, `knowledge.py:162`, `knowledge_service.py:136-141` | `upload_broadcast_csv` has no extension/size limit; `upload_knowledge_file` reads entire body before size check; `.docx` unzip lacks uncompressed size bound (zip bomb risk). |
| **SEC-F20** | `P2` | `exotel_adapter.py:181`, `plivo_adapter.py:171`, `vobiz_adapter.py:142` | Static capability tokens (`exotel_auth`, `plivo_auth`, `vobiz_auth`) lack timestamp/expiry; `exotel_adapter.py:181` accepts hardcoded `"test_exotel_token_valid"` when unconfigured. |
| **SEC-F21** | `P2` | `webhook_service.py:72-149` | Ignores `hook["include_transcripts"]` and `retry_limit` (`attempt_count` hardcoded to `1`). |
| **SEC-F22** | `P3` | `main.py:109`, `health.py:26`, `calls.py:153`, `campaigns.py:131` | Unauthenticated `/metrics` and `/api/readiness` expose infra/tenant counts; CSV exports lack formula-injection escaping (`=`, `+`, `-`, `@`); raw `str(exc)` returned in HTTP 500s (`billing.py`, `calls.py`, `campaigns.py`, `appointments.py`); `/api/auth/logout` & `jti` revocation absent. |

**SQL Injection & Media Path Traversal Check:** Zero SQL injection vulnerabilities found (all dynamic queries assemble static column clauses with `?` parameter binding). `/api/media/{storage_key:path}` (`workspaces.py:376-378`, `storage_service.py:61-76`) properly rejects `..`, `\`, leading `/`, and enforces `is_relative_to`. Super Admin `/failed-calls` and Staff `/tenants/{id}/summary` omit transcripts/recordings cleanly.

---

## 4. Verification of Earlier `SEC-01` through `SEC-09` Findings on `d1d4319`

| ID | Earlier Finding | Current Status | Observed Code State |
|---|---|---|---|
| **SEC-01** | Unconditional ₹5,000 free registration credit + fake `TAX-2026-001` | **FIXED** (prod) | `ALLOW_WELCOME_CREDIT` defaults `False` in prod (`config.py:73-79`); logged to `promo_credits` with `invoice_id=NULL` (`auth.py:104-112`). |
| **SEC-02** | Razorpay dual idempotency keys & non-atomic commit | **PARTIALLY FIXED** | Unified `razorpay_order_{order_id}` + atomic `status != 'paid'` update + single commit + strict prod webhook secret (`billing.py:243-350`). **OPEN**: Sandbox signature accepted in prod if keys unset (`SEC-F04`), plus `fetch_payment` `NameError` (`BILL-F01`). |
| **SEC-03** | Media endpoint path traversal | **FIXED** | `workspaces.py:376-378` & `storage_service.py:61-76` enforce traversal guards & `is_relative_to`. |
| **SEC-04** | Plaintext DB secrets & fake `/integrations/{p}/test` | **PARTIALLY FIXED** | `integrations.config_json` & `webhooks.signing_secret` encrypted via `vault.py`. **OPEN**: `agent_actions.config_json` plaintext (`SEC-F13`), `/test` fake check (`SEC-F14`), `ENCRYPTION_MASTER_KEY` unvalidated in prod (`SEC-F08`). |
| **SEC-05** | Broken RBAC hierarchy, missing `token_version`, unscoped API keys, KYC self-approve | **PARTIALLY FIXED** | `has_workspace_role` fixed (`permissions.py:34-44`); `token_version` & `users.status` checked on HTTP (`dependencies.py:51-63`); `PUT /phone-numbers/{id}` `kyc_status` gated. **OPEN**: `require_scope` unused (`SEC-F02`), `tenants.api_key_hash` unrevocable (`SEC-F02`), ~30+ routes missing `require_roles` (`SEC-F03`), WS auth skips `token_version` (`SEC-F07`), `POST /phone-numbers` auto-verifies (`SEC-F06`). |
| **SEC-06** | SSRF via DNS names & 3xx redirects | **PARTIALLY FIXED** | `is_safe_public_url` + `follow_redirects=False` added. **OPEN**: TOCTOU DNS rebinding (`SEC-F10`). |
| **SEC-07** | Rate-limit XFF spoofing & missing FastAPI middleware | **MOSTLY FIXED** | `RateLimitMiddleware` mounted (`main.py:60`). **GAPS**: `X-Real-IP` precedence, limited POST prefix list, unbounded in-memory `_buckets` (`SEC-F18`). |
| **SEC-08** | Docker `.env.example` & missing Postgres `UNIQUE` constraints | **PARTIALLY FIXED** | Removed `.env.example` from compose; added several `UNIQUE` constraints. **OPEN**: Compose hardcoded secrets (`SEC-F12`), missing Postgres `UNIQUE`s & dormant RLS (`SEC-F09`). |
| **SEC-09** | Uncontrolled `bypass_trai` & auto `opted_in` CSV consent | **STILL OPEN** | Both issues remain unfixed (`SEC-F11`). |

