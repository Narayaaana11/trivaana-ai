"""
TRIVAANA AI: Telephony Calling & Carrier Callback Tests
"""

def test_instant_call_and_carrier_callback(client, demo_auth_headers):
    # 1. Trigger instant call
    dial_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Suresh Reddy",
        "phone": "+919848022338",
        "vertical": "Real Estate",
        "language": "te-IN",
        "is_sandbox": True
    })
    assert dial_resp.status_code == 200
    dial_data = dial_resp.json()
    call_id = dial_data["call_id"]
    assert dial_data["success"] is True
    assert dial_data["status"] in ("ringing", "initiated", "queued")

    # 2. Check call is listed
    calls_resp = client.get("/api/calls", headers=demo_auth_headers)
    assert calls_resp.status_code == 200
    matching = [c for c in calls_resp.json()["calls"] if c["id"] == call_id]
    assert len(matching) == 1
    assert matching[0]["contact_name"] == "Suresh Reddy"

    # 3. Simulate carrier callback indicating 50-second completed call
    # 50 seconds rounds up to 60 billable seconds at ₹6.50/min = 650 paise
    callback_payload = {
        "call_sid": call_id,
        "CallSid": call_id,
        "status": "completed",
        "CallStatus": "completed",
        "duration": 50,
        "CallDuration": "50",
        "recording_url": "https://telephony-storage.example.com/recordings/call_123.mp3"
    }

    cb_resp = client.post(f"/api/calls/callback/{call_id}", json=callback_payload)
    assert cb_resp.status_code == 200
    cb_data = cb_resp.json()
    assert cb_data["status"] == "updated"
    assert cb_data["duration_seconds"] == 50
    assert cb_data["cost_paise"] == 650

    # 4. Verify call record has updated cost and duration
    updated_call = client.get(f"/api/calls/{call_id}", headers=demo_auth_headers).json()
    assert updated_call["duration_seconds"] == 50
    assert updated_call["billable_duration_seconds"] == 60
    assert updated_call["cost_paise"] == 650
    assert updated_call["cost"] == 6.50

def test_truthful_whatsapp_status(client, demo_auth_headers):
    # 1. Trigger call
    dial_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Bhavani",
        "phone": "+919848011223",
        "language": "te-IN",
        "is_sandbox": True
    })
    call_id = dial_resp.json()["call_id"]

    # 2. WhatsApp trigger should return truthful 'not_configured' status when keys are missing
    wa_resp = client.post(f"/api/calls/{call_id}/whatsapp", headers=demo_auth_headers)
    assert wa_resp.status_code == 200
    wa_data = wa_resp.json()
    assert wa_data["configured"] is False
    assert wa_data["status"] == "not_configured"
    assert "WHATSAPP_API_TOKEN" in wa_data["message"]
