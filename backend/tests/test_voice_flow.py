"""
TRIVAANA AI: Voice Flow & Call Control Tests
Validates:
1. Dedicated TwiML voice instruction endpoint produces valid XML call control with Speech Gather.
2. TwiML gather callback accepts transcribed speech and persists conversational transcript.
3. Exotel Passthru call control endpoint returns structured flow control.
4. Multilingual dialect handling (Telugu te-IN, Hindi hi-IN, Indian English en-IN).
"""

from providers.voice_adapters import SarvamVoiceProvider, ElevenLabsVoiceProvider

def test_twiml_call_control_endpoint(client, demo_auth_headers):
    """
    Validates that /api/calls/twiml/{call_id} returns valid TwiML XML
    with speech recognition Gather and regional speech synthesis.
    """
    # 1. Create a Telugu call
    dial_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Telugu Prospect",
        "phone": "+919848077889",
        "language": "te-IN",
        "is_sandbox": True
    })
    call_id = dial_resp.json()["call_id"]

    # 2. Telephony provider requests voice instructions upon user answer
    twiml_resp = client.post(f"/api/calls/twiml/{call_id}")
    assert twiml_resp.status_code == 200
    assert "application/xml" in twiml_resp.headers["content-type"]
    xml_content = twiml_resp.text

    assert "<Response>" in xml_content
    assert '<Gather input="speech"' in xml_content
    assert 'language="te-IN"' in xml_content
    assert "నమస్కారం" in xml_content

def test_twiml_gather_speech_input_orchestration(client, demo_auth_headers):
    """
    Carrier transcribes speech and posts to /api/calls/twiml-gather/{call_id}.
    Server must persist transcribed turn to call record.
    """
    dial_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Speech Prospect",
        "phone": "+919848099887",
        "language": "te-IN",
        "is_sandbox": True
    })
    call_id = dial_resp.json()["call_id"]

    # Simulate carrier posting speech recognition result
    gather_resp = client.post(
        f"/api/calls/twiml-gather/{call_id}",
        data={"SpeechResult": "నాకు 3BHK విల్లా ధర ఎంత అని తెలుసుకోవాలి"}
    )
    assert gather_resp.status_code == 200
    assert "<Response>" in gather_resp.text

    # Verify transcript is recorded
    call_record = client.get(f"/api/calls/{call_id}", headers=demo_auth_headers).json()
    assert "నాకు 3BHK విల్లా ధర ఎంత" in call_record["transcript"]

def test_exotel_passthru_endpoint(client, demo_auth_headers):
    """Validates Exotel Passthru call control response."""
    dial_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Passthru Prospect",
        "phone": "+919848066554",
        "language": "te-IN",
        "is_sandbox": True
    })
    call_id = dial_resp.json()["call_id"]

    passthru_resp = client.get(f"/api/calls/exotel-passthru/{call_id}")
    assert passthru_resp.status_code == 200
    data = passthru_resp.json()
    assert data["select"] == "passthru"
    assert data["call_id"] == call_id
    assert data["language"] == "te-IN"

def test_voice_adapters_multilingual_handling():
    """Validates Sarvam and ElevenLabs voice adapters for Indian dialects."""
    sarvam = SarvamVoiceProvider(api_key="")
    # Deterministic preview bytes for Telugu and Hindi
    te_bytes = sarvam.synthesize_speech("నమస్కారం", language="te-IN")
    assert len(te_bytes) > 0
    assert te_bytes.startswith(b"\xff\xfb\x90\x00")

    hi_bytes = sarvam.synthesize_speech("नमस्ते", language="hi-IN")
    assert len(hi_bytes) > 0

    eleven = ElevenLabsVoiceProvider(api_key="")
    en_bytes = eleven.synthesize_speech("Hello, welcome to Trivaana AI", language="en-IN")
    assert len(en_bytes) > 0
