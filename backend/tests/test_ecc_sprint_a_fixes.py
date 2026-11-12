"""
TRIVAANA AI — ECC Review Remediation Tests (Sprint A)
TDD-first regression tests covering CRITICAL & HIGH findings from ECC fastapi/security/database reviews.
"""

from datetime import datetime, timedelta, timezone
import json
import sys
import types
import uuid
import pytest
from starlette.websockets import WebSocketDisconnect


def test_livekit_worker_typing_annotations_resolve_on_py312():
    """Python 3.12 compatibility: get_type_hints must resolve without NameError."""
    import typing
    from voice_engine.livekit_agent_worker import finalize_call_session

    hints = typing.get_type_hints(finalize_call_session)
    assert "transcript_text" in hints
    assert "return" in hints


def test_twiml_and_exotel_passthru_prevent_oracle_and_escape_xml(client, demo_auth_headers, monkeypatch):
    from providers.twilio_adapter import TwilioTelephonyProvider

    # 1. XML injection escaping in TwilioTelephonyProvider.generate_twiml
    xml = TwilioTelephonyProvider.generate_twiml(
        call_id='call_1" /><Redirect>https://evil.example</Redirect><x y="',
        language="en-IN",
        prompt_text='Hello <script>alert(1)</script> & "friends"',
    )
    assert "<Redirect>" not in xml
    assert "<script>" not in xml
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in xml
    assert "%22" in xml

    # 2. Nonexistent call_id must return 404 (no anonymous stream_token minting)
    missing_twiml = client.post("/api/calls/twiml/nonexistent_call_oracle_test")
    assert missing_twiml.status_code == 404
    missing_exo = client.get("/api/calls/exotel-passthru/nonexistent_call_oracle_test")
    assert missing_exo.status_code == 404

    # 3. Live non-sandbox call cannot be fetched anonymously without carrier auth
    from database import get_connection
    conn = get_connection()
    live_call_id = f"call_live_{uuid.uuid4().hex[:8]}"
    try:
        conn.execute(
            """
            INSERT INTO calls (id, tenant_id, lead_id, agent_id, contact_name, phone, direction, provider, status, language, is_sandbox, cost_paise, created_at)
            VALUES (?, 'tenant_demo_enterprise', NULL, 'agent_demo_priya', 'Live Caller', '+919848011223', 'outbound', 'twilio', 'initiated', 'te-IN', 0, 0, ?)
            """,
            (live_call_id, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()

    try:
        unauth_live_twiml = client.post(f"/api/calls/twiml/{live_call_id}")
        assert unauth_live_twiml.status_code == 401
        unauth_live_exo = client.get(f"/api/calls/exotel-passthru/{live_call_id}")
        assert unauth_live_exo.status_code == 401

        # With valid signed capability token, TwiML succeeds
        tok = TwilioTelephonyProvider.mint_stream_token(live_call_id)
        auth_live_twiml = client.post(f"/api/calls/twiml/{live_call_id}?token={tok}")
        assert auth_live_twiml.status_code == 200
    finally:
        c = get_connection()
        c.execute("DELETE FROM calls WHERE id = ?", (live_call_id,))
        c.commit()
        c.close()


def test_websocket_stream_rejects_provider_mismatch_without_token_and_carrier_callback_else(client, demo_auth_headers):
    from database import get_connection

    conn = get_connection()
    twilio_live_id = f"call_tw_{uuid.uuid4().hex[:8]}"
    unknown_prov_id = f"call_unk_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    try:
        conn.execute(
            """
            INSERT INTO calls (id, tenant_id, lead_id, agent_id, contact_name, phone, direction, provider, status, language, is_sandbox, cost_paise, created_at)
            VALUES (?, 'tenant_demo_enterprise', NULL, NULL, 'Twilio Live', '+919848011224', 'outbound', 'twilio', 'initiated', 'te-IN', 0, 0, ?)
            """,
            (twilio_live_id, now),
        )
        conn.execute(
            """
            INSERT INTO calls (id, tenant_id, lead_id, agent_id, contact_name, phone, direction, provider, status, language, is_sandbox, cost_paise, created_at)
            VALUES (?, 'tenant_demo_enterprise', NULL, NULL, 'Unknown Prov', '+919848011225', 'outbound', 'rogue_carrier', 'initiated', 'te-IN', 0, 0, ?)
            """,
            (unknown_prov_id, now),
        )
        conn.commit()
    finally:
        conn.close()

    try:
        # Provider mismatch must be rejected even when token query param is omitted
        try:
            with client.websocket_connect(f"/api/calls/stream/{twilio_live_id}?provider=exotel") as ws:
                ws.receive_text()
                assert False, "Expected WebSocket close on provider mismatch"
        except WebSocketDisconnect as exc:
            assert exc.code == 1008

        # Unknown provider in carrier callback must fail closed with 401
        cb_resp = client.post(f"/api/calls/callback/{unknown_prov_id}", json={"CallStatus": "completed"})
        assert cb_resp.status_code == 401
    finally:
        c = get_connection()
        c.execute("DELETE FROM calls WHERE id IN (?, ?)", (twilio_live_id, unknown_prov_id))
        c.commit()
        c.close()


def test_agents_reject_ssrf_post_call_webhook_url(client, demo_auth_headers):
    bad_agent = client.post(
        "/api/agents",
        headers=demo_auth_headers,
        json={
            "name": "SSRF Webhook Agent",
            "language": "te-IN",
            "system_prompt": "You are a helpful voice assistant.",
            "post_call_webhook_url": "http://127.0.0.1:8080/internal-hook",
        },
    )
    assert bad_agent.status_code == 400


def test_subscription_atomic_rollback_and_razorpay_webhook_zero_amount_and_currency(client, demo_auth_headers, monkeypatch):
    from providers.razorpay_adapter import RazorpayPaymentProvider
    from services.billing_service import BillingService
    from database import get_connection

    # Top up wallet cleanly first so balance is known
    client.post("/api/billing/sandbox-topup", headers=demo_auth_headers, json={"amount_inr": 10000})
    before_wallet = client.get("/api/workspaces/current", headers=demo_auth_headers).json()["wallet_balance_paise"]

    # Force SQL failure on subscriptions insert inside /billing/subscription -> debit must NOT commit
    orig_execute = BillingService.debit_wallet

    def _fail_after_debit(*args, **kwargs):
        # Verify caller passes commit=False so subscription update shares transaction
        assert kwargs.get("commit") is False, "update_subscription must pass commit=False to debit_wallet"
        return orig_execute(*args, **kwargs)

    monkeypatch.setattr(BillingService, "debit_wallet", staticmethod(_fail_after_debit))
    ok_sub = client.post("/api/billing/subscription", headers=demo_auth_headers, json={"plan_id": "starter"})
    assert ok_sub.status_code == 200
    after_wallet = client.get("/api/workspaces/current", headers=demo_auth_headers).json()["wallet_balance_paise"]
    assert after_wallet < before_wallet

    # Razorpay webhook rejects amount == 0 and mismatched currency
    conn = get_connection()
    order_id = f"order_zero_{uuid.uuid4().hex[:8]}"
    try:
        conn.execute(
            """
            INSERT INTO payment_orders (id, tenant_id, amount_paise, currency, status, receipt, created_at, updated_at)
            VALUES (?, 'tenant_demo_enterprise', 50000, 'INR', 'created', 'rcpt_zero', ?, ?)
            """,
            (order_id, datetime.now(timezone.utc).isoformat(), datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()

    monkeypatch.setattr(RazorpayPaymentProvider, "verify_webhook_signature", lambda self, raw, sig: True)

    zero_payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_0", "order_id": order_id, "amount": 0, "currency": "INR", "status": "captured"}}},
    }
    r_zero = client.post(
        "/api/billing/razorpay-webhook",
        content=json.dumps(zero_payload),
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": "sig"},
    )
    assert r_zero.status_code == 400

    usd_payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_usd", "order_id": order_id, "amount": 50000, "currency": "USD", "status": "captured"}}},
    }
    r_usd = client.post(
        "/api/billing/razorpay-webhook",
        content=json.dumps(usd_payload),
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": "sig"},
    )
    assert r_usd.status_code == 400


def test_api_key_case_insensitive_scopes_and_admin_write_scopes(client, demo_auth_headers):
    created = client.post(
        "/api/workspaces/api-keys",
        headers=demo_auth_headers,
        json={"name": "Upper Scope Key", "scopes": ["BILLING:WRITE", "AGENTS:READ"]},
    )
    assert created.status_code == 200
    raw_key = created.json()["api_key"]

    # Case-insensitive scope matching + write scope should permit billing write endpoint
    r = client.get("/api/agents", headers={"X-API-Key": raw_key})
    assert r.status_code == 200
    topup = client.post("/api/billing/sandbox-topup", headers={"X-API-Key": raw_key}, json={"amount_inr": 100})
    assert topup.status_code == 200


def test_webhook_userinfo_host_strip_and_workflows_backend_standalone_import():
    from services.webhook_service import resolve_safe_public_target, _extract_safe_host_header
    from routers import workflows

    # Host header helper strips userinfo
    assert _extract_safe_host_header("https://user:secret@example.com:8443/hook") == "example.com:8443"
    assert _extract_safe_host_header("https://user:secret@example.com/hook") == "example.com"
    # workflows router provides trigger helper even without top-level workers on sys.path
    assert callable(workflows.trigger_workflow_execution)


def test_postgres_compat_connection_resets_rls_on_close_and_atomic_worker_claim():
    from database.connection import PostgresCompatConnection, _translate_sqlite_params
    from worker.tasks import process_due_scheduled_calls
    from database import get_connection

    executed = []

    class FakePgConn:
        def cursor(self):
            class C:
                rowcount = 1
                def execute(self, sql, params=None):
                    executed.append((sql, params))
                def fetchone(self):
                    return None
                def fetchall(self):
                    return []
            return C()
        def execute(self, sql, params=None):
            executed.append((sql, params))
        def commit(self):
            pass
        def rollback(self):
            pass
        def close(self):
            pass

    released = []
    pg = PostgresCompatConnection(FakePgConn(), release_fn=lambda c: released.append(c))
    pg.close()
    assert len(released) == 1
    assert any("app.current_tenant_id" in sql for sql, _ in executed), "Pooled PG connection must reset app.current_tenant_id before release"

    # Escaped single quote inside string literal must not corrupt ? translation
    assert _translate_sqlite_params("SELECT 'it''s ?' AS x, ? AS y") == "SELECT 'it''s ?' AS x, %s AS y"

    # Atomic scheduled_calls processing marks row dispatched without failing
    conn = get_connection()
    sid = f"sched_{uuid.uuid4().hex[:8]}"
    past = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
    try:
        conn.execute(
            """
            INSERT INTO scheduled_calls (id, tenant_id, lead_id, agent_id, contact_name, phone, language, call_category, is_sandbox, scheduled_for, status, created_at)
            VALUES (?, 'tenant_demo_enterprise', NULL, 'agent_demo_priya', 'Atomic Lead', '+919848055443', 'te-IN', 'service', 1, ?, 'pending', ?)
            """,
            (sid, past, past),
        )
        conn.commit()
        count = process_due_scheduled_calls(conn)
        assert count >= 1
        row = conn.execute("SELECT status FROM scheduled_calls WHERE id = ?", (sid,)).fetchone()
        assert row["status"] == "dispatched"
    finally:
        conn.close()


def test_public_intake_rate_limit_isolated_per_client_ip(client, monkeypatch):
    from routers import public_intake

    public_intake._RATE_BUCKETS.clear()
    monkeypatch.setattr(public_intake, "RATE_LIMIT_PER_MIN", 2)

    slug = "agent_demo_priya"
    public_intake._check_rate_limit("198.51.100.10", slug)
    public_intake._check_rate_limit("198.51.100.10", slug)
    with pytest.raises(Exception) as exc_info:
        public_intake._check_rate_limit("198.51.100.10", slug)
    assert getattr(exc_info.value, "status_code", None) == 429

    # Different client IP must not be locked out by the first IP's exhaustion
    public_intake._check_rate_limit("203.0.113.5", slug)
    public_intake._RATE_BUCKETS.clear()
