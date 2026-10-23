# AGENTS.md — Trivaana AI Project Invariants & Guidelines

## 1. Stack Overview
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4, Lucide React, Recharts.
- **Backend**: Python 3.10+, FastAPI, SQLite WAL mode (dev/test) & PostgreSQL compatibility (prod), Pydantic v2.
- **Telephony**: Exotel (India PSTN), Twilio (International), Mock Telephony (Deterministic testing).
- **Speech & AI**: Sarvam AI (Telugu, Hindi, Indian English), ElevenLabs Multilingual v2.
- **Payments**: Razorpay with HMAC-SHA256 signature verification over raw request body.

## 2. Core Invariants & Rules

### Non-Negotiable "Never Fake Success" Rules
1. **Never fabricate call outcomes, durations, costs, or transcripts.** Live calls require actual provider interaction. If unconfigured, clearly display `Not Configured (Sandbox Only)`.
2. **Never fabricate lead data or phone numbers.** Do not generate random phone numbers or fictitious business names pretending to be real OSM leads.
3. **Never allow client-side wallet crediting.** Wallet balances may only increase via server-verified Razorpay webhooks (or explicit server-controlled sandbox credit in dev mode).
4. **Never store money as floating point (`REAL`).** All monetary values, debits, credits, balances, and tariffs must be stored and computed in integer paise (`INTEGER`).

### Tenant Isolation & Security
1. Every customer entity (`leads`, `calls`, `campaigns`, `agents`, `transactions`) MUST have a `tenant_id` foreign key.
2. Every database query MUST filter by the authenticated `tenant_id`. No endpoint may query global tables without tenant scoping.
3. CORS in production must never combine wildcard origins (`allow_origins=["*"]`) with `allow_credentials=True`.

### Verification Commands
- **Frontend Build**: `npm run build --prefix frontend`
- **Frontend Lint**: `npm run lint --prefix frontend`
- **Backend Tests**: `pytest backend/tests`
- **Start Backend**: `python -m uvicorn main:app --app-dir backend --port 8001 --reload`
- **Start Frontend**: `npm run dev --prefix frontend`
