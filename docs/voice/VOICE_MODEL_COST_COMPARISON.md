# ElevenLabs Model Discovery & Cost Comparison

Model metadata retrieved live from `GET https://api.elevenlabs.io/v1/models` on `2026-11-12`.

## 1. Discovered TTS Models on Account
| Model ID | Name | `token_cost_factor` | Max Chars (Free / Sub) | Supported Indian Languages | Latency Tier | Quality Tier |
|---|---|---|---|---|---|---|
| `eleven_v4` | Eleven v4 | `1.0` | 10,000 / 10,000 | All 13 (`en, hi, te, ta, kn, ml, mr, bn, gu, pa, or, as, ur`) | Standard | Premium |
| `eleven_v4_turbo` | Eleven v4 Turbo | `1.0` | 10,000 / 10,000 | All 13 (`en, hi, te, ta, kn, ml, mr, bn, gu, pa, or, as, ur`) | Low | Balanced |
| `eleven_v3` | Eleven v3 | `1.0` | 5,000 / 5,000 | 12 (all except Odia `or`) | Standard | Premium |
| `eleven_v3_conversational` | Eleven v3 Conversational | `1.0` | 5,000 / 5,000 | 12 (all except Odia `or`) | Low | Premium |
| `eleven_flash_v2_5` | Eleven Flash v2.5 | `1.0` | 40,000 / 40,000 | 3 (`en, hi, ta`) | Ultra Low | Economy |
| `eleven_turbo_v2_5` | Eleven Turbo v2.5 | `1.0` | 40,000 / 40,000 | 3 (`en, hi, ta`) | Low | Balanced |
| `eleven_multilingual_v2` | Eleven Multilingual v2 | `1.0` | 10,000 / 10,000 | 3 (`en, hi, ta`) | Standard | Balanced |
| `eleven_flash_v2` | Eleven Flash v2 | `1.0` | 30,000 / 30,000 | 1 (`en`) | Ultra Low | Economy |
| `eleven_turbo_v2` | Eleven Turbo v2 | `1.0` | 30,000 / 30,000 | 1 (`en`) | Low | Balanced |

*(Note: `eleven_english_sts_v2` and `eleven_multilingual_sts_v2` have `can_do_text_to_speech: false` and are excluded from TTS selection.)*

## 2. Cost Optimization & Cache Controls
- **Content-Addressed Caching (`tts_cache.py`):** Identical `(provider, voice_id, model_id, speed, stability, output_format, language, text)` tuples are served from memory/disk cache at **₹0** marginal character cost.
- **Estimated vs Actual Billing:** Pre-synthesis estimates (`estimated_cost_paise`) are calculated before the request using character count and `token_cost_factor` and are explicitly separated in `voice_usage_logs` from provider-reported character consumption (`provider_characters_reported`).
- **Note on Exact Plan Currency Rate:** `GET /v1/user/subscription` returned `null` tier/limit fields on the current scoped API key, so exact ElevenLabs USD-per-character plan tier billing is not assumed; Trivaana uses a conservative configurable INR reference rate for internal workspace estimation (`DEFAULT_ESTIMATED_PAISE_PER_1K_CHARS = 1800`).

