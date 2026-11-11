"""
TRIVAANA AI: Target Architecture, Security Hardening & New Domain Modules Tests
"""

import json
import sys
from pathlib import Path
import uuid
from core.config import settings
from core.vault import decrypt_config_json
from database.connection import get_connection


def test_sec01_welcome_credit_disabled_in_prod(client, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_WELCOME_CREDIT", False)
    email = f"nopromo_{uuid.uuid4().hex[:6]}@example.com"
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": "Password@123", "full_name": "Zero Credit User"},
    )
    assert resp.status_code == 200
    assert resp.json()["tenant"]["wallet_balance_inr"] == 0.0


def test_sec02_unified_razorpay_order_idempotency(client, demo_auth_headers):
    import hmac
    import hashlib

    init_bal = client.get("/api/tenant", headers=demo_auth_headers).json()["wallet_balance_paise"]
    order_resp = client.post("/api/billing/razorpay-order", headers=demo_auth_headers, json={"amount_inr": 600.0})
    assert order_resp.status_code == 200
    order_id = order_resp.json()["id"]

    pay_id = f"pay_sandbox_{order_id[-8:]}"
    verify_resp = client.post(
        "/api/billing/razorpay-verification",
        headers=demo_auth_headers,
        json={"order_id": order_id, "payment_id": pay_id, "signature": "sig"},
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["amount_paise"] == 60000

    # Subsequent webhook for same order must report already_processed and NOT credit again
    settings.RAZORPAY_WEBHOOK_SECRET = "wh_secret_unified_test"
    payload = json.dumps({
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": pay_id, "order_id": order_id, "amount": 60000, "status": "captured"}}},
    }).encode("utf-8")
    sig = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    wh_resp = client.post(
        "/api/billing/razorpay-webhook",
        content=payload,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
    )
    assert wh_resp.status_code == 200
    assert wh_resp.json()["status"] == "already_processed"

    final_bal = client.get("/api/tenant", headers=demo_auth_headers).json()["wallet_balance_paise"]
    assert final_bal == init_bal + 60000


def test_sec03_media_path_traversal_blocked(client, demo_auth_headers):
    resp = client.get("/api/media/tenant_demo_enterprise/../other_tenant/secret.mp3", headers=demo_auth_headers)
    assert resp.status_code == 403


def test_sec04_encrypted_integration_secrets(client, demo_auth_headers):
    resp = client.post(
        "/api/integrations/openai/connect",
        headers=demo_auth_headers,
        json={"config": {"api_key": "sk-test-secret-998877"}, "permissions": ["read"]},
    )
    assert resp.status_code == 200
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT config_json FROM integrations WHERE provider_key = 'openai' ORDER BY updated_at DESC LIMIT 1")
        raw = cur.fetchone()["config_json"]
        assert "sk-test-secret-998877" not in raw
        parsed = json.loads(raw)
        assert parsed.get("_encrypted") is True
        assert decrypt_config_json(raw)["api_key"] == "sk-test-secret-998877"
    finally:
        conn.close()


def test_sec05_rbac_invite_accept_and_token_revocation(client, second_tenant_auth_headers):
    # 1. Owner invites a viewer
    inv_email = f"viewer_{uuid.uuid4().hex[:6]}@example.com"
    inv_resp = client.post(
        "/api/workspaces/members/invite",
        headers=second_tenant_auth_headers,
        json={"email": inv_email, "full_name": "Viewer User", "role": "viewer"},
    )
    assert inv_resp.status_code == 200
    inv_token = inv_resp.json()["invite_token"]

    # 2. Viewer accepts invite
    acc_resp = client.post(
        "/api/auth/accept-invite",
        json={"invite_token": inv_token, "full_name": "Viewer User", "password": "Password@123"},
    )
    assert acc_resp.status_code == 200
    viewer_tok = acc_resp.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_tok}"}

    # 3. Viewer cannot mutate compliance policy or integrations (403)
    pol_resp = client.put(
        "/api/compliance/policy",
        headers=viewer_headers,
        json={"enforce_dnd_scrubbing": False},
    )
    assert pol_resp.status_code == 403

    # 4. Password reset increments token_version and revokes old token
    rst_req = client.post("/api/auth/password-reset/request", json={"email": inv_email})
    rst_tok = rst_req.json()["dev_reset_token"]
    rst_conf = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": rst_tok, "new_password": "NewPassword@456"},
    )
    assert rst_conf.status_code == 200
    me_after = client.get("/api/auth/me", headers=viewer_headers)
    assert me_after.status_code == 401


