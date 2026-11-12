# ElevenLabs Voice Catalog (Live Account Discovery)

Synced directly from `GET https://api.elevenlabs.io/v1/voices` using the configured `ELEVENLABS_API_KEY` on `2026-11-12`. Zero voice IDs were fabricated.

## 1. Accessible Premade Voices (21 Voices — Verified Synthesizable)
These voices are `category: premade` and synthesize cleanly via the API under the current account tier:

| Voice ID | Name | Gender | Accent | Primary Use Case |
|---|---|---|---|---|
| `CwhRBWXzGAHq8TQ4Fs17` | Roger - Laid-Back, Casual, Resonant | male | american | conversational |
| `EXAVITQu4vr4xnSDxMaL` | Sarah - Mature, Reassuring, Confident | female | american | entertainment_tv / support |
| `FGY2WhTYpPnrIDTdsKH5` | Laura - Enthusiast, Quirky Attitude | female | american | social_media |
| `IKne3meq5aSn9XLyUdCD` | Charlie - Deep, Confident, Energetic | male | australian | conversational |
| `JBFqnCBsd6RMkjVDRZzb` | George - Warm, Captivating Storyteller | male | british | narrative_story |
| `N2lVS1w4EtoT3dr4eOWO` | Callum - Husky Trickster | male | american | characters_animation |
| `SAz9YHcvj6GT2YYXdXww` | River - Relaxed, Neutral, Informative | neutral | american | conversational |
| `SOYHLrjzK2X1ezoPC6cr` | Harry - Fierce Warrior | male | american | characters_animation |
| `TX3LPaxmHKxFdv7VOQHJ` | Liam - Energetic, Social Media Creator | male | american | social_media |
| `Xb7hH8MSUJpSbSDYk0k2` | Alice - Clear, Engaging Educator | female | british | informative_educational |
| `XrExE9yKIg1WjnnlVkGX` | Matilda - Knowledgable, Professional | female | american | informative_educational |
| `bIHbv24MWmeRgasZH58o` | Will - Relaxed Optimist | male | american | conversational |
| `cgSgspJ2msm6clMCkdW9` | Jessica - Playful, Bright, Warm | female | american | conversational |
| `cjVigY5qzO86Huf0OWal` | Eric - Smooth, Trustworthy | male | american | conversational |
| `hpp4J3VqNfWAUOO0d1Us` | Bella - Professional, Bright, Warm | female | american | informative_educational |
| `iP95p4xoKVk53GoZ742B` | Chris - Charming, Down-to-Earth | male | american | conversational |
| `nPczCjzI2devNBz1zQrb` | Brian - Deep, Resonant and Comforting | male | american | social_media |
| `onwK4e9ZLuTAKqWW03F9` | Daniel - Steady Broadcaster | male | british | informative_educational |
| `pFZP5JQG7iQjIQuC4Bku` | Lily - Velvety Actress | female | british | informative_educational |
| `pNInz6obpgDQGcFmaJgB` | Adam - Dominant, Firm | male | american | social_media |
| `pqHfZKP75CvOlQylNhV4` | Bill - Wise, Mature, Balanced | male | american | advertisement |

## 2. Restricted / Paid-Plan Voices (2 Voices — Marked `plan_upgrade_required`)
Discovered via `/v1/voices` with `category: professional`, tested against `/v1/text-to-speech`, and honestly marked `plan_upgrade_required` on the current API tier (HTTP 402):

| Voice ID | Name | Language Label | Gender | Access Status |
|---|---|---|---|---|
| `7qBNUtXRGP0jPi0H4r8k` | Bunty – Friendly & Fun Customer Agent | `hi` | male | `plan_upgrade_required` (HTTP 402 on free tier) |
| `RoLT1qx7XJRXxWSIG5hS` | Bharadwaj - Profound Telugu Mythology | `te` | male | `plan_upgrade_required` (HTTP 402 on free tier) |

## 3. Refreshing the Catalog
Run `POST /api/voices/sync` (or click **Refresh Catalogue** in Voice Studio) whenever the ElevenLabs subscription tier is upgraded or custom cloned voices are added to the account.

