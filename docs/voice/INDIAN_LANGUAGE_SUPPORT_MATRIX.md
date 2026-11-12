# Indian Language Support Matrix (Verified Against ElevenLabs `/v1/models`)

Verified from live `GET https://api.elevenlabs.io/v1/models` metadata and live TTS synthesis tests on `2026-11-12`.

| Language | Locale | ISO | Script | `eleven_v4` / `eleven_v4_turbo` | `eleven_v3` / `eleven_v3_conversational` | `eleven_flash_v2_5` / `eleven_turbo_v2_5` / `eleven_multilingual_v2` | Economy Default | Balanced Default | Premium Default |
|---|---|---|---|---|---|---|---|---|---|
| English (Indian) | `en-IN` | `en` | Latin | Supported | Supported | Supported | `eleven_flash_v2_5` | `eleven_v4_turbo` | `eleven_v4` |
| Hindi | `hi-IN` | `hi` | Devanagari | Supported | Supported | Supported | `eleven_flash_v2_5` | `eleven_v4_turbo` | `eleven_v4` |
| Telugu | `te-IN` | `te` | Telugu | Supported | Supported | **Not Listed** | `eleven_v4_turbo` | `eleven_v4_turbo` | `eleven_v4` |
| Tamil | `ta-IN` | `ta` | Tamil | Supported | Supported | Supported | `eleven_flash_v2_5` | `eleven_v4_turbo` | `eleven_v4` |
| Kannada | `kn-IN` | `kn` | Kannada | Supported | Supported | **Not Listed** | `eleven_v4_turbo` | `eleven_v4_turbo` | `eleven_v4` |
| Malayalam | `ml-IN` | `ml` | Malayalam | Supported | Supported | **Not Listed** | `eleven_v4_turbo` | `eleven_v4_turbo` | `eleven_v4` |
| Marathi | `mr-IN` | `mr` | Devanagari | Supported | Supported | **Not Listed** | `eleven_v4_turbo` | `eleven_v4_turbo` | `eleven_v4` |
| Bengali | `bn-IN` | `bn` | Bengali | Supported | Supported | **Not Listed** | `eleven_v4_turbo` | `eleven_v4_turbo` | `eleven_v4` |
| Gujarati | `gu-IN` | `gu` | Gujarati | Supported | Supported | **Not Listed** | `eleven_v4_turbo` | `eleven_v4_turbo` | `eleven_v4` |
| Punjabi | `pa-IN` | `pa` | Gurmukhi | Supported | Supported | **Not Listed** | `eleven_v4_turbo` | `eleven_v4_turbo` | `eleven_v4` |
| Odia | `or-IN` | `or` | Odia | Supported | **Not Listed** | **Not Listed** | `eleven_v4_turbo` | `eleven_v4_turbo` | `eleven_v4` |
| Assamese | `as-IN` | `as` | Bengali-Assamese | Supported | Supported | **Not Listed** | `eleven_v4_turbo` | `eleven_v4_turbo` | `eleven_v4` |
| Urdu | `ur-IN` | `ur` | Perso-Arabic | Supported | Supported | **Not Listed** | `eleven_v4_turbo` | `eleven_v4_turbo` | `eleven_v4` |

## Key Engineering Decision
Previously, `ElevenLabsVoiceProvider` hardcoded `eleven_multilingual_v2`, which does **not** officially list Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, Assamese, or Urdu. `VoiceSelectionService` now prevents selecting `eleven_flash_v2_5` / `eleven_multilingual_v2` for unsupported Indian scripts and automatically routes those locales to `eleven_v4_turbo` or `eleven_v4`.

