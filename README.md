# 🎙️ Trivaana AI — Autonomous Vernacular Telecalling Platform

> **India's Most Natural-Sounding AI Telecalling Software**  
> Autonomous voice agents that call every lead in under 30 seconds, work through your lists in 7 Indian languages, and log every outcome with zero float drift.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![TRAI Compliant](https://img.shields.io/badge/TRAI-10AM--6PM_Compliant-10B981.svg?style=flat)](https://trai.gov.in)

---

## 🌟 Overview

Trivaana AI is an enterprise-ready telecalling SaaS platform engineered specifically for the Indian market. It provides a sandbox-verified foundation and credential-gated live connectors across 7 Indian dialect targets (`te-IN`, `hi-IN`, `en-IN`, `ta-IN`, `kn-IN`, `ml-IN`, `mr-IN`).

### Key Architectural Pillars

- **⚡ Instant Lead Callback**: Authenticated public lead-intake webhook (`POST /api/public/lead-intake/{agent_slug}`) with consent/DNC checks and durable DB-backed delayed scheduling (`scheduled_calls`).
- **📋 CRM Import & Reusable Contact Lists**: CSV column-mapped imports and bulk paste with opt-in consent tracking (`consent_confirmed`), DNC scrubbing, and suppression lists (`Lead Scout` external discovery is gated until a provider is configured).
- **🛡️ TRAI TCCCPR Compliance**: Configurable calling windows (default `09:00`–`21:00` IST / custom workspace policy), NDNC/DNC scrubbing, consent records, provider circuit breakers, and an emergency platform kill switch.
- **💰 Zero-Float-Drift Integer Paise Accounting**: Append-only integer paise ledger (`1 INR = 100 paise`; Standard Voice ₹6.50/min, Premium Neural ₹8.50/min billed in 30s increments, ₹0 unconnected), Razorpay checkout/HMAC verification, and 18% GST SAC 998313 invoices.
- **💬 Post-Call Actions & Workflows**: Google Calendar OAuth sync, Meta WhatsApp templates, SSRF-hardened custom API webhooks, warm call transfers, and visual React Flow workflows with conditional branching & optional Temporal dispatch.
- **🎯 5 Turnkey Outpero Presets**: Pre-configured prompt directives and objection handling for:
  - Real Estate & Builders (Site visit scheduling)
  - Healthcare & Clinics (OPD reminders & follow-ups)
  - EdTech & Test Prep (Webinar and demo admissions)
  - Automotive Dealerships (Test drive bookings)
  - BFSI & Lending (KYC and soft EMI reminders)

---

## 🏗️ Repository Architecture

```text
trivaana-ai/
├── backend/
│   ├── core/             # Config, JWT/OIDC security, RBAC permissions, Fernet vault
│   ├── database/         # SQLite WAL / PostgreSQL psycopg adapter & pgvector schema
│   ├── providers/        # Exotel, Twilio, Plivo, Vobiz, Gemini, OpenAI, Sarvam, ElevenLabs, Razorpay
│   ├── routers/          # Modular FastAPI routers (auth, agents, calls, campaigns, billing, admin, staff)
│   ├── services/         # Domain logic (billing, compliance, actions, AI prompts, webhooks)
│   ├── voice_engine/     # STT/TTS pipeline, 20ms telephony WebSocket streaming, LiveKit worker
│   └── worker/           # Campaign/retry/scheduled-call worker tick
├── frontend/             # React 19 + TypeScript + Vite SaaS Workspace, Super Admin & Staff Portals
├── workers/              # Temporal workflow engine, webhook & COGS workers
├── voice-engine/         # Evaluation harness & standalone container Dockerfile
└── infrastructure/       # Terraform foundation (ECS, S3, SQS, Secrets Manager)
```

---

## 🚀 Quickstart Guide

### 1. Backend Server Setup

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python database.py  # Initializes SQLite WAL database with enterprise tenant
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```
* Interactive Swagger Docs: `http://127.0.0.1:8001/docs`
* Health Check: `http://127.0.0.1:8001/health`

### 2. Frontend Launchpad Setup

```bash
cd frontend
npm install
npm run dev
```
* Application UI: `http://localhost:5173/`

---

## 🇮🇳 Regional Dialect Support

| Language | Code | Region | Sample Persona |
| :--- | :--- | :--- | :--- |
| **Telugu (తెలుగు)** | `te-IN` | Andhra Pradesh & Telangana | Ananya (అనన్య) |
| **Hindi (हिन्दी)** | `hi-IN` | North & Central India | Priya (प्रिया) |
| **Indian English** | `en-IN` | Pan-India Corporate | Vikram |
| **Tamil (தமிழ்)** | `ta-IN` | Tamil Nadu | Karthik (கார்த்திக்) |
| **Kannada (ಕನ್ನಡ)** | `kn-IN` | Karnataka | Rohan (ರೋಹನ್) |
| **Malayalam (മലയാളം)** | `ml-IN` | Kerala | Sneha (സ്നേഹ) |
| **Marathi (मराठी)** | `mr-IN` | Maharashtra | Pooja (पूजा) |

---

## 📜 License

Proprietary & Confidential. All rights reserved by Trivaana AI.
