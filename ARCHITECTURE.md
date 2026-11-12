# TRIVAANA AI — System Architecture & Folder Map

## Folder Structure
- `backend/` — FastAPI backend API & orchestration
  - `core/` — Configuration (`config.py`), JWT/PBKDF2 security (`security.py`), RBAC & tenant guards (`dependencies.py`, `permissions.py`), sliding-window rate limiter (`rate_limit.py`), AES-GCM vault (`vault.py`)
  - `database/` — Thread-safe SQLite WAL / PostgreSQL pool (`connection.py`), schema migrations (`schema.py`, `postgres_pgvector_schema.sql`), opt-in demo seeding (`seed.py`, disabled by default unless `ALLOW_DEMO_SEEDING=true`)
  - `routers/` — Modular REST/WebSocket API endpoints (`auth.py`, `billing.py`, `calls.py`, `campaigns.py`, `compliance.py`, `leads.py`, `phone_numbers.py`, `admin.py`, `public.py`, etc.)
  - `services/` — Domain business logic (billing ledger, DLT/NCPR compliance, campaign dispatcher, RAG, audit)
  - `providers/` — Pluggable telephony, STT, TTS, LLM, email, and payment adapters
  - `voice_engine/` — Real-time streaming voice pipeline & WebSocket handler
  - `tests/` — Pytest unit & integration suite
- `frontend/src/` — React 19 + TypeScript + Vite 8 + Tailwind CSS v4 SPA
  - `apps/` — Route-split portals (`landing/`, `dashboard/`, `admin/`, `staff/`, `public/`)
  - `components/` — Reusable UI, auth, modals, layout, and compliance components
  - `lib/` — API client, React Query config (`queryClient.ts`), formatting & validation helpers
  - `services/` & `stores/` — Domain API wrappers and auth/session state
  - `__tests__/` — Vitest component & portal parity tests
- `voice-engine/`, `workers/`, `infrastructure/`, `tests/load/` — Dedicated voice runtime, Temporal/async workers, Terraform IaC, and k6 10k-user load tests.

## Overview
Trivaana AI is a multi-tenant AI telecalling SaaS platform built with:
- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Recharts, Lucide icons (`frontend/src/`).
- **Backend**: FastAPI modular routers (`backend/routers/`), domain services (`backend/services/`), pluggable provider adapters (`backend/providers/`), real-time voice engine (`backend/voice_engine/`), and background worker (`backend/worker/`).
- **Persistence**: Thread-safe SQLite WAL for zero-dependency local/CI testing and PostgreSQL + `pgvector` schema (`backend/database/postgres_pgvector_schema.sql`) for production deployment.

## Real-Time Voice Pipeline
`Telephony Audio / WebRTC (LiveKit / Exotel / Twilio)` -> `STT (OpenAI Whisper / Faster-Whisper / IndicConformer)` -> `Language Detection` -> `Knowledge Base RAG + Caller Memory` -> `LLM Reasoning (OpenAI)` -> `During-Call Actions` -> `TTS (Sarvam / ElevenLabs / OpenAI / IndicF5)` -> `Audio Output`.

## Multi-Tenancy & Ledger Invariants
- All customer tables include `tenant_id` foreign keys and every query filters by authenticated `tenant_id`.
- Monetary balances, call costs, and invoices use strict integer paise (`1 INR = 100 paise`).
- All external integrations report truthful `not_configured` / `sandbox_only` states when credentials are absent.

