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

Trivaana AI is a production-grade, enterprise-ready telecalling SaaS platform engineered specifically for the Indian market. It bridges the gap between ad form submission and customer engagement by initiating outbound phone calls in under 30 seconds in the prospect's native regional dialect (Telugu, Hindi, Indian English, Tamil, Kannada, Malayalam, and Marathi).

### Key Architectural Pillars

- **⚡ Sub-30-Second Speed-to-Lead**: Connects with inbound prospects from Facebook Ads, MagicBricks, or website forms in an average of 11.4 seconds.
- **🗺️ Autonomous OpenStreetMap (OSM) Lead Scout**: Continuously discovers verified local business prospects across Visakhapatnam, Hyderabad, Bengaluru, Mumbai, Pune, and Chennai without manual scraping.
- **🛡️ Mandatory TRAI 10 AM – 6 PM Enforcement**: Enforces Indian telecom calling hour regulations with NDNC registry scrubbing and an emergency single-click concurrency kill switch.
- **💰 Zero-Float-Drift Integer Paise Accounting**: Billing tracked down to whole integer paise (`1 INR = 100 paise`; ₹3.60/min = 6 paise/sec) preventing fractional floating point drift, paired with simulated Razorpay top-ups and 18% GST tax invoices.
- **💬 WhatsApp Calendar Dispatcher**: Automatically sends meeting invites, Google Maps location pins, and follow-up brochures to prospects immediately after a call concludes.
- **🎯 5 Turnkey Outpero Presets**: Pre-configured prompt directives and objection handling for:
  - Real Estate & Builders (Site visit scheduling)
  - Healthcare & Clinics (OPD reminders & follow-ups)
  - EdTech & Test Prep (Webinar and demo admissions)
  - Automotive Dealerships (Test drive bookings)
  - BFSI & Lending (KYC and soft EMI reminders)

---

## 🏗️ Repository Architecture

```
trivaana-ai/
├── backend/
│   ├── database.py       # Thread-safe SQLite WAL engine, integer paise ledger & seed presets
│   ├── main.py           # Production FastAPI REST server (OSM Scout, Speed-to-lead, Razorpay)
│   └── requirements.txt  # FastAPI, uvicorn, pydantic
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── brand/    # Redesigned Trivaana vector acoustic logo
│   │   │   ├── ui/       # Ambient aurora glow orbs & architectural grid pattern
│   │   │   ├── reactbits/# BlurText, ShinyText, Magnet, SpotlightCard, CountUp
│   │   │   ├── landing/  # High-converting marketing site (Hero, Presets, ROI Calc, Pricing)
│   │   │   └── dashboard/# Full Mission Control dashboard & Dialpad sandbox
│   │   ├── lib/          # Brand tokens, API client & Indian language registry
│   │   ├── types/        # TypeScript interfaces
│   │   └── App.tsx       # Landing page & dashboard switcher
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── README.md
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
