"""
TRIVAANA AI: Comprehensive Voice Studio Preview & Synthesis Routing Tests
Covers:
- ElevenLabs synthesis routing & response metadata
- Sarvam synthesis routing & response metadata
- Invalid provider, invalid voice IDs, cross-provider voice IDs
- Unsupported model/language & speaker/model combinations
- Missing API credentials (never returns fake audio as synthesized, never records usage)
- Provider authentication errors (401)
- Rate limiting (429) — both provider 429 and tenant preview rate limit
- Usage metering (records only on real synthesis, not on failures/sandbox)
- Cache hits and misses
- Correct response content type (audio/mpeg)
- No fake/placeholder audio returned as successful synthesis
"""

import base64
import uuid
import pytest
from fastapi.testclient import TestClient

from main import app
from database.connection import get_connection
from providers.voice_adapters import (
    ElevenLabsVoiceProvider,
    SarvamVoiceProvider,
    VoiceProviderAuthError,
    VoiceProviderPlanError,
    VoiceProviderRateLimitError,
    _get_tts_cache,
)
from routers import voices as voices_router

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_rate_buckets_and_cache():
    voices_router._PREVIEW_RATE_BUCKETS.clear()
    cache = _get_tts_cache()
    if hasattr(cache, "_memory"):
        cache._memory.clear()
    yield
    voices_router._PREVIEW_RATE_BUCKETS.clear()


def test_elevenlabs_preview_routing_and_usage_metering(demo_auth_headers, monkeypatch):
    fake_mp3 = b"ID3\x04\x00\x00\x00\x00\x00\x10" + b"\xaa\xbb\xcc\xdd" * 16
    calls = []

    class _FakeResp:
        def __init__(self, status_code, content=b"", headers=None):
            self.status_code = status_code
            self.content = content
            self.headers = headers or {}
            self.text = ""

    def _fake_post(url, headers=None, json=None, timeout=None):
        calls.append({"url": url, "json": json})
        return _FakeResp(200, fake_mp3, {"character-cost": str(len(json["text"]))})

    monkeypatch.setattr(ElevenLabsVoiceProvider, "is_configured", property(lambda self: True))
    monkeypatch.setattr("providers.voice_adapters.requests.post", _fake_post)

    before_usage = client.get("/api/voices/usage", headers=demo_auth_headers).json()["total_requests"]
    unique_text = f"Namaskaram Trivaana ElevenLabs unique test {uuid.uuid4().hex[:8]}"

    # First call: cache miss
    res1 = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={
            "provider": "elevenlabs",
            "voice_id": "EXAVITQu4vr4xnSDxMaL",
            "language": "te-IN",
            "model_id": "eleven_v4_turbo",
            "text": unique_text,
            "quality_profile": "balanced",
            "personality": "professional",
        },
    )
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["status"] == "synthesized"
    assert d1["configured"] is True
    assert d1["provider"] == "elevenlabs"
    assert d1["voice_id"] == "EXAVITQu4vr4xnSDxMaL"
    assert d1["model_used"] == "eleven_v4_turbo"
    assert d1["content_type"] == "audio/mpeg"
    assert d1["cache_hit"] is False
    assert base64.b64decode(d1["audio_base64"]) == fake_mp3
    assert len(calls) == 1
    assert "EXAVITQu4vr4xnSDxMaL" in calls[0]["url"]
    assert calls[0]["json"]["model_id"] == "eleven_v4_turbo"

    # Second identical call: cache hit (does not call ElevenLabs HTTP API again)
    res2 = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={
            "provider": "elevenlabs",
            "voice_id": "EXAVITQu4vr4xnSDxMaL",
            "language": "te-IN",
            "model_id": "eleven_v4_turbo",
            "text": unique_text,
            "quality_profile": "balanced",
            "personality": "professional",
        },
    )
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["status"] == "synthesized"
    assert d2["cache_hit"] is True
    assert d2["estimated_cost_paise"] == 0
    assert len(calls) == 1

    after_usage = client.get("/api/voices/usage", headers=demo_auth_headers).json()
    assert after_usage["total_requests"] >= before_usage + 2
    assert after_usage["cache_hits"] >= 1


