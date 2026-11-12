# TRIVAANA AI — AI Actions, Workflows, RAG, CRM & Appointments Audit (`HEAD d1d4319`)

**Audit Date:** 2026-11-11  
**Commit:** `d1d4319b47a9fa3bbcec2ac02b4a7eca63e92fff`

---

## 1. AI Actions & Tool Execution (`actions.py`, `action_service.py`, `ai_prompt_service.py`)

### ACT-F01 — AI Actions Never Wired Into LLM Function/Tool Calling
- **Severity:** `P0`
- **Source File & Function:** `backend/services/ai_prompt_service.py:210-319` (`simulate_agent_turn`), `backend/providers/llm_adapter.py:125-160` (`LLMAdapter.complete`), `voice-engine/tools/call_tools.py`
- **Evidence:** `simulate_agent_turn` (`L232-236`) fetches enabled `agent_actions` and injects `"Available Tools: [...]"` as plain text into the system prompt (`L270`). `LLMAdapter.complete` accepts no `tools` schema and parses no tool calls. Consequently, `google_calendar`, `whatsapp_template`, `google_sheets`, `custom_api`, and `caller_memory` (write) are **never invoked** during any voice or sandbox conversation turn. `voice-engine/tools/call_tools.py` is unimported dead code.
- **Reproduction:** Configure a `google_calendar` action on an agent and chat `"Book a visit tomorrow at 11 AM"` in `/api/agents/{id}/test-turn` or `/api/calls/stream/{id}` -> LLM replies in text, `call_actions` remains empty.
- **Expected Behavior:** Enabled `agent_actions` are passed as structured tool definitions to Gemini/OpenAI, executed via `ActionService.execute_action()`, and fed back into the conversation turn.
- **Actual Behavior:** Only keyword-matched `call_transfer` (`pipeline.py:140-155`) ever runs during a voice turn.
- **Recommended Fix:** Add tool/function-calling support to `LLMAdapter.complete` and dispatch tool calls through `ActionService.execute_action`.
- **Regression Test:** `test_agent_turn_executes_configured_tool_via_action_service`.
- **Acceptance Criteria:** Tool calls emitted by the LLM execute `ActionService`, persist `call_actions`, and return results into the AI reply.

### ACT-F02 — `call_transfer` Reports `"executed"` Without Calling Carrier Transfer API
- **Severity:** `P0`
- **Source File & Function:** `backend/services/action_service.py:205-218` (`ActionService.execute_action`), `backend/routers/calls.py:530-583` (`transfer_call_to_human`)
- **Evidence:** For live calls (`provider != "mock"` and `not is_sandbox`), `action_service.py:215-217` returns `exec_status = "executed"` and `{"transfer_to": target_number, "status": "transfer_requested"}` with **zero HTTP requests** to Exotel, Twilio, Plivo, or Vobiz. Similarly, `POST /api/calls/{id}/transfer` (`calls.py:530-583`) builds a TwiML `<Dial>` string, marks `calls.outcome = "Transferred"`, and returns `control_xml` in JSON without sending it to Twilio/Exotel/Plivo/Vobiz.
- **Reproduction:** Execute `POST /api/calls/{live_call_id}/actions/execute` with `action_type="call_transfer"` -> returns `status: "executed"` while the carrier call is untouched.
- **Expected Behavior:** Call the active carrier's live transfer/redirect API; return `"failed"`/`"not_configured"` if carrier transfer fails or is unsupported.
- **Actual Behavior:** Reports `"executed"` without contacting the carrier.
- **Recommended Fix:** Implement `transfer_call()` on `BaseTelephonyProvider` and adapters (Twilio `POST /Calls/{sid}.json` with `Twiml`, Plivo `POST /Call/{uuid}/`, etc.) and return `"failed"` if carrier call fails.
- **Regression Test:** `test_call_transfer_invokes_provider_api_or_fails_truthfully`.
- **Acceptance Criteria:** Non-sandbox `call_transfer` returns `"executed"` only after a `2xx` response from the telephony provider.

