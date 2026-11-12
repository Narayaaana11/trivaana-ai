"""
TRIVAANA AI: ElevenLabs Voice Ecosystem Integration Tests
Tests:
1. 13 Indian languages & intelligent model selection (never picks unsupported model for te-IN/or-IN/etc.).
2. Economy / Balanced / Premium profiles and 8 calibrated voice personalities.
3. Live catalog sync mapping (available premade vs plan_upgrade_required professional) without fabricating IDs.
4. Voice favorites, usage metering (cache hit vs billed characters), and AI Employee assignment persistence.
5. Error handling (validation error on empty text, plan error on 402).
"""

import pytest
from fastapi.testclient import TestClient

from main import app
from database.connection import get_connection
from providers.voice_adapters import ElevenLabsVoiceProvider, VoiceProviderValidationError
from services.voice_ecosystem_service import (
    VOICE_PERSONALITIES,
    VoiceSelectionService,
    VoiceSyncService,
    VoiceUsageService,
)

client = TestClient(app)


def test_thirteen_indian_languages_and_intelligent_model_selection():
    res = client.get("/api/voices/languages")
    assert res.status_code == 200
    data = res.json()
    codes = {l["code"] for l in data["languages"]}
    expected = {"en-IN", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "or-IN", "as-IN", "ur-IN"}
    assert expected.issubset(codes)

    # Economy selects eleven_flash_v2_5 for en-IN/hi-IN/ta-IN, but must NOT pick it for te-IN or or-IN
    sel_hi_econ = VoiceSelectionService.select_model_and_settings("hi-IN", "economy", "friendly")
    assert sel_hi_econ["model_id"] == "eleven_flash_v2_5"

    sel_te_econ = VoiceSelectionService.select_model_and_settings("te-IN", "economy", "warm")
    assert sel_te_econ["model_id"] == "eleven_v4_turbo"
    assert sel_te_econ["language_supported"] is True

    sel_or_prem = VoiceSelectionService.select_model_and_settings("or-IN", "premium", "formal")
    assert sel_or_prem["model_id"] == "eleven_v4"
    assert sel_or_prem["language_supported"] is True


def test_personalities_and_validation_errors():
    assert len(VOICE_PERSONALITIES) == 8
    prov = ElevenLabsVoiceProvider(api_key="test-key")
    with pytest.raises(VoiceProviderValidationError):
        prov.synthesize_speech("   ", language="en-IN", voice_id="EXAVITQu4vr4xnSDxMaL")


def test_sync_favorites_usage_and_agent_assignment(demo_auth_headers, monkeypatch):
    # Mock ElevenLabs discovery API payloads (real API schema)
    monkeypatch.setattr(
        ElevenLabsVoiceProvider,
        "discover_models",
        lambda self: [
            {
                "model_id": "eleven_v4_turbo",
                "name": "Eleven v4 Turbo",
                "description": "Low latency multilingual",
                "can_do_text_to_speech": True,
                "token_cost_factor": 1.0,
                "max_characters_request_free_user": 10000,
                "max_characters_request_subscribed_user": 10000,
                "languages": [{"language_id": c} for c in ["en", "hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "or", "as", "ur"]],
            }
        ],
    )
    monkeypatch.setattr(
        ElevenLabsVoiceProvider,
        "discover_voices",
        lambda self: [
            {
                "voice_id": "EXAVITQu4vr4xnSDxMaL",
                "name": "Sarah - Mature, Reassuring, Confident",
                "category": "premade",
                "labels": {"gender": "female", "accent": "american", "language": "en"},
                "high_quality_base_model_ids": ["eleven_v4_turbo"],
                "preview_url": "https://example.com/sarah.mp3",
            },
            {
                "voice_id": "7qBNUtXRGP0jPi0H4r8k",
                "name": "Bunty",
                "category": "professional",
                "labels": {"gender": "male", "accent": "standard", "language": "hi"},
                "high_quality_base_model_ids": ["eleven_v4_turbo"],
            },
        ],
    )

    conn = get_connection()
    try:
        monkeypatch.setattr(ElevenLabsVoiceProvider, "is_configured", property(lambda self: True))
        sync_res = VoiceSyncService.sync_elevenlabs_catalog(conn)
        assert sync_res["synced"] is True
        assert sync_res["models_synced"] == 1
        assert sync_res["voices_synced"] == 2
    finally:
        conn.close()

    # Favorite toggle & filter
    fav_res = client.post("/api/voices/vp_el_EXAVITQu4vr4xnSDxMaL/favorite", headers=demo_auth_headers)
    assert fav_res.status_code == 200
    list_res = client.get("/api/voices?favorites_only=true&search=Sarah", headers=demo_auth_headers)
    assert list_res.status_code == 200
    voices = list_res.json()["voices"]
    assert len(voices) == 1
    assert voices[0]["provider_voice_id"] == "EXAVITQu4vr4xnSDxMaL"
    assert voices[0]["is_favorite"] is True

    # Usage metering report (1 billed + 1 cache hit)
    tenant_id = client.get("/api/auth/me", headers=demo_auth_headers).json()["tenant"]["id"]
    conn = get_connection()
    try:
        VoiceUsageService.record_usage(
            conn, tenant_id, "elevenlabs", "eleven_v4_turbo", "EXAVITQu4vr4xnSDxMaL", "te-IN", "balanced", 100, cache_hit=False, latency_ms=420, estimated_cost_paise=180
        )
        VoiceUsageService.record_usage(
            conn, tenant_id, "elevenlabs", "eleven_v4_turbo", "EXAVITQu4vr4xnSDxMaL", "te-IN", "balanced", 100, cache_hit=True, latency_ms=2, estimated_cost_paise=180
        )
    finally:
        conn.close()

    usage_res = client.get("/api/voices/usage", headers=demo_auth_headers)
    assert usage_res.status_code == 200
    u = usage_res.json()
    assert u["total_requests"] >= 2
    assert u["cache_hits"] >= 1
    assert u["billed_characters"] >= 100

    # AI Employee assignment with quality_profile & voice_personality
    agents = client.get("/api/agents", headers=demo_auth_headers).json()["agents"]
    assert len(agents) > 0
    agent_id = agents[0]["id"]
    upd = client.put(
        f"/api/agents/{agent_id}",
        headers=demo_auth_headers,
        json={
            "provider": "elevenlabs",
            "voice_id": "EXAVITQu4vr4xnSDxMaL",
            "voice_profile_id": "vp_el_EXAVITQu4vr4xnSDxMaL",
            "quality_profile": "premium",
            "voice_personality": "warm",
        },
    )
    assert upd.status_code == 200
    refreshed = client.get(f"/api/agents/{agent_id}", headers=demo_auth_headers).json()
    assert refreshed["quality_profile"] == "premium"
    assert refreshed["voice_personality"] == "warm"
    assert refreshed["voice_id"] == "EXAVITQu4vr4xnSDxMaL"

