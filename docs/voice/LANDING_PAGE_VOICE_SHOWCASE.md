# Landing Page Voice Showcase

`frontend/src/components/landing/VoiceShowcaseSection.tsx` plays pre-generated, cached ElevenLabs `eleven_v4_turbo` MP3 assets stored in `frontend/public/audio/` (no per-visit API calls and no `window.speechSynthesis` fallback):

| File | Showcase Card | Voice ID | Language | Size | Script |
|---|---|---|---|---|---|
| `frontend/public/audio/aravind.mp3` | Aravind · Real Estate | `CwhRBWXzGAHq8TQ4Fs17` (Roger) | `te-IN` | 135,461 B | నమస్కారం! ట్రివానా ఏఐకి స్వాగతం. నేను మీ వర్చువల్ అసిస్టెంట్ని. ఈరోజు మీకు ఎలా సహాయం చేయగలను? |
| `frontend/public/audio/priya.mp3` | Priya · Healthcare Desk | `EXAVITQu4vr4xnSDxMaL` (Sarah) | `hi-IN` | 136,715 B | नमस्ते! ट्रिवाना एआई में आपका स्वागत है। मैं आपकी वर्चुअल असिस्टेंट हूँ। आज मैं आपकी क्या मदद कर सकती हूँ? |
| `frontend/public/audio/rohan.mp3` | Rohan · EdTech Counselor | `TX3LPaxmHKxFdv7VOQHJ` (Liam) | `en-IN` | 91,994 B | Hello! Welcome to Trivaana AI. I'm your virtual assistant. How can I help you today? |
| `frontend/public/audio/kavya.mp3` | Kavya · Financial Advisory | `FGY2WhTYpPnrIDTdsKH5` (Laura) | `ta-IN` | 106,204 B | வணக்கம்! ட்ரிவானா AI-க்கு உங்களை வரவேற்கிறோம். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்? |

Each card displays the mapped ElevenLabs voice ID, `eleven_v4_turbo` model, language badge, and Play/Pause/Resume controls, surfacing a real error banner if an asset fails to load.