### ACT-F03 — Google Calendar & Google Sheets Missing OAuth Flow & Production Features
- **Severity:** `P1`
- **Source File & Function:** `backend/services/action_service.py:37-88, 138-173`, `frontend/src/components/dashboard/IntegrationsPanel.tsx:123`
- **Evidence:** Both actions require `cfg["access_token"]` in `integrations.config_json` (`L57, L149`). No Google OAuth authorization/callback or refresh-token exchange endpoint exists anywhere in `backend/routers/`, while `IntegrationsPanel.tsx:123` saves `{enabled: true}`, yielding `not_configured` (`L86, L153`). Calendar lacks availability (`freebusy`) and reschedule/cancel; Sheets only appends dict values in arbitrary order (`L160`).
- **Reproduction:** Connect `google_calendar` in UI, execute non-sandbox `google_calendar` action -> returns `not_configured` (`access_token missing`).
- **Expected Behavior:** OAuth2 consent + token refresh flow storing encrypted `access_token`/`refresh_token`, plus availability checks and cancellation.
- **Actual Behavior:** No OAuth flow exists; live execution fails unless manually seeded with an expiring token.
- **Recommended Fix:** Implement `/api/integrations/google/oauth/start` + `/callback` with token refresh in `ActionService`, plus `freebusy` and event update/delete support.
- **Regression Test:** `test_google_calendar_refreshes_token_and_checks_availability`.
- **Acceptance Criteria:** Live OAuth tokens authorize Calendar/Sheets calls and refresh transparently on `401`.

### ACT-F04 — WhatsApp Template Approval Bypass & Missing Template Parameters
- **Severity:** `P1`
- **Source File & Function:** `backend/services/action_service.py:89-137`, `backend/routers/integrations.py:366-383`
- **Evidence:** `action_service.py:96` checks `if tpl and tpl["approval_status"] != "approved":`. If `template_name` is not registered in `whatsapp_templates` (`tpl is None`), the check is **bypassed**. `create_whatsapp_template` (`integrations.py:370-380`) trusts client-supplied `approval_status` without Meta verification. Payload (`L116-124`) omits `components` parameters (breaking parameterized templates like `site_visit_confirmation`) and ignores per-tenant WhatsApp credentials.
- **Reproduction:** Execute `whatsapp_template` with `template_name="unregistered_promo"` when Meta env vars are set -> sends directly to Graph API.
- **Expected Behavior:** Require `tpl is not None and tpl["approval_status"] == "approved"` (synced from Meta WABA), support `components` parameters, and read per-tenant config first.
- **Actual Behavior:** Unregistered templates bypass approval; parameterized templates fail.
- **Recommended Fix:** Reject unregistered or unapproved templates; accept `body_params` -> `components`; sync template status from Meta Graph API.
- **Regression Test:** `test_whatsapp_blocks_unregistered_and_unapproved_templates`.
- **Acceptance Criteria:** Only Meta-approved templates in `whatsapp_templates` can be dispatched.

### ACT-F05 — Custom REST API Ignores `is_sandbox` & Stores Plaintext Secrets; Caller Memory Phone Unnormalized
- **Severity:** `P1` / `P2`
- **Source File & Function:** `action_service.py:174-204, 219-266`, `actions.py:100, 132`, `pipeline.py:76-82`
- **Evidence:** `custom_api` fires outbound HTTP calls even when `is_sandbox=True`, passes `json=arguments` on `GET` requests, and stores `agent_actions.config_json` (including auth `headers`) unencrypted. `ActionService` (`caller_memory`) and `RealtimeVoicePipeline.run_turn` (`pipeline.py:76-82`) query/insert `caller_memories` without `normalize_phone()`, missing numbers stored as `+91...` via `/api/caller-memory`.
- **Recommended Fix:** Skip external HTTP in `custom_api` when `is_sandbox=True`, encrypt `agent_actions.config_json` via `vault.py`, and call `normalize_phone()` in all `caller_memories` reads/writes.

---

## 2. Visual Workflows & Temporal (`workflows.py`, `temporal_worker.py`, `WorkflowsPanel.tsx`)

