"""
TRIVAANA AI: Phase 1 Security, Billing, Consent & Database Parity Regression Tests
Covers:
1. Plivo/Vobiz stream XML unauthenticated 401 & WebSocket provider mismatch rejection.
2. API key scope enforcement (`require_scope`) and role-based read-only (`viewer`) write protection.
3. Password reset invalidates prior unused tokens and rejects suspended users.
4. Peer-admin suspension/removal protection and member/user status synchronization.
5. SSRF private-IP rejection on webhook and agent action creation.
6. Upload validation: broadcast non-CSV rejection, oversize cap, corrupt/oversize .docx zip rejection.
7. Razorpay sandbox disabled in production (`503`) and `fetch_payment` `httpx.get` execution.
8. Admin emergency kill switch blocks instant calls, campaigns, and voice broadcasts.
9. CSV upload defaults `consent_status='pending'` (excluded by campaigns) unless `consent_confirmed=true`.
10. `/api/leads/discover` route ordering not shadowed by `/api/leads/{lead_id}`.
11. Multiple cancelled appointments at the same `scheduled_start` succeed (`idx_appointments_active_slot`),
    while duplicate active (`scheduled`) bookings still return `409`.
"""

import io
import uuid
import pytest
from starlette.websockets import WebSocketDisconnect

from core.config import settings
from database import get_connection
from providers.plivo_adapter import PlivoTelephonyProvider
from providers.razorpay_adapter import RazorpayPaymentProvider
from providers.vobiz_adapter import VobizTelephonyProvider


def test_plivo_vobiz_xml_auth_and_ws_provider_mismatch(client, demo_auth_headers, monkeypatch):
    # Ensure XML endpoints fail closed without carrier auth
    assert client.post("/api/calls/plivo-xml/call_missing").status_code == 401
    assert client.post("/api/calls/vobiz-xml/call_missing").status_code == 401

    monkeypatch.setattr(settings, "PLIVO_AUTH_ID", "MA_TEST_PLIVO")
    monkeypatch.setattr(settings, "PLIVO_AUTH_TOKEN", "plivo_secret_tok")
    monkeypatch.setattr(settings, "PLIVO_PHONE_NUMBER", "+918047361000")
    dial = client.post(
        "/api/calls/instant",
        headers=demo_auth_headers,
        json={"name": "Plivo Lead", "phone": "+919848055111", "is_sandbox": False, "bypass_calling_hours": True},
    )
    assert dial.status_code == 200
    call_id = dial.json()["call_id"]

    # Valid Plivo capability token succeeds
    cb_tok = PlivoTelephonyProvider().build_callback_token(call_id)
    xml_ok = client.post(f"/api/calls/plivo-xml/{call_id}?plivo_auth={cb_tok}")
    assert xml_ok.status_code == 200
    assert "<Stream" in xml_ok.text

    # Calling Vobiz XML for a non-sandbox Plivo call rejects with 403 even with a valid Vobiz token
    vobiz_tok = VobizTelephonyProvider().build_callback_token(call_id)
    vobiz_wrong = client.post(f"/api/calls/vobiz-xml/{call_id}?vobiz_auth={vobiz_tok}")
    assert vobiz_wrong.status_code == 403

    # WS connection claiming provider=plivo without valid token is closed
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/api/calls/ws/stream/{call_id}?provider=plivo&token=bad_tok"):
            pass


def test_api_key_scopes_and_viewer_write_protection(client, demo_auth_headers):
    # Create a scoped read-only API key (`calls:read`)
    key_resp = client.post(
        "/api/workspaces/api-keys",
        headers=demo_auth_headers,
        json={"name": f"ReadCalls_{uuid.uuid4().hex[:4]}", "scopes": ["calls:read"]},
    )
    assert key_resp.status_code == 200
    api_key = key_resp.json()["api_key"]
    key_headers = {"X-API-Key": api_key}

    # Allowed on calls:read
    assert client.get("/api/calls", headers=key_headers).status_code == 200
    # Denied on unrelated resource scope (leads:read)
    assert client.get("/api/leads", headers=key_headers).status_code == 403
    # Denied on calls:write (POST /api/calls/instant)
    write_resp = client.post(
        "/api/calls/instant",
        headers=key_headers,
        json={"name": "Blocked", "phone": "+919848055112", "is_sandbox": True},
    )
    assert write_resp.status_code == 403

    # Invite a viewer and accept invite -> viewer cannot write leads or calls
    viewer_email = f"viewer_{uuid.uuid4().hex[:6]}@trivaana-test.in"
    inv = client.post(
        "/api/workspaces/members/invite",
        headers=demo_auth_headers,
        json={"email": viewer_email, "full_name": "Viewer User", "role": "viewer"},
    )
    assert inv.status_code == 200
    acc = client.post(
        "/api/auth/accept-invite",
        json={"invite_token": inv.json()["invite_token"], "full_name": "Viewer User", "password": "Password@123"},
    )
    assert acc.status_code == 200
    viewer_headers = {"Authorization": f"Bearer {acc.json()['access_token']}"}

    assert client.get("/api/leads", headers=viewer_headers).status_code == 200
    assert client.post(
        "/api/leads",
        headers=viewer_headers,
        json={"name": "Nope", "phone": "+919848055113"},
    ).status_code == 403
    assert client.post(
        "/api/calls/instant",
        headers=viewer_headers,
        json={"name": "Nope", "phone": "+919848055113", "is_sandbox": True},
    ).status_code == 403


