# Sarvam AI Model Catalog in Trivaana AI

**Verified SDK:** `sarvamai` `0.1.45`  
**Verification Method:** Live API calls + SDK parameter inspection against `SARVAM_API_KEY`

---

## 1. Text-to-Speech (TTS) Models

| Model ID | Status | Supported Languages | Speakers | Latency (Observed) | Best For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `bulbul:v3` | **Active (Flagship)** | 11 (`en-IN`, `hi-IN`, `te-IN`, `ta-IN`, `kn-IN`, `ml-IN`, `mr-IN`, `bn-IN`, `gu-IN`, `pa-IN`, `od-IN` / Trivaana `or-IN`) | 37 named speakers (23 male, 14 female) | `598–1257 ms` REST MP3; `794 ms` WebSocket streaming | Best overall voice quality & Indian multilingual conversations |
| `bulbul:v4-flash` | **Active (Low-Latency)** | Regional/role-tuned subset (`hi-IN`, `te-IN`, `en-IN`, etc.) | 15 role-specific regional speakers (e.g., `shubh_hi_customer`, `kavitha_te_conversation`, `ishita_en_customer`) | `782–867 ms` REST MP3 | Low-latency economy/live customer calls with role-tuned voices |
| `bulbul:v2` | **Deprecated (Excluded)** | N/A | N/A | N/A | Rejected with `VoiceProviderValidationError` (`"Model 'bulbul:v2' has been deprecated. Please use 'bulbul:v3' instead."`) |

### Unsupported / Restricted Languages on Current Account
- `as-IN` (Assamese): API returns `"Please request beta access to as-IN by contacting our support team."` — rejected cleanly by `SarvamVoiceProvider.map_language_code`.
- `ur-IN` (Urdu): Not supported by Sarvam TTS — rejected cleanly by `SarvamVoiceProvider.map_language_code`.
- `or-IN` (Odia): Mapped automatically to Sarvam's API code `od-IN`.

---

## 2. Speech-to-Text (STT) Models

| Model ID | Status | Supported Languages | Modes | Latency (Observed) | Best For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `saaras:v4` | **Active (Production Default)** | 22 Indian languages + `en-IN` | `transcribe`, `translate`, `verbatim`, `translit`, `codemix` | `193 ms` | Primary real-time STT for Trivaana AI phone calls & LiveKit worker |
| `saaras:v3` | **Active** | 22 Indian languages + `en-IN` | `transcribe`, `translate`, `verbatim`, `translit`, `codemix` | `348 ms` | Fallback / comparison STT |

---

## 3. Recommended Production Defaults

- **Best Overall Quality:** `bulbul:v3` (`output_audio_codec="mp3"`, `speech_sample_rate=22050` for browser previews; `linear16` at `8000` Hz for PSTN/telephony).
- **Best Low-Latency / Economy:** `bulbul:v4-flash` with role-matched regional speakers, or `bulbul:v3` via WebSocket streaming (`AsyncSarvamAI.text_to_speech_streaming`).
- **Best Multilingual Indian:** `bulbul:v3` (11 Indian languages + code-switching).
- **Best STT:** `saaras:v4` (`mode="transcribe"` or `"codemix"`).

