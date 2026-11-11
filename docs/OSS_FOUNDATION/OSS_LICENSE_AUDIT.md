# Open-Source License & Commercial Compliance Audit

**Target Model:** Commercial Multi-Tenant SaaS (Trivaana AI)  
**Audit Method:** Direct inspection of `LICENSE`, `NOTICE`, `MODEL_LICENSE`, `THIRD_PARTY_LICENSES.md`, `pyproject.toml`, and `package.json` inside `C:\Narayana\Earning\projects\_oss_research\`.

---

## 1. Repository License Inventory

| Project | Root License | Notice / Additional Terms | Model Weight / Transitive Risks | Commercial SaaS Verdict |
|---|---|---|---|---|
| **Dograh AI** (`dograh-hq/dograh`) | **BSD 2-Clause** (`Copyright (c) 2025, Zansat Technologies Private Limited`) | Retain copyright notice & disclaimer in source/docs when reusing code/patterns | Pulls `dograh-hq/pipecat` submodule (BSD 2-Clause) + `langchain` / `langgraph` (MIT) + `minio` (`AGPLv3` if bundling upstream MinIO binary; Dograh maintains custom fork) | **Safe for selective pattern/adapter reuse** with BSD 2-Clause notice in `THIRD_PARTY_NOTICES.md`. Avoid bundling upstream AGPL MinIO. |
| **Bolna** (`bolna-ai/bolna`) | **MIT** (`Copyright (c) 2023 Bolna`) | Retain MIT copyright notice | Transitive Python SDKs (`azure-cognitiveservices-speech` proprietary SDK license if installed, `pydub` MIT, `litellm` MIT/enterprise enterprise features) | **Safe for selective integration/reference** |
| **LiveKit Agents** (`livekit/agents`) | **Apache 2.0** | `NOTICE` file (`Copyright 2023 LiveKit, Inc.`) + patent grant clause | **`MODEL_LICENSE` (Proprietary/Restricted!)**: LiveKit models (e.g., turn-detector) **cannot** be used outside LiveKit Agents framework and carry separate termination clauses | **Framework & `livekit-plugins-sarvam` (Apache 2.0) are safe**; do NOT extract `MODEL_LICENSE` models standalone |
| **Feros** (`ferosai/feros`) | **Apache 2.0** | `THIRD_PARTY_LICENSES.md` present | **`voice-engine/crates/soxr/src/c/` contains `libsoxr` (LGPL v2.1)** — requires dynamic linking or source relinking compliance if redistributing binaries | **Rejected for bundling** (keep architectural notes only) |
| **OpenDialer** (`cyberkyd01/OpenDialer`) | **MIT** (`Copyright (c) 2026 OpenDialer contributors`) | Retain MIT notice if copying code | Uses standard MIT/Apache npm packages (Electron desktop unused) | **Safe** (clean MIT compliance/hours patterns reused) |
| **Faster Whisper** (`SYSTRAN/faster-whisper`) | **MIT** (`Copyright (c) 2023 SYSTRAN`) | MIT | Whisper model weights (OpenAI MIT); `ctranslate2` (MIT) + optional NVIDIA CUDA/cuDNN binary redistribution constraints | **Safe** as optional self-hosted STT service (`FASTER_WHISPER_BASE_URL`) |
| **IndicConformerASR** (`AI4Bharat/IndicConformerASR`) | **MIT** (`Copyright (c) 2024 AI4Bhārat`) | MIT | Requires `AI4Bharat/NeMo` fork (Apache 2.0) + downloadable `.nemo` checkpoints (verify Hugging Face model card license, typically CC-BY-4.0 allowing commercial attribution) | **Safe** via decoupled HTTP inference service with Hugging Face attribution check |
| **IndicF5** (`AI4Bharat/IndicF5`) | **NO `LICENSE` FILE IN REPO** | README cites F5-TTS (MIT) and datasets: Rasa, IndicTTS, LIMMITS, IndicVoices-R | Missing repository license + multi-dataset weights (LIMMITS/IndicTTS dataset licenses vary; some research datasets restrict commercial cloning) | **DO NOT BUNDLE IN COMMERCIAL SAAS.** Only allow operator-configured external `INDICF5_BASE_URL`. |

---

## 2. Verified Third-Party Frontend & Backend Licensing Summary
- **Backend (`backend/requirements.txt`)**: FastAPI (`MIT`), Uvicorn (`BSD-3-Clause`), Pydantic (`MIT`), PyJWT (`MIT`), Requests (`Apache 2.0`), HTTPX (`BSD-3-Clause`), ElevenLabs SDK (`MIT`). **Zero GPL/AGPL dependencies.**
- **Frontend (`frontend/package.json`)**: React (`MIT`), `@xyflow/react` (`MIT`), Tailwind CSS (`MIT`), Recharts (`MIT`), Framer Motion (`MIT`), Lucide React (`ISC`), Canvas Confetti (`ISC`), `@elevenlabs/elevenlabs-js` (`MIT`). **Zero GPL/AGPL packages.**