def test_appointments_workflows_support_staff_and_admin_endpoints(client, demo_auth_headers, second_tenant_auth_headers):
    # 1. Appointment double-booking protection
    slot_start = f"2026-12-01T10:00:00+05:30"
    slot_end = f"2026-12-01T10:30:00+05:30"
    apt1 = client.post(
        "/api/appointments",
        headers=demo_auth_headers,
        json={"contact_name": "Ravi", "phone": "+919848011122", "title": "Villa Visit", "scheduled_start": slot_start, "scheduled_end": slot_end},
    )
    assert apt1.status_code == 200
    apt2 = client.post(
        "/api/appointments",
        headers=demo_auth_headers,
        json={"contact_name": "Sita", "phone": "+919848022233", "title": "Clash Visit", "scheduled_start": slot_start, "scheduled_end": slot_end},
    )
    assert apt2.status_code == 409

    # 2. Visual Workflow create & execute
    wf = client.post(
        "/api/workflows",
        headers=demo_auth_headers,
        json={
            "name": "Lead Followup Flow",
            "trigger_type": "call_completed",
            "graph": {"nodes": [{"id": "1", "data": {"label": "Qualify"}}, {"id": "2", "data": {"label": "Book"}}], "edges": [{"id": "e1", "source": "1", "target": "2"}]},
        },
    )
    assert wf.status_code == 200
    wf_id = wf.json()["workflow_id"]
    exe = client.post(f"/api/workflows/{wf_id}/execute", headers=demo_auth_headers, json={"trigger_event": "manual", "context": {"lead": "Ravi"}})
    assert exe.status_code == 200
    assert exe.json()["steps_executed"] == 2

    # 3. Support tickets + Staff Portal RBAC
    tkt = client.post(
        "/api/support/tickets",
        headers=second_tenant_auth_headers,
        json={"subject": "SIP Trunk Help", "description": "Need Exotel setup", "category": "telephony"},
    )
    assert tkt.status_code == 200
    assert client.get("/api/staff/tickets", headers=second_tenant_auth_headers).status_code == 403
    staff_tkts = client.get("/api/staff/tickets", headers=demo_auth_headers)
    assert staff_tkts.status_code == 200
    assert len(staff_tkts.json()["tickets"]) >= 1

    # 4. Super Admin Finance, Providers Health, Kill Switch & Prometheus metrics
    assert client.get("/api/admin/finance/summary", headers=demo_auth_headers).status_code == 200
    assert client.get("/api/admin/providers/health", headers=demo_auth_headers).status_code == 200
    ks = client.post("/api/admin/emergency/kill-switch", headers=demo_auth_headers, json={"outbound_paused": True, "reason": "Test"})
    assert ks.status_code == 200
    assert ks.json()["outbound_paused"] is True
    # Reset kill switch
    client.post("/api/admin/emergency/kill-switch", headers=demo_auth_headers, json={"outbound_paused": False, "reason": "Reset"})

    metrics = client.get("/metrics")
    assert metrics.status_code == 200
    assert "trivaana_http_requests_total" in metrics.text


def test_voice_eval_harness_and_auto_dnc(client, demo_auth_headers):
    root_dir = Path(__file__).resolve().parents[2]
    if str(root_dir) not in sys.path:
        sys.path.insert(0, str(root_dir))
    from importlib.util import spec_from_file_location, module_from_spec

    harness_path = root_dir / "voice-engine" / "evaluations" / "eval_harness.py"
    spec = spec_from_file_location("eval_harness", harness_path)
    mod = module_from_spec(spec)
    spec.loader.exec_module(mod)

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM agents WHERE tenant_id = 'tenant_demo_enterprise' LIMIT 1")
        ag = dict(cur.fetchone())
        report = mod.run_regression_suite(conn, "tenant_demo_enterprise", ag)
        assert report["passed"] == report["total"]
        assert report["pass_rate"] == 1.0
    finally:
        conn.close()

