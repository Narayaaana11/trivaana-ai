# Migration & Integration Risks Register

| Risk | Likelihood | Impact | Mitigation in Place |
|---|---|---|---|
| **SQLite -> PostgreSQL Production Migration Drift** | Medium | High | `backend/database/postgres_pgvector_schema.sql` mirrors all 45 relational tables + `knowledge_chunks_pg`; CI runs full pytest suite cleanly on SQLite WAL while staging tests Postgres DDL parity. |
| **Exotel Mumbai vs Singapore Subdomain Mismatch** | Medium | Medium | `ExotelTelephonyProvider` supports both `api.exotel.com` and `api.in.exotel.com` cleanly via explicit allowlist; untrusted domains raise `ValueError`. |
| **Exotel Status Callback Auth Failure Behind Reverse Proxy** | Low | High | Supports both HTTP Basic Auth AND HMAC `?exotel_auth=` query capability token (`calls.py` merges `request.query_params`). |
| **Indian Language Model Licensing (`IndicF5` Missing LICENSE)** | High if bundled | Critical | `IndicF5` is **never** bundled in `requirements.txt` or Dockerfiles; supported exclusively via opt-in external `INDICF5_BASE_URL`. |
| **LiveKit `MODEL_LICENSE` Scope Violation** | Low | High | Never extract LiveKit proprietary models (e.g., turn-detector weights) outside `livekit-agents`. |
| **Campaign Credit / Key Burn on Provider 401/402/403** | Medium | High | `CampaignService.evaluate_provider_circuit_breaker` auto-pauses running campaigns immediately on HTTP `401/402/403` and logs an audit event. |
| **Repeated Regulatory Dialing Across Overlapping Campaigns** | Medium | High | `ComplianceService.check_daily_call_cap` enforces a 24h cross-campaign dial cap alongside `do_not_call_entries` and `consent_records`. |
| **Browser DevTools MCP Policy Lockout** | Present | Low (CI unaffected) | Automated Vitest + Vite + `pytest` + live proxy tests verify runtime; document exact Antigravity Browser MCP policy steps for interactive visual verification. |

