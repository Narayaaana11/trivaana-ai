# Voice Quality & Latency Benchmark Report (13 Indian Languages)

Executed live against `POST https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL` (Sarah, `category: premade`) using `VoiceSelectionService` (`quality_profile="balanced"`, `personality="professional"`) on `2026-11-12`.

## 1. Measured Synthesis Results (Full Non-Streaming Audio)
| Locale | Language | Selected Model | Input Chars | Output Bytes (MP3) | Measured Latency | Native-Speaker Quality Validation |
|---|---|---|---|---|---|---|
| `en-IN` | English (India) | `eleven_v4_turbo` | 112 | 231,592 | 2,634 ms | Not independently validated by native speaker |
| `hi-IN` | Hindi | `eleven_v4_turbo` | 70 | 137,969 | 1,527 ms | Not independently validated by native speaker |
| `te-IN` | Telugu | `eleven_v4_turbo` | 77 | 135,461 | 1,949 ms | Not independently validated by native speaker |
| `ta-IN` | Tamil | `eleven_v4_turbo` | 87 | 118,743 | 1,493 ms | Not independently validated by native speaker |
| `kn-IN` | Kannada | `eleven_v4_turbo` | 60 | 72,767 | 1,060 ms | Not independently validated by native speaker |
| `ml-IN` | Malayalam | `eleven_v4_turbo` | 81 | 86,978 | 1,218 ms | Not independently validated by native speaker |
| `mr-IN` | Marathi | `eleven_v4_turbo` | 66 | 81,545 | 1,033 ms | Not independently validated by native speaker |
| `bn-IN` | Bengali | `eleven_v4_turbo` | 76 | 93,247 | 1,309 ms | Not independently validated by native speaker |
| `gu-IN` | Gujarati | `eleven_v4_turbo` | 72 | 100,771 | 1,462 ms | Not independently validated by native speaker |
| `pa-IN` | Punjabi | `eleven_v4_turbo` | 65 | 90,740 | 1,330 ms | Not independently validated by native speaker |
| `or-IN` | Odia | `eleven_v4_turbo` | 67 | 98,263 | 1,472 ms | Not independently validated by native speaker |
| `as-IN` | Assamese | `eleven_v4_turbo` | 66 | 90,740 | 1,176 ms | Not independently validated by native speaker |
| `ur-IN` | Urdu | `eleven_v4_turbo` | 58 | 80,291 | 1,038 ms | Not independently validated by native speaker |

## 2. Landing Page Static Assets Generated (`frontend/public/audio/`)
| File | Voice ID | Locale | Model Used | Output Bytes |
|---|---|---|---|---|
| `aravind.mp3` | `pNInz6obpgDQGcFmaJgB` | `te-IN` | `eleven_v4_turbo` | 104,950 |
| `priya.mp3` | `EXAVITQu4vr4xnSDxMaL` | `hi-IN` | `eleven_v4_turbo` | 121,251 |
| `rohan.mp3` | `CwhRBWXzGAHq8TQ4Fs17` | `en-IN` | `eleven_v4_turbo` | 113,727 |
| `kavya.mp3` | `FGY2WhTYpPnrIDTdsKH5` | `ta-IN` | `eleven_v4_turbo` | 79,037 |

## 3. Limitations & Honesty Disclosure
- HTTP 200 synthesis confirms valid audio generation and script acceptance across all 13 locales, **not** human perceptual perfection. Native-speaker listening evaluation for regional prosody, code-switching, and Indian proper nouns is marked `Not independently validated by native speaker` until reviewed by native speakers for each language.
- Full-file non-streaming latencies above reflect complete MP3 download; live telephony/LiveKit streaming uses `/stream` chunking for lower time-to-first-byte.

