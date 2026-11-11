# OSS Foundation Evaluation — Trivaana AI

**Evaluation Date:** 2026-11-10  
**Target Product:** Trivaana AI (`C:\Narayana\Earning\projects\02-trivaana-ai`)  
**Reference Specification:** Observed Outpero Audit (`docs/outpero-reference-audit/*.md`)  
**Research Workspace:** `C:\Narayana\Earning\projects\_oss_research\`

---

## 1. Executive Summary

We audited Trivaana AI's existing codebase (branch `feature/security-and-real-call-hardening`, 45 database tables, 20+ FastAPI routers, React 19 + Vite SaaS frontend, 40 passing backend tests, 5 passing Vitest component tests) alongside **8 open-source repositories** cloned into `C:\Narayana\Earning\projects\_oss_research\`:

1. **Dograh AI** (`dograh-hq/dograh`, BSD 2-Clause)
2. **Bolna** (`bolna-ai/bolna`, MIT)
3. **LiveKit Agents** (`livekit/agents`, Apache 2.0 + `MODEL_LICENSE`)
4. **Feros Voice Agent OS** (`ferosai/feros`, Apache 2.0 + LGPL v2.1 `libsoxr`)
5. **OpenDialer** (`cyberkyd01/OpenDialer`, MIT)
6. **Faster Whisper** (`SYSTRAN/faster-whisper`, MIT)
7. **IndicConformerASR** (`AI4Bharat/IndicConformerASR`, MIT repo; check NeMo & model weights)
8. **IndicF5** (`AI4Bharat/IndicF5`, **no `LICENSE` file in repository**)

**Decision:** **Option C — Selective Open-Source Components integrated into Trivaana AI**.  
Trivaana AI already covers ~90%+ of the commercial SaaS business layer required by the Outpero reference (React 19 Outpero-parity UX, zero-float-drift integer paise ledger, Razorpay, 18% GST SAC 998313 invoices, 4-view CRM, One-Way Voice Broadcast, Instant Lead webhook intake, Inbound routing, Super Admin, TRAI TCCCPR DNC/consent compliance, and 40+ automated security/workflow tests) — all of which Dograh lacks or ties to proprietary hosted billing/auth stacks.

---

## 2. Candidate-by-Candidate Technical Evaluation

### 2.1 Dograh AI (`_oss_research/dograh`)
- **Stack**: Next.js 15 + `@stackframe/stack` + `@xyflow/react` + Tailwind (`ui/`), FastAPI + SQLAlchemy AsyncPG + Alembic + PostgreSQL (`pgvector`) + Redis + ARQ + MinIO + LangGraph + custom `dograh-hq/pipecat` submodule (`api/`). Python constraint: `>=3.13,<3.14`.
- **Strengths Observed**:
  - Mature Exotel Connect Voice AI integration (`api/services/telephony/providers/exotel/provider.py`) with `api.in.exotel.com` / `api.exotel.com` allowlist, `0`-prefixed national `CallerId` formatting, ExoPhones verification (`/v2_beta/.../IncomingPhoneNumbers`), and HMAC `?exotel_auth=` status callback verification.
  - Telephony WebSocket HMAC capability tokens (`api/services/telephony/ws_auth.py`).
  - Sliding-window Redis campaign circuit breaker (`api/services/campaign/circuit_breaker.py`) pausing campaigns on provider HTTP `401/402/403` or high failure rates.
  - Organization-scoped disposition code mapping (`disposition_mapping.py`) and LangGraph workflow authoring.
- **Weaknesses Relative to Outpero & Trivaana**:
  - Billing (`mps_billing.py`) delegates to Dograh's hosted MPS service key API rather than Indian INR integer-paise wallets, Razorpay checkout, and GST SAC 998313 tax invoices.
  - Authentication relies on Stack Auth (`@stackframe/stack`) in the Next.js UI.
  - Lacks Indian TRAI TCCCPR calling-hour enforcement (`10 AM – 6 PM IST`), DNC/consent compliance ledgers, 4-view CRM lead pipeline, One-Way Voice Broadcasts, and dark hero prompt builder UX.
  - Heavy operational footprint (5 Docker containers: `pgvector`, `redis`, `minio`, `api`, `ui` + `pipecat` git submodule) and incompatible Python 3.14 pin (`>=3.13,<3.14`).

### 2.2 Bolna (`_oss_research/bolna`)
- **Stack**: Python (`>=3.10`), MIT License, Deepgram/OpenAI/Sarvam synthesizers and transcribers (`bolna/synthesizer/sarvam_synthesizer.py`), Exotel/Plivo/Twilio/Vobiz/FreeSWITCH/SIP handlers (`bolna/input_handlers/telephony_providers/`).
- **Assessment**: Strong Python reference for Sarvam WebSocket (`wss://api.sarvam.ai/text-to-speech/ws`) pacing/flushing and Exotel audio streaming, but framework-only (no multi-tenant SaaS UI, auth, billing, CRM, or campaigns).