### WFL-F01 — Workflow Execution Engine Is a Non-Executing Stub (Local & Temporal)
- **Severity:** `P0`
- **Source File & Function:** `workers/workflows/temporal_worker.py:13-77` (`trigger_workflow_execution`), `backend/routers/workflows.py:98-115`
- **Evidence:**
  - **Local fallback (`mode="local_durable_outbox"`, `L37-47`)**: Iterates `graph["nodes"]` and builds `{"node_id": ..., "status": "completed"}` for every node. Never inspects `edges`, never evaluates branches/conditions, never checks `workflows.is_active`, and executes zero business actions.
  - **Temporal mode (`settings.has_temporal == True`, `L46-69`)**: Inserts a `workflow_executions` row with `status="queued"` and `completed_at=None`. `temporalio` is **not in `backend/requirements.txt`** and never imported; no Temporal client or worker process exists, so queued workflows remain stuck forever.
  - **Event Triggers**: `trigger_workflow_execution` is **only** called by `POST /api/workflows/{id}/execute`. `CallService`, `leads.py`, `public_intake.py`, and `appointments.py` never trigger workflows on `call_completed`, `lead_created`, or `appointment_booked`.
- **Reproduction:** Create a workflow with 5 nodes and 0 edges (or `is_active=False`), call `POST /api/workflows/{id}/execute` -> returns `status: "completed", steps_executed: 5` with zero actions executed. Set `TEMPORAL_ADDRESS` -> returns `status: "queued"` forever.
- **Expected Behavior:** Topological graph traversal respecting `edges`, conditions, delays, retries, and `is_active`, dispatched via a real `temporalio` client/worker (or real local DAG runner) and invoked on domain events.
- **Actual Behavior:** Fake `"completed"` node list locally; permanent `"queued"` limbo with `TEMPORAL_ADDRESS`.
- **Recommended Fix:** Implement a real DAG/condition step executor in Python + `temporalio` workflow/activity worker, and wire domain events (`call_completed`, `lead_created`, `appointment_booked`) to active matching workflows.
- **Regression Test:** `test_workflow_dag_executes_matching_branch_and_respects_is_active`.
- **Acceptance Criteria:** Conditional branches execute only the matching edge path and perform real side effects (actions/webhooks/follow-ups).

---

## 3. Integrations `/test` & Retry Stub (`integrations.py`)

### INT-F01 — `POST /api/integrations/{provider_key}/test` Falsely Verifies Any Non-Empty Config
- **Severity:** `P1`
- **Source File & Function:** `backend/routers/integrations.py:187-255` (`test_integration`, `retry_integration_log`), `frontend/src/components/dashboard/IntegrationsPanel.tsx:123`
- **Evidence:** `test_integration` (`L210`) computes `is_ready = bool(env_map.get(provider_key) or cfg)`. Because `IntegrationsPanel.tsx:123` calls `/connect` with `config: { enabled: true }`, `cfg` is truthy (`{"enabled": True}`), causing `/test` to log and return `"status": "success", "configured": True, "message": "... credentials verified"` with zero outbound authentication checks. `env_map` also omits `google_calendar`/`google_sheets`, `INTEGRATION_CATALOG` omits `gemini`, and `retry_integration_log` (`L253`) only increments `retry_count`.
- **Reproduction:** Click `Connect` -> `Test` on Zoho CRM or Google Calendar in UI -> reports `"credentials verified"` without any API key or token.
- **Expected Behavior:** Execute real provider health/auth probes (or return `not_configured` / `verification_not_implemented`), never treating `{enabled: true}` as valid credentials.
- **Actual Behavior:** Always reports success if any JSON key exists.
- **Recommended Fix:** Require required credential fields per provider and run real provider API auth checks (e.g., `/v1/models`, `/Accounts/{sid}`, `/v2/users`) in `test_integration`.
- **Regression Test:** `test_integration_test_rejects_dummy_enabled_config`.
- **Acceptance Criteria:** `{enabled: true}` returns `not_configured`; invalid API keys return `failed` with HTTP status.

---

## 4. Knowledge Base (RAG & `pgvector`) (`knowledge.py`, `knowledge_service.py`)