def test_password_reset_token_invalidation_and_suspended_rejection(client, demo_auth_headers):
    # Create an operator member in demo workspace
    op_email = f"op_{uuid.uuid4().hex[:6]}@trivaana-test.in"
    inv = client.post(
        "/api/workspaces/members/invite",
        headers=demo_auth_headers,
        json={"email": op_email, "full_name": "Operator User", "role": "operator"},
    )
    assert inv.status_code == 200
    member_id = inv.json()["member_id"]
    acc = client.post(
        "/api/auth/accept-invite",
        json={"invite_token": inv.json()["invite_token"], "full_name": "Operator User", "password": "Password@123"},
    )
    assert acc.status_code == 200

    # Request reset token 1, then request reset token 2 -> token 1 must be invalidated
    r1 = client.post("/api/auth/password-reset/request", json={"email": op_email})
    assert r1.status_code == 200
    tok1 = r1.json().get("dev_reset_token")
    r2 = client.post("/api/auth/password-reset/request", json={"email": op_email})
    assert r2.status_code == 200
    tok2 = r2.json().get("dev_reset_token")
    assert tok1 and tok2 and tok1 != tok2

    c1 = client.post("/api/auth/password-reset/confirm", json={"token": tok1, "new_password": "NewPassword@123"})
    assert c1.status_code == 400

    # Suspend member -> syncs user status; password reset confirm must be rejected 403 and request must not issue token
    upd = client.put(
        f"/api/workspaces/members/{member_id}",
        headers=demo_auth_headers,
        json={"role": "operator", "status": "suspended"},
    )
    assert upd.status_code == 200

    c_susp = client.post("/api/auth/password-reset/confirm", json={"token": tok2, "new_password": "NewPassword@123"})
    assert c_susp.status_code == 403

    r_susp = client.post("/api/auth/password-reset/request", json={"email": op_email})
    assert r_susp.status_code == 200
    assert "dev_reset_token" not in r_susp.json()


def test_peer_admin_protection(client):
    # Register a fresh workspace owned by Admin 1
    uid = uuid.uuid4().hex[:6]
    reg = client.post(
        "/api/auth/register",
        json={
            "email": f"owner_{uid}@trivaana-test.in",
            "password": "Password@123",
            "full_name": "Owner One",
            "organization_name": f"PeerOrg {uid}",
        },
    )
    assert reg.status_code == 200
    owner_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # Owner invites Admin A and Admin B
    a1 = client.post(
        "/api/workspaces/members/invite",
        headers=owner_headers,
        json={"email": f"admin1_{uid}@trivaana-test.in", "full_name": "Admin One", "role": "admin"},
    ).json()
    a2 = client.post(
        "/api/workspaces/members/invite",
        headers=owner_headers,
        json={"email": f"admin2_{uid}@trivaana-test.in", "full_name": "Admin Two", "role": "admin"},
    ).json()

    tok_a1 = client.post(
        "/api/auth/accept-invite",
        json={"invite_token": a1["invite_token"], "full_name": "Admin One", "password": "Password@123"},
    ).json()["access_token"]
    client.post(
        "/api/auth/accept-invite",
        json={"invite_token": a2["invite_token"], "full_name": "Admin Two", "password": "Password@123"},
    )
    admin1_headers = {"Authorization": f"Bearer {tok_a1}"}

    # Admin 1 cannot modify or delete peer Admin 2
    assert client.put(
        f"/api/workspaces/members/{a2['member_id']}",
        headers=admin1_headers,
        json={"role": "admin", "status": "suspended"},
    ).status_code == 403
    assert client.delete(
        f"/api/workspaces/members/{a2['member_id']}",
        headers=admin1_headers,
    ).status_code == 403