### 2.3 LiveKit Agents (`_oss_research/livekit-agents`)
- **Stack**: Apache 2.0 Python framework (`livekit-agents` + 70+ `livekit-plugins-*`, notably `livekit-plugins-sarvam` under Apache 2.0 covering `saarika` STT + `bulbul` TTS + `sarvam` LLM/streaming).
- **License Caveat**: LiveKit's `MODEL_LICENSE` restricts proprietary weights (like `turn-detector`) to LiveKit Agents runtime only; framework code itself is Apache 2.0 with `NOTICE`.
- **Assessment**: Best production real-time WebRTC/SIP media agent runtime (`backend/voice_engine/livekit_agent_worker.py` upgraded to support both `Sarvam` and `OpenAI` dynamically).

### 2.4 Feros Voice Agent OS (`_oss_research/feros`)
- **Stack**: Next.js (`studio/web`) + FastAPI (`studio/api`) + Rust (`voice/server`, `voice/engine`) + gRPC inference (`inference/`).
- **Assessment**: Clean Rust media engine architecture, but explicitly incomplete on outbound/compliance features (README Roadmap unchecked: Outbound calls, Dynamic Agent Variables, Granular Usage Billing, Direct PSTN via SIP). `THIRD_PARTY_LICENSES.md` notes LGPL v2.1 `libsoxr` inside `voice-engine/crates/soxr/src/c/`.

### 2.5 OpenDialer (`_oss_research/OpenDialer`)
- **Stack**: MIT TypeScript monorepo (`packages/shared`, `server`, `web`, `desktop`). Not AI-voice native (human WebRTC softphone dialer), **but** `shared/src/hours.ts` and `docs/COMPLIANCE.md` provide clean, concise compliance logic (timezone/weekday windows, max attempts per phone per 24h across campaigns, strict pre-dial DNC gates).

### 2.6 Indian & Local Speech Models
- **Faster Whisper** (`MIT`): Up to 4x faster Whisper inference via CTranslate2 (`~1.5 GB` int8 CPU small / `~3 GB` int8 GPU large-v2); requires CUDA 12 + cuDNN 9 on GPU; good English/multilingual fallback, lower Telugu/Dravidian accuracy than Sarvam or IndicConformer.
- **IndicConformerASR** (`MIT` code; NeMo dependency): Covers 22 Indian languages (`te`, `hi`, `ta`, `kn`, `ml`, `mr`, etc.) using 600M multilingual or large monolingual `.nemo` checkpoints. Requires `AI4Bharat/NeMo` (`nemo-v2`) GPU worker container; best kept behind Trivaana's external microservice adapter (`INDICCONFORMER_BASE_URL`).
- **IndicF5** (**No LICENSE file**): 11 Indian languages TTS with reference voice cloning. Due to missing `LICENSE` file in upstream repo and dataset-derived model weights, **must never be bundled** inside Trivaana commercial distributions; strictly optional via external operator-provisioned HTTP adapter (`INDICF5_BASE_URL`).

