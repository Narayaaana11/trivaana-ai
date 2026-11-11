# Real AI Voice & Telephony Test Report — Trivaana AI

**Test Date:** 2026-11-10  
**Compliance Standard:** Truthful external-credential status; **zero fabricated live PSTN calls or synthesis checks**.

---

## Verification Matrix

| Subsystem | Verification Mode | Result | Evidence / Notes |
|---|---|---|---|
| **LiveKit Worker Registration & Capabilities** | Unit Test (`test_livekit_worker_capabilities`) | **Passed (Capability Check)** / **External credentials required (Live Room)** | Verified `livekit_agent_worker.py` dynamically selects `livekit-plugins-sarvam` (`saarika` STT + `bulbul` TTS) or OpenAI fallback when configured. Live WebRTC audio roundtrip **Not tested** (`LIVEKIT_URL`/`LIVEKIT_API_KEY` absent). |
| **Voice Engine Pipeline (`pipeline.py`)** | Automated API (`test_voice_library_and_voice_engine_pipeline`) | **Passed (Pipeline & Barge-In)** | Tested multi-turn conversation pipeline, Knowledge Base RAG grounding, barge-in handling, and latency measurement in deterministic sandbox mode. |
| **Exotel Outbound & Subdomain SSRF** | Unit Test (`test_exotel_ssrf_allowlist_caller_id_and_hmac_tokens`) | **Passed** | Verified `api.exotel.com` & `api.in.exotel.com` allowlist, rejection of untrusted host `169.254.169.254`, and `0`-prefixed Indian `CallerId` formatting (`+918047361234` -> `08047361234`). |
| **Exotel Status Callbacks & Passthru** | Automated HTTP (`test_exotel_callback_authentication`, `test_exotel_passthru_endpoint`) | **Passed (Simulated Carrier)** | Verified HTTP `401` rejection on forged callback, Basic Auth & HMAC `?exotel_auth=` acceptance, and `CallSid` mismatch `400`. Real Exotel PSTN leg **External credentials required**. |
| **Exotel Media Stream WebSocket Auth** | Automated WS (`test_phase6_and_phase9_exotel_ws_worker_and_readiness`) | **Passed** | Confirmed `/api/calls/stream/{call_id}` closes with WebSocket code `1008` on invalid `token` and accepts valid `mint_stream_token` connections. |
| **Twilio TwiML & Speech Gather** | Automated HTTP (`test_twilio_callback_signature_verification`, `test_twiml_*`) | **Passed (Simulated Carrier)** | Verified HMAC-SHA1 `X-Twilio-Signature` validation, forged signature rejection (`401`), TwiML rendering, and Gather orchestration. Live Twilio trunk **External credentials required**. |
| **Sarvam / ElevenLabs / OpenAI / IndicF5** | Adapter & Language Test (`test_voice_adapters_multilingual_handling`) | **Passed (Truthful Fallback)** / **External credentials required** | Verified unconfigured providers return explicit `not_configured` / `sandbox_only` states without fabricating audio output. `IndicF5` intentionally kept opt-in external only. |

