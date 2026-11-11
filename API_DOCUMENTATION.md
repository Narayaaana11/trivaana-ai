# TRIVAANA AI — API Documentation

Interactive OpenAPI documentation is served automatically at `/docs` and `/openapi.json`.

## Core API Groups
- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/password-reset/request`, `POST /api/auth/email-verification/request`
- **Workspaces & RBAC**: `GET/PUT /api/workspaces/current`, `GET/POST /api/workspaces/members`, `GET/POST/DELETE /api/workspaces/api-keys`, `GET /api/notifications`, `GET /api/audit-logs`
- **AI Employees**: `GET/POST /api/agents`, `GET/PUT /api/agents/{id}`, `POST /api/agents/generate-prompt`, `POST /api/agents/{id}/lifecycle`, `GET /api/agents/{id}/prompt/versions`, `POST /api/agents/{id}/prompt/restore/{ver_id}`, `POST /api/agents/{id}/test-turn`, `POST /api/agents/{id}/intake-secret/rotate`
- **Voice Library & Engine**: `GET /api/voices`, `POST /api/voices/preview`, `POST /api/voices/{id}/test`, `GET /api/voice-engine/status`, `POST /api/voice-engine/livekit-token`, `POST /api/voice-engine/pipeline-turn`, `POST /api/voice-engine/benchmark`, `WS /api/voice-engine/ws/{agent_id}`
- **Calling Modes**:
  - Public Lead Intake: `POST /api/public/lead-intake/{agent_slug}`, `GET /api/public/lead-intake/{agent_slug}/schema`, `GET /api/public/calls/{call_id}/status`
  - Instant & Call History: `POST /api/calls/instant`, `GET /api/calls`, `GET /api/calls/export`, `GET /api/calls/{id}/transcript`, `GET /api/calls/{id}/recording`, `POST /api/calls/{id}/analyze`
  - Bulk Campaigns: `GET/POST /api/campaigns`, `POST /api/campaigns/start`, `POST /api/campaigns/{id}/pause`, `POST /api/campaigns/{id}/resume`, `POST /api/campaigns/kill`, `GET /api/campaigns/{id}/export`
  - Inbound: `POST /api/inbound/twilio`, `GET/POST /api/inbound/exotel`, `POST /api/inbound/simulate`
  - Voice Broadcast: `GET/POST /api/broadcasts`, `POST /api/broadcasts/{id}/start`, `POST /api/broadcasts/{id}/pause`
- **Knowledge Base & Actions**: `GET/POST /api/knowledge/*`, `GET/POST/DELETE /api/agents/{id}/actions`, `POST /api/calls/{id}/actions/execute`, `GET/POST/DELETE /api/caller-memory`
- **Integrations, Numbers & Compliance**: `GET/POST /api/integrations/*`, `GET/POST/DELETE /api/webhooks/*`, `GET/POST/PUT /api/phone-numbers/*`, `GET/PUT /api/compliance/policy`, `GET/POST/DELETE /api/compliance/dnc`
- **Billing & Super Admin**: `GET /api/billing/pricing`, `GET /api/billing/transactions`, `GET /api/billing/invoices`, `POST /api/billing/razorpay-order`, `POST /api/billing/razorpay-verification`, `POST /api/billing/razorpay-webhook`, `GET/POST/PUT /api/admin/*`