def test_sarvam_preview_routing_and_cache(demo_auth_headers, monkeypatch):
    import sarvamai

    fake_mp3 = b"ID3\x04\x00\x00\x00\x00\x00\x10" + b"\x11\x22\x33\x44" * 16
    b64 = base64.b64encode(fake_mp3).decode("ascii")
    sdk_calls = []

    class _FakeSarvamClient:
        def __init__(self, **kwargs):
            pass

        class text_to_speech:
            @staticmethod
            def convert(**kwargs):
                sdk_calls.append(kwargs)
                return type("Res", (), {"audios": [b64]})()

    monkeypatch.setattr(SarvamVoiceProvider, "is_configured", property(lambda self: True))
    monkeypatch.setattr(sarvamai, "SarvamAI", _FakeSarvamClient)

    unique_text = f"నమస్కారం ట్రివానా Sarvam unique test {uuid.uuid4().hex[:8]}"
    res1 = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={
            "provider": "sarvam",
            "voice_id": "kavitha",
            "language": "te-IN",
            "model_id": "bulbul:v3",
            "text": unique_text,
        },
    )
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["status"] == "synthesized"
    assert d1["provider"] == "sarvam"
    assert d1["voice_id"] == "kavitha"
    assert d1["model_used"] == "bulbul:v3"
    assert d1["content_type"] == "audio/mpeg"
    assert d1["cache_hit"] is False
    assert base64.b64decode(d1["audio_base64"]) == fake_mp3
    assert len(sdk_calls) == 1
    assert sdk_calls[0]["speaker"] == "kavitha"
    assert sdk_calls[0]["model"] == "bulbul:v3"
    assert sdk_calls[0]["language_code"] == "te-IN"

    # Second call hits cache
    res2 = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={
            "provider": "sarvam",
            "voice_id": "kavitha",
            "language": "te-IN",
            "model_id": "bulbul:v3",
            "text": unique_text,
        },
    )
    assert res2.status_code == 200
    assert res2.json()["cache_hit"] is True
    assert len(sdk_calls) == 1


def test_invalid_provider_voice_id_and_model_language_combinations(demo_auth_headers):
    # Unsupported provider rejected with 400 (never silently falls back to Sarvam)
    bad_prov = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "unknown_tts", "voice_id": "shubh", "language": "hi-IN", "text": "Hello"},
    )
    assert bad_prov.status_code == 400
    assert "Unsupported voice provider" in bad_prov.json()["detail"]

    # Unknown Sarvam speaker rejected with 400
    bad_spk = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "sarvam", "voice_id": "nonexistent_speaker_xyz", "language": "hi-IN", "text": "Hello"},
    )
    assert bad_spk.status_code == 400
    assert "Unknown Sarvam" in bad_spk.json()["detail"]

    # Cross-provider model rejected (Sarvam model on ElevenLabs)
    cross_model = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={
            "provider": "elevenlabs",
            "voice_id": "EXAVITQu4vr4xnSDxMaL",
            "language": "hi-IN",
            "model_id": "bulbul:v3",
            "text": "Hello",
        },
    )
    assert cross_model.status_code == 400

    # Sarvam v4-flash speaker incompatible with unsupported language
    bad_spk_lang = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={
            "provider": "sarvam",
            "voice_id": "kavitha_te_conversation",
            "language": "hi-IN",
            "model_id": "bulbul:v4-flash",
            "text": "Namaste",
        },
    )
    assert bad_spk_lang.status_code == 400
    assert "only supports" in bad_spk_lang.json()["detail"]

    # Whitespace-only text rejected
    empty_txt = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "sarvam", "voice_id": "shubh", "language": "hi-IN", "text": "   "},
    )
    assert empty_txt.status_code == 400


