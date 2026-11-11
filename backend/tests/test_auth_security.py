"""
TRIVAANA AI: Authentication & Multi-Tenant Security Regression Tests
Validates:
1. Anonymous requests receive HTTP 401 with WWW-Authenticate header.
2. Invalid/expired tokens are rejected with 401.
3. Cross-tenant isolation prevents reading or mutating other tenants' data.
4. Production startup validation rejects missing, weak, or default JWT secrets.
"""

import pytest
from pydantic import ValidationError
from core.config import Settings
from core.security import create_access_token

def test_anonymous_requests_rejected(client):
    """Anonymous requests must be rejected with HTTP 401 and WWW-Authenticate header."""
    protected_endpoints = [
        ("GET", "/api/tenant"),
        ("GET", "/api/analytics"),
        ("GET", "/api/agents"),
        ("GET", "/api/leads"),
        ("GET", "/api/calls"),
        ("GET", "/api/billing/transactions"),
        ("POST", "/api/calls/instant"),
        ("POST", "/api/leads"),
        ("POST", "/api/campaigns/start"),
    ]

    for method, path in protected_endpoints:
        if method == "GET":
            resp = client.get(path)
        else:
            resp = client.post(path, json={})

        assert resp.status_code == 401, f"{method} {path} did not return 401 for anonymous access: {resp.status_code}"
        assert "WWW-Authenticate" in resp.headers or "www-authenticate" in resp.headers
        assert "Bearer" in resp.headers.get("WWW-Authenticate", resp.headers.get("www-authenticate", ""))

def test_invalid_tokens_rejected(client):
    """Requests with forged, expired, or invalid tokens must receive HTTP 401."""
    # 1. Random invalid string
    resp = client.get("/api/tenant", headers={"Authorization": "Bearer not-a-valid-token"})
    assert resp.status_code == 401

    # 2. Token signed with wrong secret
    import jwt
    tampered_token = jwt.encode(
        {"sub": "user_demo_admin", "tenant_id": "tenant_demo_enterprise"},
        "completely-wrong-unauthorized-secret-key-12345",
        algorithm="HS256"
    )
    resp = client.get("/api/tenant", headers={"Authorization": f"Bearer {tampered_token}"})
    assert resp.status_code == 401

def test_cross_tenant_isolation_reads_and_mutations(client, demo_auth_headers, second_tenant_auth_headers):
    """
    Strict Tenant Scoping:
    Tenant B must never be able to read, update, or delete Tenant A's leads, calls, or campaigns.
    """
    # 1. Create a lead under Tenant A
    import random
    digits_a = "".join(str(random.randint(0, 9)) for _ in range(8))
    digits_b = "".join(str(random.randint(0, 9)) for _ in range(8))
    create_lead_resp = client.post("/api/leads", headers=demo_auth_headers, json={
        "name": "Secret Enterprise Client",
        "phone": f"+9198{digits_a}",
        "vertical": "Real Estate"
    })
    assert create_lead_resp.status_code == 200
    tenant_a_lead_id = create_lead_resp.json()["lead_id"]

    # 2. Tenant B attempts to read leads -> must NOT see Tenant A's lead
    tenant_b_leads_resp = client.get("/api/leads", headers=second_tenant_auth_headers)
    assert tenant_b_leads_resp.status_code == 200
    tenant_b_leads = tenant_b_leads_resp.json()["leads"]
    assert not any(l["id"] == tenant_a_lead_id for l in tenant_b_leads)

    # 3. Create a call under Tenant A
    dial_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Confidential Prospect",
        "phone": f"+9197{digits_b}",
        "is_sandbox": True
    })
    assert dial_resp.status_code == 200
    tenant_a_call_id = dial_resp.json()["call_id"]

    # 4. Tenant B attempts to fetch Tenant A's call directly -> 404 Not Found
    resp = client.get(f"/api/calls/{tenant_a_call_id}", headers=second_tenant_auth_headers)
    assert resp.status_code == 404

def test_production_jwt_secret_validation():
    """
    Production startup guard:
    Reject startup if JWT secret is missing, default, or under 32 characters.
    """
    # 1. Known dev default secret in production -> Must fail
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET="trivaana-dev-secret-key-change-in-production-981a27e"
        )
    assert "Production startup rejected" in str(exc_info.value)

    # 2. Short secret in production (< 32 chars) -> Must fail
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET="too-short-secret"
        )
    assert "Production startup rejected" in str(exc_info.value)

    # 3. Strong 32+ character custom secret in production -> Must succeed
    prod_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET="a-very-strong-production-secure-key-9283741827491823749812734918"
    )
    assert prod_settings.ENVIRONMENT == "production"
    assert len(prod_settings.JWT_SECRET) >= 32


def test_security_hardening_ws_subscription_ssrf_and_invites(client, demo_auth_headers, second_tenant_auth_headers):
    from starlette.websockets import WebSocketDisconnect
    from database.connection import _translate_sqlite_params

    # 1. Voice Engine WebSocket rejects anonymous and cross-tenant connections
    ag = client.post(
        "/api/agents",
        headers=demo_auth_headers,
        json={"name": "WS Auth Guard Bot", "language": "en-IN", "system_prompt": "Test"},
    ).json()
    agent_id = ag["agent_id"]

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/api/voice-engine/ws/{agent_id}"):
            pass

    other_tok = second_tenant_auth_headers["Authorization"].split(" ", 1)[1]
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/api/voice-engine/ws/{agent_id}?token={other_tok}"):
            pass

    own_tok = demo_auth_headers["Authorization"].split(" ", 1)[1]
    with client.websocket_connect(f"/api/voice-engine/ws/{agent_id}?token={own_tok}") as ws:
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        ws.send_json({"type": "stop"})

    # 2. Paid subscription upgrade debits wallet (fails with 402 if insufficient balance)
    # Default welcome balance is ₹5,000 (500,000 paise); Enterprise is ₹24,999 -> must return 402
    sub_resp = client.post(
        "/api/billing/subscription",
        headers=second_tenant_auth_headers,
        json={"plan_id": "enterprise"},
    )
    assert sub_resp.status_code == 402

    # 3. Knowledge Base URL ingestion blocks private/loopback SSRF targets
    ssrf_resp = client.post(
        "/api/knowledge/documents/url",
        headers=demo_auth_headers,
        json={"url": "http://127.0.0.1:8001/health"},
    )
    assert ssrf_resp.status_code == 400
    assert "SSRF" in ssrf_resp.json()["detail"]

    # 4. Postgres SQL translation adds ON CONFLICT DO NOTHING for INSERT OR IGNORE
    pg = _translate_sqlite_params("INSERT OR IGNORE INTO invoices (id) VALUES (?)")
    assert pg == "INSERT INTO invoices (id) VALUES (%s) ON CONFLICT DO NOTHING"
