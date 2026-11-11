# Third-Party Notices & Open-Source Attributions

Trivaana AI retains an independent codebase and original branding (`Trivaana AI`). No upstream repositories, proprietary UIs, or model weights with unclear/non-commercial licenses are vendored or redistributed inside this application. Where specific architectural patterns or optional SDK adapters are adopted under compatible open-source licenses, the corresponding notices are preserved below.

---

## 1. Dograh AI (BSD 2-Clause License — Architectural Patterns & Exotel/Circuit-Breaker Hardening)
- **Upstream Repository**: https://github.com/dograh-hq/dograh
- **License**: BSD 2-Clause License
- **Copyright Notice**:
  ```
  BSD 2-Clause License

  Copyright (c) 2025, Zansat Technologies Private Limited

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

  1. Redistributions of source code must retain the above copyright notice, this
     list of conditions and the following disclaimer.

  2. Redistributions in binary form must reproduce the above copyright notice,
     this list of conditions and the following disclaimer in the documentation
     and/or other materials provided with the distribution.
  ```
- **Usage in Trivaana AI**: Informed Exotel Connect Voice AI hardening (`api.in.exotel.com` / `api.exotel.com` allowlist, `0`-prefixed national `CallerId` formatting, HMAC-SHA256 `?exotel_auth=` status callback & media WebSocket token patterns in `backend/providers/exotel_adapter.py` and `backend/routers/calls.py`) and provider `401/402/403` + failure-rate campaign circuit breaking (`backend/services/campaign_service.py`). No Dograh Next.js UI, Stack Auth, or Pipecat submodule source is vendored.

---

## 2. LiveKit Agents & Sarvam Plugin (Apache License 2.0 + Proprietary Model Notice)
- **Upstream Repository**: https://github.com/livekit/agents
- **License**: Apache License 2.0 (`NOTICE` preserved: `Copyright 2023 LiveKit, Inc.` / `Copyright 2025 LiveKit, Inc.`)
- **Usage in Trivaana AI**: Optional runtime worker dependency (`backend/voice_engine/livekit_agent_worker.py`) supporting `livekit-agents` and `livekit-plugins-sarvam` (Apache 2.0).
- **Important Restriction (`MODEL_LICENSE`)**: LiveKit proprietary model weights (e.g., `livekit-plugins-turn-detector`) are licensed ONLY for use with the LiveKit Agents framework and must NOT be extracted standalone.

---

## 3. OpenDialer (MIT License — Calling Hours & Daily Cap Safeguards)
- **Upstream Repository**: https://github.com/cyberkyd01/OpenDialer
- **License**: MIT License (`Copyright (c) 2026 OpenDialer contributors`)
- **Usage in Trivaana AI**: Informed weekday-aware calling-window checks and 24-hour per-phone dial caps (`backend/services/compliance_service.py`).

---

## 4. Bolna & Pipecat Reference Adapters (MIT / BSD 2-Clause)
- **Bolna** (`https://github.com/bolna-ai/bolna`, MIT License, `Copyright (c) 2023 Bolna`): Referenced for Sarvam AI (`bulbul`/`saarika`) streaming integration patterns.
- **Pipecat** (`https://github.com/pipecat-ai/pipecat`, BSD 2-Clause, `Copyright (c) 2024, Daily`): Referenced for Exotel bidirectional WebSocket media framing concepts.

---

## 5. Speech Models Status (Self-Hosted Optional Adapters Only)
- **Faster Whisper** (`https://github.com/SYSTRAN/faster-whisper`, MIT License): Supported as an optional external/self-hosted adapter when configured.
- **AI4Bharat IndicConformerASR** (`https://github.com/AI4Bharat/IndicConformerASR`, MIT License): Optional external adapter; verify individual checkpoint/model cards on Hugging Face prior to commercial weight hosting.
- **AI4Bharat IndicF5** (`https://github.com/AI4Bharat/IndicF5`, **NO repository LICENSE file**): Treated strictly as an **opt-in external inference endpoint (`INDICF5_BASE_URL`)**; weights and code are **NOT bundled** in Trivaana AI due to unverified commercial weight licensing.

---

## 6. Frontend Open-Source Packages
- **React (`19.x`)**, **React Flow (`@xyflow/react` `12.x`)**, **Tailwind CSS (`v4`)**, **Recharts**, **Framer Motion**, **Radix UI / shadcn patterns**, **Canvas Confetti** (`MIT` License)
- **Lucide React** (`ISC` License)
