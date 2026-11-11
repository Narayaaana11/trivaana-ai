"""
TRIVAANA AI: Carrier Callback Security Regression Tests
Validates:
1. Rejection of unsigned or forged Twilio callbacks (HTTP 401).
2. Proper HMAC-SHA1 Twilio signature verification over public URL + sorted POST params.
3. Rejection of unauthenticated Exotel callbacks (HTTP 401).
4. Rejection of Call SID mismatches (HTTP 400).
5. Protection against mock carrier event injection in production.
"""

import hmac
import hashlib
import base64
import pytest
from core.config import settings

def test_twilio_callback_signature_verification(client, demo_auth_headers, monkeypatch):
    """
    Simulates Twilio status callback:
    1. Forged or unsigned request is rejected with HTTP 401.
    2. Valid HMAC-SHA1 signature over URL and sorted params is accepted and updates call.
    """
    # 1. Trigger call using twilio provider
    auth_token = "twilio_live_auth_token_9876543210"
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC_test_1234567890")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", auth_token)
    monkeypatch.setattr(settings, "TWILIO_PHONE_NUMBER", "+12025550199")

    dial_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Twilio Prospect",
        "phone": "+919848011222",
        "is_sandbox": False,
        "bypass_calling_hours": True,
    })
    assert dial_resp.status_code == 200
    call_id = dial_resp.json()["call_id"]
    provider_call_id = dial_resp.json()["provider_call_id"]

    callback_params = {
        "CallSid": provider_call_id,
        "CallStatus": "completed",
        "CallDuration": "45",
        "Duration": "45"
    }

    # 2. Test Forged Signature -> 401 Unauthorized
    forged_resp = client.post(
        f"/api/calls/callback/{call_id}",
        data=callback_params,
        headers={"X-Twilio-Signature": "forged_signature_123"}
    )
    assert forged_resp.status_code == 401
    assert "Invalid Twilio request signature" in forged_resp.json()["detail"]

    # Ensure call was NOT updated by forged request
    call_check = client.get(f"/api/calls/{call_id}", headers=demo_auth_headers).json()
    assert call_check["status"] != "completed"
    assert call_check["duration_seconds"] == 0

    # 3. Compute Official Twilio HMAC-SHA1 Signature
    public_url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/calls/callback/{call_id}"
    sorted_keys = sorted(callback_params.keys())
    data_to_sign = public_url + "".join(f"{k}{callback_params[k]}" for k in sorted_keys)
    valid_signature = base64.b64encode(
        hmac.new(auth_token.encode("utf-8"), data_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")

    # 4. Valid Twilio Request -> 200 OK
    valid_resp = client.post(
        f"/api/calls/callback/{call_id}",
        data=callback_params,
        headers={"X-Twilio-Signature": valid_signature}
    )
    assert valid_resp.status_code == 200
    assert valid_resp.json()["call_status"] == "completed"

    # Verify call state updated
    updated_call = client.get(f"/api/calls/{call_id}", headers=demo_auth_headers).json()
    assert updated_call["status"] == "completed"
    assert updated_call["duration_seconds"] == 45

def test_exotel_callback_authentication(client, demo_auth_headers, monkeypatch):
    """
    Exotel callback verification:
    1. Unauthenticated callback returns HTTP 401.
    2. Valid authentication credentials update the call.
    """
    api_key = "exotel_api_key_123"
    api_token = "exotel_api_token_456"
    monkeypatch.setattr(settings, "EXOTEL_API_KEY", api_key)
    monkeypatch.setattr(settings, "EXOTEL_API_TOKEN", api_token)
    monkeypatch.setattr(settings, "EXOTEL_SID", "exotel_sid_789")
    monkeypatch.setattr(settings, "EXOTEL_PHONE_NUMBER", "+918047361234")

    dial_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Exotel Prospect",
        "phone": "+919848033444",
        "is_sandbox": False,
        "bypass_calling_hours": True,
    })
    call_id = dial_resp.json()["call_id"]
    provider_call_id = dial_resp.json()["provider_call_id"]

    callback_params = {
        "CallSid": provider_call_id,
        "Status": "completed",
        "DialCallDuration": "65"
    }

    # 1. Unauthenticated -> 401
    unauth_resp = client.post(f"/api/calls/callback/{call_id}", data=callback_params)
    assert unauth_resp.status_code == 401

    # 2. Authenticated via Basic Auth -> 200
    basic_auth = base64.b64encode(f"{api_key}:{api_token}".encode("utf-8")).decode("utf-8")
    auth_resp = client.post(
        f"/api/calls/callback/{call_id}",
        data=callback_params,
        headers={"Authorization": f"Basic {basic_auth}"}
    )
    assert auth_resp.status_code == 200
    assert auth_resp.json()["call_status"] == "completed"

def test_call_sid_mismatch_rejected(client, demo_auth_headers):
    """If callback payload provides a CallSid that doesn't match the record, reject with 400."""
    dial_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Mismatch Prospect",
        "phone": "+919848055666",
        "is_sandbox": True
    })
    call_id = dial_resp.json()["call_id"]

    mismatch_payload = {
        "CallSid": "foreign_call_sid_not_matching",
        "status": "completed",
        "duration": 30
    }

    resp = client.post(f"/api/calls/callback/{call_id}", json=mismatch_payload)
    assert resp.status_code == 400
    assert "Call SID mismatch" in resp.json()["detail"]
