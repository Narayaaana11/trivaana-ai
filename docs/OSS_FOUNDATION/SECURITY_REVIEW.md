# Security Review — Trivaana AI vs. Inspected OSS Candidates

**Review Scope:** Authentication, tenant isolation, telephony webhook security, SSRF, secrets management, file uploads, database safety, and sensitive-data logging.

---

## 1. Existing Trivaana Security Controls (Verified in Source)
- **Authentication & Passwords** (`backend/core/security.py`, `backend/routers/auth.py`): PBKDF2-HMAC-SHA256 (`600,000` iterations), JWT Bearer tokens with production secret validation (`test_production_jwt_secret_validation`), email verification & password reset token hashes stored in `auth_tokens`.
- **Multi-Tenancy & RBAC** (`backend/core/dependencies.py`): Mandatory `tenant_id` scoping on all reads/writes, suspended-workspace guard, 5-tier RBAC (`owner`, `admin`, `manager`, `operator`, `viewer`), hashed `api_keys`, isolated `is_super_admin` gate for `/api/admin/*` (`test_cross_tenant_isolation_reads_and_mutations`).
- **Billing & Payment Integrity** (`backend/services/billing_service.py`, `backend/routers/billing.py`): Zero-float-drift integer paise accounting; server-recorded Razorpay orders verifying amount & HMAC-SHA256 signatures over raw body with idempotency (`test_payment_security.py`).
- **Webhooks & Custom Actions SSRF Guard** (`backend/services/webhook_service.py`, `backend/services/action_service.py`): Outbound webhooks signed with `X-Trivaana-Signature` (HMAC-SHA256); custom REST calls block private/loopback/link-local IP ranges.

---

## 2. Security Vulnerabilities / Gaps Found & Remediated During OSS Comparison
Comparing against Dograh (`api/services/telephony/providers/exotel/provider.py` and `ws_auth.py`) and OpenDialer (`docs/COMPLIANCE.md`) uncovered **four actionable hardening gaps** in Trivaana, which we remediated directly:

1. **Weak Bare-`AccountSid` Exotel Callback Acceptance** (`backend/providers/exotel_adapter.py` line 144 prior):
   - *Finding*: Previously `verify_request` accepted any callback carrying `AccountSid == self.sid` without verifying Basic Auth or HMAC signature — an attacker knowing a tenant's Exotel SID could forge terminal call statuses.
   - *Fix*: Removed bare `AccountSid`-only trust; implemented **Dograh-grade HMAC-SHA256 capability token** (`?exotel_auth=<hmac>` over `exotel-status:{sid}:{call_id}`) using constant-time `hmac.compare_digest` alongside HTTP Basic Auth verification.
2. **Unauthenticated Telephony Media WebSocket** (`backend/routers/calls.py` `/api/calls/stream/{call_id}`):
   - *Finding*: `websocket_call_stream` previously accepted any connection knowing a guessable `call_id`.
   - *Fix*: Added `token` query verification (`ExotelTelephonyProvider.verify_stream_token`) closing unauthorized sockets with WebSocket code `1008` whenever Exotel credentials are configured.
3. **Exotel Domain SSRF Guard** (`backend/providers/exotel_adapter.py`):
   - *Finding*: `subdomain` parameter previously accepted arbitrary host strings without validation.
   - *Fix*: Restricted to explicit `ALLOWED_EXOTEL_SUBDOMAINS = {"api.exotel.com", "api.in.exotel.com"}`.
4. **Missing Provider Circuit Breaker & Repeat-Dial Cap** (`campaign_service.py`, `compliance_service.py`):
   - *Finding*: Invalid carrier/AI credentials (`401/402/403`) or missing 24h dial limits could waste campaign cycles or repeatedly dial contacts across campaigns.
   - *Fix*: Implemented `evaluate_provider_circuit_breaker` + `check_daily_call_cap` (3 attempts/24h default).

---

## 3. Remaining Production Hardening Checklist (Pre-Deployment)
- Enable `REDIS_URL` rate-limiting middleware behind Nginx (`frontend/nginx.conf` already sets proxy headers) for auth endpoints (`/api/auth/login`, `/api/auth/password-reset/request`).
- Ensure `S3_BUCKET` / MinIO private buckets + signed URLs are configured in `.env` so call recordings & broadcast audio are never served from ephemeral container disks.
- Rotate `JWT_SECRET`, `EXOTEL_API_TOKEN`, and webhook signing secrets regularly and ensure structured logging redacts bearer headers and raw `exotel_auth` tokens.

