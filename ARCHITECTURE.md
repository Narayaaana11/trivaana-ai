# TRIVAANA AI — System Architecture

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