### RAG-F01 — `knowledge_chunks_pg` Orphaned Vectors, Lost `storage_key` & Mixed Vector Dimensions
- **Severity:** `P1`
- **Source File & Function:** `backend/routers/knowledge.py:199-257` (`delete_document`, `reindex_document`), `backend/services/knowledge_service.py:114-120, 237-273, 299-397`
- **Evidence:**
  1. `delete_document` (`L212-213`) and `reindex_document` (`L244-245`) delete from `knowledge_chunks` and `knowledge_documents` but **never** from `knowledge_chunks_pg` (which lacks a FK to `knowledge_documents` in `postgres_pgvector_schema.sql:841-852`), leaving orphaned vectors in Postgres.
  2. `reindex_document` (`L245-257`) deletes and recreates the document without preserving `storage_key`.
  3. `_to_pgvector_1536` (`L114-120`) zero-pads 128-d local hash or 768-d Gemini embeddings to 1536-d, silently mixing incompatible vector spaces in `knowledge_chunks_pg`, and empty-token local vectors (`[0.0, ...]`) yield `NaN` in `<=>` cosine distance (`L385`).
  4. Corrupt `.docx` files throw unhandled `BadZipFile` 500 in `extract_text_from_bytes` (`L137`).
- **Recommended Fix:** Add `ON DELETE CASCADE` FK on `knowledge_chunks_pg(document_id)` + explicit delete in `delete_document`/`reindex_document`, preserve `storage_key` on reindex, store embedding model/dimension metadata to avoid cross-model comparison, and catch malformed archive uploads as HTTP `400`.

---

## 5. CRM / Lead Scout & Appointments (`leads.py`, `lead_service.py`, `appointments.py`)

### CRM-F01 — `GET /api/leads/discover` Shadowed (404) & Lead Scout Stubbed
- **Severity:** `P1`
- **Source File & Function:** `backend/routers/leads.py:116, 360-374`, `backend/services/lead_service.py:115-135`
- **Evidence:** `@router.get("/leads/{lead_id}")` (`L116`) precedes `@router.get("/leads/discover")` (`L360`). FastAPI routes `GET /api/leads/discover` to `get_lead_detail("discover")`, returning `404 Lead not found`. `discover_leads_scout()` always returns `"status": "not_configured"`.
- **Recommended Fix:** Move `/leads/discover` above `/leads/{lead_id}`, remove unsubstantiated OSM Lead Scout claims from `README.md`, or integrate a licensed Places/Apollo provider.

### CRM-F02 — CSV Mapper Drops `email`/`call_category` & `leads` Lacks Unique Phone Constraint
- **Severity:** `P2`
- **Source File & Function:** `backend/services/lead_service.py:40-46, 95-98`, `backend/services/call_service.py:19-28`, `backend/database/schema.py:170-192`
- **Evidence:** `validate_and_import_csv` ignores `email` and `call_category` from `column_mapping`; `leads` lacks `UNIQUE(tenant_id, phone)`; `normalize_phone` does not strip leading `0` on `09848012345` vs `+919848012345`; `update_lead` leaving `do_not_call` does not clear `opt_out`.

### APT-F01 — Appointment `UNIQUE` Constraint Causes 500 on Multiple Cancellations & Sandbox-Only Calendar Sync
- **Severity:** `P1`
- **Source File & Function:** `backend/routers/appointments.py:58-169`, `backend/database/schema.py:781`, `postgres_pgvector_schema.sql:751`
- **Evidence:**
  1. `UNIQUE(tenant_id, scheduled_start, status)` triggers unhandled `IntegrityError` (`500`) in `PATCH /api/appointments/{id}` when a second appointment at the same `scheduled_start` is updated to `'cancelled'` or `'completed'`.
  2. `create_appointment` (`L65-73`) only checks exact `scheduled_start` string match (misses overlapping intervals & timezone offsets); `PATCH` rescheduling (`L155-166`) performs zero conflict check.
  3. Google Calendar sync (`L110-126`) runs **only if `req.call_id` is present** (skipping all UI-created appointments), hardcodes `is_sandbox=True`, and never saves `external_calendar_id`.
- **Recommended Fix:** Replace `UNIQUE(tenant_id, scheduled_start, status)` with a partial unique index `WHERE status = 'scheduled'`, check overlapping `[scheduled_start, scheduled_end)` intervals on `POST` & `PATCH`, and wire non-sandbox Google Calendar sync when OAuth is connected.