def test_missing_credentials_never_returns_fake_audio_or_records_usage(demo_auth_headers, monkeypatch):
    monkeypatch.setattr(SarvamVoiceProvider, "is_configured", property(lambda self: False))
    monkeypatch.setattr(ElevenLabsVoiceProvider, "is_configured", property(lambda self: False))

    before = client.get("/api/voices/usage", headers=demo_auth_headers).json()["total_requests"]

    sv_res = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "sarvam", "voice_id": "shubh", "language": "te-IN", "text": "Namaskaram"},
    )
    assert sv_res.status_code == 200
    sv_data = sv_res.json()
    assert sv_data["status"] == "sandbox_only"
    assert sv_data["configured"] is False
    assert sv_data["audio_base64"] is None

    el_res = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "elevenlabs", "voice_id": "EXAVITQu4vr4xnSDxMaL", "language": "en-IN", "text": "Hello"},
    )
    assert el_res.status_code == 200
    el_data = el_res.json()
    assert el_data["status"] == "sandbox_only"
    assert el_data["configured"] is False
    assert el_data["audio_base64"] is None

    after = client.get("/api/voices/usage", headers=demo_auth_headers).json()["total_requests"]
    assert after == before


def test_no_fake_audio_bytes_returned_as_synthesized(demo_auth_headers, monkeypatch):
    monkeypatch.setattr(SarvamVoiceProvider, "is_configured", property(lambda self: True))
    monkeypatch.setattr(
        SarvamVoiceProvider,
        "synthesize_speech",
        lambda self, text, **kwargs: (
            b"\xff\xfb\x90\x00" + text.encode("utf-8"),
            {"cache_hit": False, "model_id": "sandbox", "provider_characters_reported": 0, "sandbox": True},
        ),
    )

    res = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "sarvam", "voice_id": "shubh", "language": "hi-IN", "text": "Test fake bytes guard"},
    )
    assert res.status_code == 502


def test_provider_auth_error_plan_error_and_rate_limiting(demo_auth_headers, monkeypatch):
    monkeypatch.setattr(ElevenLabsVoiceProvider, "is_configured", property(lambda self: True))

    def _raise_auth(*args, **kwargs):
        raise VoiceProviderAuthError("Invalid ElevenLabs API key")

    monkeypatch.setattr(ElevenLabsVoiceProvider, "synthesize_speech", _raise_auth)
    r_auth = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "elevenlabs", "voice_id": "EXAVITQu4vr4xnSDxMaL", "language": "en-IN", "text": "Hello"},
    )
    assert r_auth.status_code == 401
    assert "Invalid ElevenLabs" in r_auth.json()["detail"]

    def _raise_plan(*args, **kwargs):
        raise VoiceProviderPlanError("Upgrade plan to use professional library voice")

    monkeypatch.setattr(ElevenLabsVoiceProvider, "synthesize_speech", _raise_plan)
    r_plan = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "elevenlabs", "voice_id": "EXAVITQu4vr4xnSDxMaL", "language": "en-IN", "text": "Hello"},
    )
    assert r_plan.status_code == 200
    assert r_plan.json()["status"] == "plan_upgrade_required"
    assert r_plan.json()["audio_base64"] is None

    def _raise_rate(*args, **kwargs):
        raise VoiceProviderRateLimitError("Provider rate limit exceeded")

    monkeypatch.setattr(ElevenLabsVoiceProvider, "synthesize_speech", _raise_rate)
    r_rate = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "elevenlabs", "voice_id": "EXAVITQu4vr4xnSDxMaL", "language": "en-IN", "text": "Hello"},
    )
    assert r_rate.status_code == 429
    assert "rate limit" in r_rate.json()["detail"].lower()

    # Tenant preview rate limit (40 req/min)
    monkeypatch.setattr(voices_router, "_PREVIEW_RATE_LIMIT", 2)
    voices_router._PREVIEW_RATE_BUCKETS.clear()
    monkeypatch.setattr(SarvamVoiceProvider, "is_configured", property(lambda self: False))
    for _ in range(2):
        ok = client.post(
            "/api/voices/preview",
            headers=demo_auth_headers,
            json={"provider": "sarvam", "voice_id": "shubh", "language": "hi-IN", "text": "Hi"},
        )
        assert ok.status_code == 200
    blocked = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "sarvam", "voice_id": "shubh", "language": "hi-IN", "text": "Hi"},
    )
    assert blocked.status_code == 429
