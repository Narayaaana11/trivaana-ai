# Security Test Report — Trivaana AI

**Audit Date:** 2026-11-10  
**Security Tests Verified:** `test_auth_security.py`, `test_payment_security.py`, `test_carrier_callbacks.py`, `test_campaign_safety.py`, `test_oss_integrations.py`, `test_qa_comprehensive.py`.

---

## Security Control Test Results

| Control Category | Test Evidence | Status |
|---|---|---|
| **Authentication & Production JWT Guard** | Rejects anonymous (`401`) & invalid JWT tokens; enforces strong `JWT_SECRET` in production (`test_auth_security.py`) | **Passed** |
| **Multi-Tenant Data Isolation** | Separate workspaces (`tenant_demo_enterprise` vs second registered tenant) receive `404` on foreign reads/edits/deletes (`test_cross_tenant_isolation_reads_and_mutations`, `test_phase5_crud_persistence_and_tenant_isolation`) | **Passed** |
| **Payment Tamper & Webhook Security** | Server-side Razorpay order records reject amount manipulation; verifies raw body HMAC-SHA256 signature & idempotency; disables `/sandbox-topup` in production (`test_payment_security.py`) | **Passed** |
| **Carrier Signature & WebSocket Capability Auth** | Rejects forged `X-Twilio-Signature` (`401`), unauthenticated Exotel callbacks (`401`), `CallSid` mismatches (`400`), untrusted Exotel subdomains (`ValueError`), and invalid WS stream tokens (`code=1008`) | **Passed** |
| **File Upload Extension & Size Hardening** | Rejects `.exe`, `.sh`, `.html` uploads (`HTTP 400`) across Knowledge Base (`10 MB`), Leads CSV (`10 MB`), and Broadcast Audio (`25 MB`) (`test_phase8_upload_validation_and_index_performance`) | **Passed** |
| **TRAI TCCCPR, DNC & Daily Cap** | Enforces calling hours, weekday filters, DNC suppression, consent revocation, emergency kill switch, `401/402/403` provider circuit breaker, and 24h 3-attempt cap (`test_campaign_safety.py`, `test_oss_integrations.py`) | **Passed** |
| **Audit Logging & Encrypted/Hashed Secrets** | Passwords PBKDF2-HMAC-SHA256 (`600k` iterations); API keys & intake secrets stored hashed (`hash_api_key`); security events persisted in `audit_logs` | **Passed** |
| **Edge Rate Limiting (Redis/Nginx)** | Nginx proxy configured (`nginx.conf`), `REDIS_URL` supported cleanly, **per-IP auth rate-limiting middleware not yet active at FastAPI layer** | **Partially working** (recommended behind Nginx `limit_req` in prod) |

