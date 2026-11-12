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
from providers.voice_adapters import (
    ElevenLabsVoiceProvider,
    SarvamVoiceProvider,
    SarvamSTTProvider,
    VoiceProviderPlanError,
    VoiceProviderAuthError,
    VoiceProviderRateLimitError,
    VoiceProviderValidationError,
)
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
    assert u["preview_requests"] >= 2

    # Strict model validation: incompatible model + language returns 400 instead of silently downgrading
    bad_model = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "elevenlabs", "voice_id": "EXAVITQu4vr4xnSDxMaL", "language": "te-IN", "model_id": "eleven_flash_v2_5", "text": "Namaskaram"},
    )
    assert bad_model.status_code == 400
    assert "does not support" in bad_model.json()["detail"]

    # Input length validation (>1500 chars rejected)
    too_long = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "elevenlabs", "voice_id": "EXAVITQu4vr4xnSDxMaL", "language": "en-IN", "text": "x" * 1501},
    )
    assert too_long.status_code == 422

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


def test_sarvam_catalog_sync_and_language_mapping(monkeypatch, demo_auth_headers):
    # Verify or-IN -> od-IN mapping, 11 supported languages, and rejection of as-IN / ur-IN
    prov = SarvamVoiceProvider(api_key="sk_test_sarvam")
    assert prov.map_language_code("or-IN") == "od-IN"
    assert prov.map_language_code("hi-IN") == "hi-IN"
    with pytest.raises(VoiceProviderValidationError, match="does not support"):
        prov.map_language_code("as-IN")
    with pytest.raises(VoiceProviderValidationError, match="does not support"):
        prov.map_language_code("ur-IN")

    # Sync Sarvam catalog (37 v3 + 15 v4-flash = 52 voices, 2 models)
    conn = get_connection()
    try:
        sync_res = VoiceSyncService.sync_sarvam_catalog(conn)
        conn.commit()
        assert sync_res["synced"] is True
        assert sync_res["models_synced"] == 2
        assert sync_res["voices_synced"] == 52
    finally:
        conn.close()

    # Check /api/voices?provider=sarvam and /api/voices/models?provider=sarvam
    v_res = client.get("/api/voices?provider=sarvam", headers=demo_auth_headers)
    assert v_res.status_code == 200
    sarvam_voices = v_res.json()["voices"]
    assert len(sarvam_voices) >= 52
    assert all(v["provider"] == "sarvam" for v in sarvam_voices)

    m_res = client.get("/api/voices/models?provider=sarvam", headers=demo_auth_headers)
    assert m_res.status_code == 200
    model_ids = {m["model_id"] for m in m_res.json()["models"]}
    assert model_ids == {"bulbul:v3", "bulbul:v4-flash"}
    assert "bulbul:v2" not in model_ids


