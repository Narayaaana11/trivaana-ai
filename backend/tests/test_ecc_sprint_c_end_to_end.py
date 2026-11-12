"""
TRIVAANA AI — ECC Sprint C End-to-End Backend Tests (TDD RED -> GREEN)
Covers:
1. Public contact inquiry persistence (POST /api/public/contact + contact_inquiries table)
2. CRM lead scoring + unified customer timeline (GET /api/leads/{lead_id}/timeline)
3. Call QA extraction enrichment (POST /api/calls/{id}/analyze + GET /api/calls/{id})
4. Honest carrier call transfer execution (ActionService.call_transfer & POST /api/calls/{id}/transfer)
5. Super Admin kill-switch state in GET /api/admin/overview
"""

import uuid
from datetime import datetime, timezone
from services.action_service import ActionService
from database.connection import get_connection


def test_public_contact_inquiry_persistence_and_validation(client):
    # Invalid / empty email & message should reject cleanly
    bad_resp = client.post(
        "/api/public/contact",
        json={"name": "Asha", "email": "not-an-email", "message": "Hi"},
    )
    assert bad_resp.status_code == 422

    # Valid submission persists into contact_inquiries
    unique_email = f"enterprise-{uuid.uuid4().hex[:6]}@acme.in"
    resp = client.post(
        "/api/public/contact",
        json={
            "name": "Rohan Kulkarni",
            "email": unique_email,
            "company": "Acme Realty Pvt Ltd",
            "phone": "+919848011223",
            "plan_interest": "growth",
            "message": "We want 15 concurrent Telugu and Hindi outbound lines.",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "received"
    assert body["inquiry_id"].startswith("inq_")

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM contact_inquiries WHERE id = ?",
            (body["inquiry_id"],),
        ).fetchone()
        assert row is not None
        assert row["email"] == unique_email
        assert row["plan_interest"] == "growth"
    finally:
        conn.close()


def test_lead_scoring_and_unified_timeline(client, demo_auth_headers, second_tenant_auth_headers):
    leads_resp = client.get("/api/leads", headers=demo_auth_headers)
    assert leads_resp.status_code == 200
    leads = leads_resp.json()["leads"]
    assert len(leads) >= 1
    first = leads[0]
    assert "lead_score" in first
    assert isinstance(first["lead_score"], int)
    assert 0 <= first["lead_score"] <= 100
    assert first.get("qualification_tier") in ("hot", "warm", "cold", "dnc")

    tl_resp = client.get(f"/api/leads/{first['id']}/timeline", headers=demo_auth_headers)
    assert tl_resp.status_code == 200
    tl = tl_resp.json()
    assert tl["lead"]["id"] == first["id"]
    assert isinstance(tl["timeline"], list)
    assert any(ev["event_type"] == "lead_created" for ev in tl["timeline"])

    # Cross-tenant timeline access must fail closed with 404
    cross = client.get(f"/api/leads/{first['id']}/timeline", headers=second_tenant_auth_headers)
    assert cross.status_code == 404


def test_call_analyze_enriches_qa_score_objections_and_competitors(client, demo_auth_headers):
    calls_resp = client.get("/api/calls", headers=demo_auth_headers)
    assert calls_resp.status_code == 200
    calls = calls_resp.json()["calls"]
    assert len(calls) >= 1
    call_id = calls[0]["id"]

    analyze_resp = client.post(f"/api/calls/{call_id}/analyze", headers=demo_auth_headers)
    assert analyze_resp.status_code == 200
    analyzed = analyze_resp.json()
    assert isinstance(analyzed.get("qualification_score"), int)
    assert 0 <= analyzed["qualification_score"] <= 100
    assert isinstance(analyzed.get("objections"), list)
    assert isinstance(analyzed.get("competitors_mentioned"), list)
    assert analyzed.get("next_action")

    detail_resp = client.get(f"/api/calls/{call_id}", headers=demo_auth_headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail.get("qa_extraction") is not None
    assert isinstance(detail["qa_extraction"].get("qualification_score"), int)


def test_call_transfer_truthful_status_never_fakes_executed(client, demo_auth_headers):
    conn = get_connection()
    live_call_id = f"call_xfer_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    try:
        # Insert a non-sandbox Twilio call while Twilio credentials are NOT configured
        tenant_row = conn.execute("SELECT id FROM tenants WHERE id = 'tenant_demo_enterprise'").fetchone() or conn.execute("SELECT id FROM tenants LIMIT 1").fetchone()
        conn.execute(
            """
            INSERT INTO calls (id, tenant_id, contact_name, phone, direction, provider, provider_call_id, status, language, is_sandbox, created_at)
            VALUES (?, ?, 'Transfer Test', '+919848099999', 'outbound', 'twilio', 'CA_unconfigured_123', 'connected', 'en-IN', 0, ?)
            """,
            (live_call_id, tenant_row["id"], now),
        )
        conn.commit()

        res = ActionService.execute_action(
            conn=conn,
            tenant_id=tenant_row["id"],
            call_id=live_call_id,
            action_type="call_transfer",
            action_name="Warm Transfer",
            arguments={"transfer_number": "+919848011111"},
            is_sandbox=False,
        )
        assert res["status"] in ("not_configured", "failed")
        assert res["status"] != "executed"

        # Route endpoint must also refuse fake success when carrier is not configured
        api_res = client.post(
            f"/api/calls/{live_call_id}/transfer",
            headers=demo_auth_headers,
            json={"target_phone": "+919848011111", "reason": "Escalation"},
        )
        assert api_res.status_code in (422, 503) or api_res.json().get("status") == "not_configured"
        assert api_res.json().get("status") != "transfer_initiated"

        # Sandbox call transfer succeeds honestly as simulated
        sbx_res = ActionService.execute_action(
            conn=conn,
            tenant_id=tenant_row["id"],
            call_id=live_call_id,
            action_type="call_transfer",
            action_name="Sandbox Transfer",
            arguments={"transfer_number": "+919848011111"},
            is_sandbox=True,
        )
        assert sbx_res["status"] == "simulated"
    finally:
        conn.execute("DELETE FROM call_actions WHERE call_id = ?", (live_call_id,))
        conn.execute("DELETE FROM calls WHERE id = ?", (live_call_id,))
        conn.commit()
        conn.close()


def test_admin_overview_exposes_emergency_kill_switch_state(client, demo_auth_headers):
    conn = get_connection()
    sa_user_id = f"usr_sa_{uuid.uuid4().hex[:8]}"
    sa_email = f"sa_{uuid.uuid4().hex[:6]}@trivaana.ai"
    now = datetime.now(timezone.utc).isoformat()
    sa_headers = None
    try:
        tenant_row = conn.execute("SELECT id FROM tenants WHERE id = 'tenant_demo_enterprise'").fetchone() or conn.execute("SELECT id FROM tenants LIMIT 1").fetchone()
        conn.execute(
            """
            INSERT INTO users (id, tenant_id, email, hashed_password, role, full_name, email_verified, is_super_admin, status, token_version, created_at)
            VALUES (?, ?, ?, 'x', 'owner', 'Platform SA', 1, 1, 'active', 1, ?)
            """,
            (sa_user_id, tenant_row["id"], sa_email, now),
        )
        conn.commit()
        from core.security import create_access_token
        sa_headers = {
            "Authorization": f"Bearer {create_access_token({'sub': sa_user_id, 'tenant_id': tenant_row['id'], 'role': 'owner', 'email': sa_email, 'token_version': 1})}"
        }

        pause_resp = client.post(
            "/api/admin/emergency/kill-switch",
            headers=sa_headers,
            json={"outbound_paused": True, "reason": "Carrier maintenance window"},
        )
        assert pause_resp.status_code == 200

        ov_resp = client.get("/api/admin/overview", headers=sa_headers)
        assert ov_resp.status_code == 200
        ov = ov_resp.json()
        assert ov["emergency_outbound_paused"] is True
        assert ov["emergency_pause_reason"] == "Carrier maintenance window"
    finally:
        if sa_headers is not None:
            client.post(
                "/api/admin/emergency/kill-switch",
                headers=sa_headers,
                json={"outbound_paused": False, "reason": "Maintenance complete"},
            )
        conn.execute("DELETE FROM users WHERE id = ?", (sa_user_id,))
        conn.commit()
        conn.close()
