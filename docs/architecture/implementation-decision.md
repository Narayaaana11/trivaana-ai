# Architecture Decision Record: Trivaana AI Platform Foundation

## Date
2026-10-23

## Status
**ACCEPTED**

## Context
Trivaana AI is a multilingual, usage-based AI calling SaaS platform designed for Indian and international enterprises, featuring:
- Telugu, Hindi, and English vernacular telecalling.
- Outpero-grade speed-to-lead and batch outbound campaigns.
- Strict multi-tenant isolation, JWT authentication, and role-based access control.
- Zero-float-drift integer paise financial ledger with Razorpay integration.
- Pluggable telephony (Exotel for India, Twilio for global).

We inspected:
1. Current checked-out Trivaana repository (`02-trivaana-ai`): React 19 + TypeScript + Vite + Tailwind CSS frontend; FastAPI + SQLite prototype backend with mock endpoints.
2. Dograh AI (`dograh-hq/dograh`): Next.js 15 frontend, FastAPI backend, PostgreSQL, Redis/ARQ, WebRTC canvas, and node-based workflow builder.
3. Pipecat & Pipecat Examples (`pipecat-ai/pipecat`, `pipecat-ai/pipecat-examples`): Real-time audio pipelines, Exotel chatbot (`exotel-chatbot/outbound`), and telephony callback handling.

## Decision
1. **Frontend**: Retain and harden the existing **React 19 + TypeScript + Vite + Tailwind CSS** application.
   - *Rationale*: Trivaana already possesses a complete visual identity, high-conversion landing page, speed-to-lead mission control, and Indian vertical presets. Migrating to Dograh's Next.js UI would replace Trivaana's targeted telecalling UX with a generic node-graph editor and add unnecessary WebRTC/MinIO dependencies.
   - *Enhancements*: Connect all UI controls to real persistent APIs, eliminate `alert('saved')`, replace client-side mock payment hashes with server-verified Razorpay, add row-level CSV upload validation, and label simulator previews as sandbox.
2. **Backend**: Modularize and elevate the **FastAPI** backend to enterprise grade.
   - *Structure*:
     - `backend/core/`: Configuration, security, JWT authentication, tenant scoping, structured logging.
     - `backend/models/`: Declarative database models with strict Integer Paise columns, foreign keys, and indexes. Compatible with SQLite WAL (dev/test) and PostgreSQL (production).
     - `backend/providers/`: Pluggable adapters for Telephony (`Exotel`, `Twilio`, `Mock`), Speech (`Sarvam AI`, `ElevenLabs`), and Payments (`Razorpay`).
     - `backend/services/`: Concurrency-safe billing ledger, durable campaign worker, lead validator.
     - `backend/routers/`: Clean domain-driven endpoints.
3. **Telephony & Speech**:
   - Port Pipecat's Exotel integration patterns for Indian outbound/inbound PSTN dialing.
   - Provide a deterministic Mock Telephony provider for zero-cost, automated testing.
   - Support server-side ElevenLabs and Sarvam AI voice synthesis.
4. **Billing & Ledger**:
   - Whole integer paise (`INTEGER`) for all wallet balances, call debits, and invoices.
   - Real Razorpay order creation and HMAC-SHA256 signature verification over raw request body, with safe sandbox testing in development.