def test_sarvam_strict_validation_and_error_handling(monkeypatch, demo_auth_headers):
    prov = SarvamVoiceProvider(api_key="sk_test_sarvam")

    # Deprecated bulbul:v2 rejected
    with pytest.raises(VoiceProviderValidationError, match="deprecated"):
        prov.synthesize_speech("Namaste", voice_id="shubh", language="hi-IN", model_id="bulbul:v2")

    # Speaker / model mismatch rejected
    with pytest.raises(VoiceProviderValidationError, match="only compatible with 'bulbul:v4-flash'"):
        prov.synthesize_speech("Namaste", voice_id="shubh_hi_customer", language="hi-IN", model_id="bulbul:v3")
    with pytest.raises(VoiceProviderValidationError, match="'bulbul:v3' speaker"):
        prov.synthesize_speech("Namaste", voice_id="shubh", language="hi-IN", model_id="bulbul:v4-flash")

    # API /preview rejects bulbul:v2 and speaker/model mismatch with 400
    r_v2 = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "sarvam", "voice_id": "shubh", "language": "hi-IN", "model_id": "bulbul:v2", "text": "Namaste"},
    )
    assert r_v2.status_code == 400
    assert "deprecated" in r_v2.json()["detail"].lower()

    # Auth, rate-limit, and timeout mapping on SarvamVoiceProvider
    import sarvamai
    from providers.voice_adapters import _get_tts_cache
    _get_tts_cache()._memory.clear() if hasattr(_get_tts_cache(), "_memory") else None

    class _FakeStatusExc(RuntimeError):
        def __init__(self, status_code: int, body: str):
            super().__init__(body)
            self.status_code = status_code
            self.body = body

    class _FakeAuthClient:
        def __init__(self, **kwargs):
            pass
        class text_to_speech:
            @staticmethod
            def convert(**kwargs):
                raise _FakeStatusExc(401, "Unauthorized invalid api_subscription_key")

    monkeypatch.setattr(sarvamai, "SarvamAI", _FakeAuthClient)
    with pytest.raises(VoiceProviderAuthError):
        prov.synthesize_speech("Unique auth error test 1", voice_id="shubh", language="hi-IN", model_id="bulbul:v3")

    class _FakeRateLimitClient:
        def __init__(self, **kwargs):
            pass
        class text_to_speech:
            @staticmethod
            def convert(**kwargs):
                raise _FakeStatusExc(429, "Too Many Requests rate limit exceeded")

    monkeypatch.setattr(sarvamai, "SarvamAI", _FakeRateLimitClient)
    with pytest.raises(VoiceProviderRateLimitError):
        prov.synthesize_speech("Unique rate limit test 2", voice_id="shubh", language="hi-IN", model_id="bulbul:v3")

    class _FakeTimeoutClient:
        def __init__(self, **kwargs):
            pass
        class text_to_speech:
            @staticmethod
            def convert(**kwargs):
                raise TimeoutError("timed out")

    monkeypatch.setattr(sarvamai, "SarvamAI", _FakeTimeoutClient)
    with pytest.raises(RuntimeError, match="failed"):
        prov.synthesize_speech("Unique timeout test 3", voice_id="shubh", language="hi-IN", model_id="bulbul:v3")


def test_sarvam_stt_and_pipeline_call_synthesis(monkeypatch):
    import base64
    import sarvamai
    from providers.voice_adapters import get_voice_provider

    # Test SarvamSTTProvider
    class _FakeSTTClient:
        def __init__(self, **kwargs):
            pass
        class speech_to_text:
            @staticmethod
            def transcribe(**kwargs):
                assert kwargs["model"] == "saaras:v4"
                assert kwargs["mode"] == "transcribe"
                return type("Res", (), {"transcript": "Namaste Trivaana", "language_code": "hi-IN"})()

    monkeypatch.setattr(sarvamai, "SarvamAI", _FakeSTTClient)
    stt = SarvamSTTProvider(api_key="sk_test_sarvam")
    stt_res = stt.transcribe(b"RIFF....", language="hi-IN")
    assert stt_res["transcript"] == "Namaste Trivaana"
    assert stt_res["model"] == "saaras:v4"

    # Test VoiceSelectionService.select_sarvam_model_and_settings & get_voice_provider("sarvam")
    sel = VoiceSelectionService.select_sarvam_model_and_settings(
        language="hi-IN",
        quality_profile="economy",
        personality="friendly",
        speaker_id="shubh_hi_customer",
    )
    assert sel["model_id"] == "bulbul:v4-flash"

    fake_mp3 = b"ID3\x04\x00" + b"\x00" * 64
    b64 = base64.b64encode(fake_mp3).decode("ascii")

    class _FakeTTSClient:
        def __init__(self, **kwargs):
            pass
        class text_to_speech:
            @staticmethod
            def convert(**kwargs):
                assert kwargs["model"] == "bulbul:v3"
                assert kwargs["speaker"] == "priya"
                assert kwargs["language_code"] == "hi-IN"
                return type("TTSRes", (), {"audios": [b64]})()

    monkeypatch.setattr(sarvamai, "SarvamAI", _FakeTTSClient)
    monkeypatch.setenv("SARVAM_API_KEY", "sk_test_sarvam")

    prov = get_voice_provider("sarvam")
    out, meta = prov.synthesize_speech(
        text="Namaste! Main Priya bol rahi hoon.",
        language="hi-IN",
        voice_id="priya",
        model_id="bulbul:v3",
        output_audio_codec="mp3",
        speech_sample_rate=22050,
        return_metadata=True,
    )
    assert out == fake_mp3
    assert meta["model_id"] == "bulbul:v3"