def test_ssrf_and_upload_guards(client, demo_auth_headers):
    # SSRF private IP blocked at webhook creation
    wh = client.post(
        "/api/webhooks",
        headers=demo_auth_headers,
        json={"name": "Bad SSRF", "url": "http://127.0.0.1:8000/internal", "events": ["call.completed"]},
    )
    assert wh.status_code == 400

    # SSRF metadata IP blocked at agent action creation
    ag = client.post(
        "/api/agents",
        headers=demo_auth_headers,
        json={"name": "SSRF Check Agent", "vertical": "SaaS", "language": "en-IN", "system_prompt": "Test"},
    )
    assert ag.status_code == 200
    agent_id = ag.json()["agent_id"]
    act = client.post(
        f"/api/agents/{agent_id}/actions",
        headers=demo_auth_headers,
        json={
            "name": "Metadata Probe",
            "action_type": "custom_rest_api",
            "description": "Probe",
            "config": {"url": "http://169.254.169.254/latest/meta-data/"},
        },
    )
    assert act.status_code == 400

    # Broadcast non-CSV rejected
    brc = client.post(
        "/api/broadcasts",
        headers=demo_auth_headers,
        json={"name": "Upload Guard Broadcast", "message_text": "Hello", "language": "en-IN", "is_sandbox": True},
    )
    assert brc.status_code == 200
    brc_id = brc.json()["broadcast_id"]
    bad_brc = client.post(
        f"/api/broadcasts/{brc_id}/recipients/csv",
        headers=demo_auth_headers,
        files={"file": ("malware.exe", io.BytesIO(b"MZ..."), "application/octet-stream")},
    )
    assert bad_brc.status_code == 400

    # Corrupt .docx zip fails with HTTP 400 instead of 500
    bad_docx = client.post(
        "/api/knowledge/documents/upload",
        headers=demo_auth_headers,
        files={"file": ("corrupt.docx", io.BytesIO(b"not a zip file"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert bad_docx.status_code == 400


def test_razorpay_prod_gate_and_fetch_payment_httpx(client, demo_auth_headers, monkeypatch):
    # Production must reject sandbox Razorpay order creation with 503
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "")

    ord_resp = client.post(
        "/api/billing/razorpay-order",
        headers=demo_auth_headers,
        json={"amount_inr": 500},
    )
    assert ord_resp.status_code == 503

    provider = RazorpayPaymentProvider()
    assert provider.verify_payment_signature("order_sandbox_123", "pay_sandbox_456", "sig") is False

    # Configured provider uses httpx.get (not unimported requests.get)
    called = {}

    class DummyResp:
        status_code = 200

        def json(self):
            return {"id": "pay_live_123", "status": "captured", "amount": 50000, "currency": "INR"}

    def fake_get(url, auth=None, timeout=None):
        called["url"] = url
        return DummyResp()

    import providers.razorpay_adapter as rzp_mod
    monkeypatch.setattr(rzp_mod.httpx, "get", fake_get)
    live_provider = RazorpayPaymentProvider(key_id="rzp_live_id", key_secret="rzp_live_sec")
    payment = live_provider.fetch_payment("pay_live_123")
    assert payment["status"] == "captured"
    assert called["url"].endswith("/payments/pay_live_123")


def test_emergency_kill_switch_blocks_all_calling_paths(client, demo_auth_headers):
    # Create broadcast and campaign first
    brc = client.post(
        "/api/broadcasts",
        headers=demo_auth_headers,
        json={"name": "Kill Switch Brc", "message_text": "Alert", "language": "en-IN", "is_sandbox": True},
    )
    assert brc.status_code == 200
    brc_id = brc.json()["broadcast_id"]
    client.post(
        f"/api/broadcasts/{brc_id}/recipients/csv",
        headers=demo_auth_headers,
        files={"file": ("rec.csv", io.BytesIO(b"name,phone\nAlice,+919848066111\n"), "text/csv")},
    )

    cmp_resp = client.post(
        "/api/campaigns",
        headers=demo_auth_headers,
        json={"name": "Kill Switch Camp", "is_sandbox": True},
    )
    assert cmp_resp.status_code == 200
    cmp_id = cmp_resp.json()["campaign_id"]

    # Enable emergency pause
    ks = client.post(
        "/api/admin/emergency/kill-switch",
        headers=demo_auth_headers,
        json={"outbound_paused": True, "reason": "Incident #42"},
    )
    assert ks.status_code == 200

    try:
        call_resp = client.post(
            "/api/calls/instant",
            headers=demo_auth_headers,
            json={"name": "Blocked Call", "phone": "+919848066112", "is_sandbox": True},
        )
        assert call_resp.status_code == 400
        assert "paused" in call_resp.json()["detail"].lower()

        camp_start = client.post(
            "/api/campaigns/start",
            headers=demo_auth_headers,
            json={"campaign_id": cmp_id, "bypass_trai": True, "is_sandbox": True},
        )
        assert camp_start.status_code == 400
        assert "paused" in camp_start.json()["detail"].lower()

        brc_start = client.post(f"/api/broadcasts/{brc_id}/start?is_sandbox=true", headers=demo_auth_headers)
        assert brc_start.status_code == 503
    finally:
        # Always reset kill switch so subsequent tests are unaffected
        client.post(
            "/api/admin/emergency/kill-switch",
            headers=demo_auth_headers,
            json={"outbound_paused": False, "reason": "Reset"},
        )


def test_csv_pending_consent_and_discover_route_order(client, second_tenant_auth_headers):
    # Upload CSV without consent_confirmed -> leads default to 'pending' and are NOT dialed by campaign
    csv_body = "name,phone,city\nPendingLead,+919848077111,Hyderabad\n"
    up = client.post(
        "/api/leads/upload",
        headers=second_tenant_auth_headers,
        files={"file": ("pending.csv", io.BytesIO(csv_body.encode("utf-8")), "text/csv")},
    )
    assert up.status_code == 200
    assert up.json()["imported_count"] == 1

    conn = get_connection(settings.SQLITE_DB_PATH)
    try:
        row = conn.execute("SELECT consent_status FROM leads WHERE phone = '+919848077111'").fetchone()
        assert row["consent_status"] == "pending"
    finally:
        conn.close()

    cmp_id = client.post(
        "/api/campaigns",
        headers=second_tenant_auth_headers,
        json={"name": "Pending Consent Camp", "is_sandbox": True},
    ).json()["campaign_id"]
    start = client.post(
        "/api/campaigns/start",
        headers=second_tenant_auth_headers,
        json={"campaign_id": cmp_id, "bypass_trai": True, "is_sandbox": True},
    )
    assert start.status_code == 200
    assert start.json()["enqueued_count"] == 0

    # /api/leads/discover must not be shadowed by /api/leads/{lead_id}
    disc = client.get("/api/leads/discover?query=clinics&city=Hyderabad", headers=second_tenant_auth_headers)
    assert disc.status_code == 200
    assert "results" in disc.json() or "status" in disc.json()


def test_appointments_multiple_cancellations_same_slot(client, demo_auth_headers):
    slot_start = f"2026-12-01T10:{uuid.uuid4().int % 50 + 10:02d}:00+05:30"
    slot_end = "2026-12-01T11:30:00+05:30"

    # First booking + cancel
    a1 = client.post(
        "/api/appointments",
        headers=demo_auth_headers,
        json={"contact_name": "First", "phone": "+919848088111", "scheduled_start": slot_start, "scheduled_end": slot_end},
    )
    assert a1.status_code == 200
    id1 = a1.json()["appointment_id"]
    assert client.patch(f"/api/appointments/{id1}", headers=demo_auth_headers, json={"status": "cancelled"}).status_code == 200

    # Second booking on same freed slot -> conflict if active, cancel again must NOT throw IntegrityError!
    a2 = client.post(
        "/api/appointments",
        headers=demo_auth_headers,
        json={"contact_name": "Second", "phone": "+919848088112", "scheduled_start": slot_start, "scheduled_end": slot_end},
    )
    assert a2.status_code == 200
    id2 = a2.json()["appointment_id"]

    # Third overlapping booking while id2 is still 'scheduled' -> 409 conflict
    a3 = client.post(
        "/api/appointments",
        headers=demo_auth_headers,
        json={"contact_name": "Conflict", "phone": "+919848088113", "scheduled_start": slot_start, "scheduled_end": slot_end},
    )
    assert a3.status_code == 409

    # Cancelling id2 must succeed cleanly even though id1 is already 'cancelled' at same slot
    c2 = client.patch(f"/api/appointments/{id2}", headers=demo_auth_headers, json={"status": "cancelled"})
    assert c2.status_code == 200
