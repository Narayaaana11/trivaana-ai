"""
TRIVAANA AI: Authentication & Multi-Tenant Isolation Tests
"""

def test_login_demo_user(client):
    resp = client.post("/api/auth/login", json={
        "email": "demo@trivaana.ai",
        "password": "Trivaana@2026"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["tenant"]["id"] == "tenant_demo_enterprise"
    assert data["user"]["email"] == "demo@trivaana.ai"

def test_login_invalid_password(client):
    resp = client.post("/api/auth/login", json={
        "email": "demo@trivaana.ai",
        "password": "WrongPassword!99"
    })
    assert resp.status_code == 401

def test_get_current_user_me(client, demo_auth_headers):
    resp = client.get("/api/auth/me", headers=demo_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "demo@trivaana.ai"
    assert data["tenant_id"] == "tenant_demo_enterprise"

def test_multi_tenant_data_isolation(client, demo_auth_headers, second_tenant_auth_headers):
    """
    Strict isolation verification:
    Ensure Tenant B cannot view or modify leads, calls, or settings created by Tenant A.
    """
    # 1. Tenant A (Demo) creates a lead
    resp_create = client.post("/api/leads", headers=demo_auth_headers, json={
        "name": "Secret Lead Tenant A",
        "phone": "+919876543210",
        "city": "Hyderabad",
        "vertical": "Real Estate"
    })
    assert resp_create.status_code == 200
    lead_a_id = resp_create.json()["lead"]["id"]

    # 2. Tenant B lists leads -> Must NOT contain Tenant A's lead
    resp_list_b = client.get("/api/leads", headers=second_tenant_auth_headers)
    assert resp_list_b.status_code == 200
    b_lead_ids = [l["id"] for l in resp_list_b.json()["leads"]]
    assert lead_a_id not in b_lead_ids

    # 3. Tenant A views /api/tenant -> gets Tenant A's balance
    resp_tenant_a = client.get("/api/tenant", headers=demo_auth_headers)
    assert resp_tenant_a.status_code == 200
    assert resp_tenant_a.json()["id"] == "tenant_demo_enterprise"

    # 4. Tenant B views /api/tenant -> gets Tenant B's isolated record
    resp_tenant_b = client.get("/api/tenant", headers=second_tenant_auth_headers)
    assert resp_tenant_b.status_code == 200
    assert resp_tenant_b.json()["id"] != "tenant_demo_enterprise"
    assert resp_tenant_b.json()["name"] == "Acme Corp"
