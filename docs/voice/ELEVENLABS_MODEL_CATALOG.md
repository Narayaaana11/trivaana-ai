# ElevenLabs Speech Model Catalog (Live Account Discovery)

Discovered live via `GET https://api.elevenlabs.io/v1/models` and persisted in `voice_models` via `VoiceSyncService.sync_elevenlabs_catalog`.

| Model ID | Name | TTS | Streaming | Low Latency | Quality Profile | Supported Target Indian Languages | Max Chars | Status |
|---|---|---|---|---|---|---|---|---|
| `eleven_v4` | Eleven v4 | Yes | Yes | Standard | Premium | `en, hi, te, ta, kn, ml, mr, bn, gu, pa, or, as, ur` (13/13) | 10,000 | Available |
| `eleven_v4_turbo` | Eleven v4 Turbo | Yes | Yes | Low | Balanced (Default) | `en, hi, te, ta, kn, ml, mr, bn, gu, pa, or, as, ur` (13/13) | 10,000 | Available |
| `eleven_v3_conversational` | Eleven v3 Conversational | Yes | Yes | Low | Premium (Experimental) | `en, hi, te, ta, kn, ml, mr, bn, gu, pa, as, ur` (12/13, no `or`) | 5,000 | Experimental |
| `eleven_v3` | Eleven v3 | Yes | Yes | Standard | Premium (Experimental) | `en, hi, te, ta, kn, ml, mr, bn, gu, pa, as, ur` (12/13, no `or`) | 5,000 | Experimental |
| `eleven_flash_v2_5` | Eleven Flash v2.5 | Yes | Yes | Ultra-low | Economy (`en, hi, ta`) | `en, hi, ta` (3/13) | 40,000 | Available |
| `eleven_turbo_v2_5` | Eleven Turbo v2.5 | Yes | Yes | Low | Balanced (`en, hi, ta`) | `en, hi, ta` (3/13) | 40,000 | Available |
| `eleven_multilingual_v2` | Eleven Multilingual v2 | Yes | Yes | Standard | Balanced (`en, hi, ta`) | `en, hi, ta` (3/13) | 10,000 | Available |
| `eleven_turbo_v2` | Eleven Turbo v2 | Yes | Yes | Low | Economy (`en` only) | `en` (1/13) | 40,000 | Available (`en` only) |
| `eleven_flash_v2` | Eleven Flash v2 | Yes | Yes | Ultra-low | Economy (`en` only) | `en` (1/13) | 40,000 | Available (`en` only) |
| `eleven_english_sts_v2` | Eleven English STS v2 | No | — | — | Speech-to-Speech | — | — | Restricted / Non-TTS |
| `eleven_multilingual_sts_v2` | Eleven Multilingual STS v2 | No | — | — | Speech-to-Speech | — | — | Restricted / Non-TTS |

## Strict Selection Policy
- Language compatibility always takes priority over cost optimization.
- When a user selects an explicit `model_id` in Voice Studio (`POST /api/voices/preview`), `VoiceSelectionService.select_model_and_settings` validates TTS capability and language support strictly and returns HTTP `400` if incompatible rather than silently downgrading.

