# Sarvam AI End-to-End Verification Report

**Date:** 2026-11-12  
**SDK:** `sarvamai` `0.1.45`  
**Environment:** FastAPI (`127.0.0.1:8001`, SQLite local DB) + React/Vite (`127.0.0.1:5173`)

---

## 1. Automated Test & Build Suites
- **Backend (`pytest -q tests --tb=short`):** `115 passed, 1 warning in 36.30s` (0 failures, 0 skipped).
- **Frontend (`npx vitest run`):** `5 passed (5)` test files, `36 passed (36)` tests in `5.12s`.
- **Lint (`npm run lint` / `oxlint`):** `0 errors` (3 pre-existing warnings).
- **Typecheck & Production Build (`tsc -b && vite build`):** Passed cleanly (`built in 863ms`).

---

## 2. Live API Verification (`http://127.0.0.1:8001/api`)
- `GET /api/voices/verify` -> `200 OK`:
  - `sarvam`: `connected: true`, `tts_models_count: 2`, `speakers_count: 52`, `stt_models: ['saaras:v4', 'saaras:v3']`, `default_model: 'bulbul:v3'`
  - `elevenlabs`: `connected: true`, `tts_models_count: 9`
- `GET /api/voices/models?provider=sarvam` -> `['bulbul:v3', 'bulbul:v4-flash']` (`bulbul:v2` excluded).
- `GET /api/voices?provider=sarvam` -> `60` Sarvam voices (`52` synced + `8` seeded).
- `POST /api/voices/preview` live synthesis checks:
  - `Sarvam v3 Male te-IN` (`shubh`, `bulbul:v3`): `200`, `cache_hit=False`, `b64_len=76904`, `latency_ms=991`
  - `Sarvam v3 Female hi-IN` (`priya`, `bulbul:v3`): `200`, `cache_hit=False`, `b64_len=86380`, `latency_ms=1104`
  - `Sarvam v4-flash en-IN` (`ishita_en_customer`, `bulbul:v4-flash`): `200`, `cache_hit=False`, `b64_len=88052`, `latency_ms=1135`
  - `Sarvam v3 Male te-IN (cache hit)`: `200`, `cache_hit=True`, `b64_len=76904`, `latency_ms=16`
  - `ElevenLabs regression hi-IN` (`EXAVITQu4vr4xnSDxMaL`, `eleven_v4_turbo`): `200`, `cache_hit=False`, `b64_len=86992`, `latency_ms=1162`
- Negative validation checks:
  - `bulbul:v2` -> `400` (`"Sarvam 'bulbul:v2' is deprecated. Use 'bulbul:v3' or 'bulbul:v4-flash'."`)
  - Speaker/model mismatch (`shubh` + `bulbul:v4-flash`) -> `400` (`"Speaker 'shubh' requires 'bulbul:v3' and is incompatible with 'bulbul:v4-flash'."`)
- `POST /api/integrations/sarvam/test` -> `200` (`configured: true`, `sarvam live API verified (2 TTS models)`).

---

## 3. Landing Page Static Sarvam Audio Assets
- `frontend/public/audio/sarvam-priya.mp3`: `122,462` bytes (`priya`, `hi-IN`, `bulbul:v3`, `22050` Hz MP3)
- `frontend/public/audio/sarvam-shubh.mp3`: `115,774` bytes (`shubh`, `te-IN`, `bulbul:v3`, `22050` Hz MP3)

---

## 4. Live Browser UI Verification (`http://127.0.0.1:5173`)
- **Landing Page (`VoiceShowcaseSection`):** All 6 showcase cards rendered (4 ElevenLabs + `Priya · Sarvam AI` + `Shubh · Sarvam AI` with `Sarvam AI · bulbul:v3` badges); clicking `"Hear voice sample"` transitioned both Sarvam cards to `"Pause audio"` with zero error banners.
- **Voice Studio (`/#/voices`):**
  - Header pills displayed `ElevenLabs (9 models)` and `Sarvam AI (2 models)` connected.
  - Selecting `Sarvam AI (Bulbul v3 / v4-flash)` in `#vs-provider` filtered voices to Sarvam speakers and scoped `#vs-model` strictly to `Auto (By Quality Profile)`, `bulbul:v3`, and `bulbul:v4-flash`.
  - Previewing `Shubh (Default)` (`shubh`) transitioned `Play` -> `Stop` and recorded `Last Synthesis Telemetry` (`Model: bulbul:v3`).

