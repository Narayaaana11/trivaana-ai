# Third-Party Dependencies Inventory — Trivaana AI

Generated strictly from observed manifests (`backend/requirements.txt`, `frontend/package.json`) plus documented optional runtime packages.

## 1. Backend Core Dependencies (`backend/requirements.txt`)
| Package | Constraint | License | Purpose |
|---|---|---|---|
| `fastapi` | `>=0.110.0` | MIT | Async REST & WebSocket API framework |
| `uvicorn` | `>=0.28.0` | BSD-3-Clause | ASGI server |
| `pydantic` | `>=2.6.0` | MIT | Request/response schema validation |
| `python-multipart` | `>=0.0.9` | Apache 2.0 | CSV, KB document, and broadcast audio uploads |
| `requests` | `>=2.31.0` | Apache 2.0 | Outbound carrier/webhook/WhatsApp HTTP client |
| `httpx` | `>=0.27.0` | BSD-3-Clause | Async HTTP + FastAPI TestClient |
| `pyjwt` | `>=2.8.0` | MIT | Auth JWT & LiveKit room access token signing |
| `pytest` | `>=8.0.0` | MIT | Backend unit & integration testing |
| `elevenlabs` | `>=2.0.0` | MIT | Optional ElevenLabs voice synthesis client |

### Optional Production Runtime Extensions (Not Installed in Minimal Dev Env)
| Package / Service | License | Notes |
|---|---|---|
| `livekit-agents` | Apache 2.0 (`NOTICE`) | Real-time WebRTC & SIP agent runtime (do not redistribute proprietary `MODEL_LICENSE` weights standalone) |
| `livekit-plugins-sarvam` | Apache 2.0 | Indian vernacular `saarika` STT + `bulbul` TTS plugin for LiveKit Agents |
| `livekit-plugins-openai` | Apache 2.0 | OpenAI STT/LLM/TTS plugin for LiveKit Agents |
| `faster-whisper` (External Service) | MIT | Optional CTranslate2 STT (`CUDA 12 + cuDNN 9` GPU or CPU `int8`) |
| `IndicConformerASR` (External Service) | MIT + NeMo (Apache 2.0) | Optional 22-language Indian ASR via GPU NeMo worker |

## 2. Frontend Dependencies (`frontend/package.json`)
| Package | Version | License | Purpose |
|---|---|---|---|
| `react` / `react-dom` | `^19.3.1` | MIT | UI runtime |
| `@xyflow/react` | `^12.12.1` | MIT | Visual Call Flow node/edge editor |
| `recharts` | `^3.10.1` | MIT | Analytics & overview call-volume charts |
| `framer-motion` | `^14.6.0` | MIT | Smooth UI transitions |
| `lucide-react` | `^1.61.0` | ISC | Icon library |
| `@elevenlabs/elevenlabs-js` | `^2.74.0` | MIT | Client SDK helper |
| `canvas-confetti` | `^1.9.4` | ISC | Payment sandbox micro-celebration |
| `clsx` / `tailwind-merge` | `^2.1.1` / `^3.7.0` | MIT | Tailwind v4 utility merging |

### Frontend Dev/Test Tooling
- `vite` (`^8.3.4`, MIT), `typescript` (`~6.0.3`, Apache 2.0), `@tailwindcss/vite` (`^4.3.3`, MIT), `oxlint` (`^1.88.0`, MIT), `vitest` (`^5.1.0`, MIT), `@testing-library/react` (`^16.3.3`, MIT), `@testing-library/jest-dom` (`^7.0.1`, MIT), `jsdom` (`^31.0.0`, MIT).

