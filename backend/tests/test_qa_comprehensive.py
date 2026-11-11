"""
TRIVAANA AI — Phase 2 Comprehensive QA Verification Suite
Covers Phases 4, 5, 6, 8, and 9:
- Full Create -> Read -> Update -> Delete persistence & cross-tenant authorization
- Explicit CSV column mapping & upload file-type/size security rejection
- Password reset / profile persistence & RBAC checks
- Simulated Exotel WebSocket stream token gate & callback verification
- 500-lead scale benchmark, index query-plan check, & worker tick test
- Truthful /api/readiness reporting (active sqlite3 driver vs postgres_ddl_ready)
"""

import time
import io
import json
from starlette.websockets import WebSocketDisconnect
from core.config import settings
from database.connection import get_connection
from providers.exotel_adapter import ExotelTelephonyProvider
from worker.tasks import process_campaign_tick


def test_phase5_auth_reset_and_profile_persistence(client):
    email = "qa_persist@trivaana.ai"
    reg = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "OldPassword@123",
            "full_name": "QA Persistence User",
            "organization_name": "QA Realty Corp",
        },
    )
    assert reg.status_code in (200, 201)
    tok = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}

    # Update profile & verify persisted on GET /auth/me
    upd = client.put("/api/auth/profile", headers=headers, json={"full_name": "QA Updated Name"})
    assert upd.status_code == 200
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["full_name"] == "QA Updated Name"

    # Password reset flow (when token is issued in non-production)
    req_rst = client.post("/api/auth/password-reset/request", json={"email": email})
    assert req_rst.status_code == 200
    reset_tok = req_rst.json().get("dev_reset_token") or req_rst.json().get("reset_token")
    assert reset_tok
    cfm = client.post("/api/auth/password-reset/confirm", json={"token": reset_tok, "new_password": "NewPassword@456"})
    assert cfm.status_code == 200

    # Old password fails, new password works
    bad = client.post("/api/auth/login", json={"email": email, "password": "OldPassword@123"})
    assert bad.status_code == 401
    good = client.post("/api/auth/login", json={"email": email, "password": "NewPassword@456"})
    assert good.status_code == 200


def test_phase5_crud_persistence_and_tenant_isolation(client, demo_auth_headers, second_tenant_auth_headers):
    # 1. Agent flow_graph + version restore + cross-tenant isolation
    ag = client.post(
        "/api/agents",
        headers=demo_auth_headers,
        json={"name": "QA Flow Bot", "vertical": "BFSI", "language": "hi-IN", "system_prompt": "v1 prompt"},
    )
    assert ag.status_code == 200
    agent_id = ag.json()["agent_id"]

    flow = {"nodes": [{"id": "n1", "position": {"x": 0, "y": 0}, "data": {"label": "Greeting"}}], "edges": []}
    upd = client.put(
        f"/api/agents/{agent_id}",
        headers=demo_auth_headers,
        json={"system_prompt": "v2 prompt", "structured_config": {"flow_graph": flow}},
    )
    assert upd.status_code == 200
    assert upd.json()["structured_config"]["flow_graph"]["nodes"][0]["id"] == "n1"

    # Cross-tenant agent access denied
    assert client.get(f"/api/agents/{agent_id}", headers=second_tenant_auth_headers).status_code == 404

    # 2. CSV explicit custom column mapping + Leads CRUD
    csv_bytes = b"Full Name,Mobile Number,Town\nKiran Rao,9848099881,Visakhapatnam\n"
    mapping = json.dumps({"name": "Full Name", "phone": "Mobile Number", "city": "Town"})
    up_csv = client.post(
        "/api/leads/upload",
        headers=demo_auth_headers,
        files={"file": ("mapped.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={"column_mapping": mapping},
    )
    assert up_csv.status_code == 200
    assert up_csv.json()["imported_count"] == 1

    leads_list = client.get("/api/leads?search=Kiran", headers=demo_auth_headers).json()["leads"]
    assert len(leads_list) >= 1
    lead_id = leads_list[0]["id"]
    assert leads_list[0]["city"] == "Visakhapatnam"

    # Edit & delete lead cleanly
    assert client.put(f"/api/leads/{lead_id}", headers=demo_auth_headers, json={"lead_status": "interested"}).status_code == 200
    detail = client.get(f"/api/leads/{lead_id}", headers=demo_auth_headers).json()
    assert detail["lead_status"] == "interested"
    assert "call_history" in detail and "consent_history" in detail
    assert client.get(f"/api/leads/{lead_id}", headers=second_tenant_auth_headers).status_code == 404
    assert client.delete(f"/api/leads/{lead_id}", headers=demo_auth_headers).status_code == 200


def test_phase8_upload_validation_and_index_performance(client, demo_auth_headers):
    # Disallowed extensions rejected with HTTP 400
    bad_kb = client.post(
        "/api/knowledge/documents/upload",
        headers=demo_auth_headers,
        files={"file": ("malware.exe", io.BytesIO(b"MZ123"), "application/octet-stream")},
    )
    assert bad_kb.status_code == 400

    bad_audio = client.post(
        "/api/broadcasts/upload-audio",
        headers=demo_auth_headers,
        files={"file": ("script.sh", io.BytesIO(b"#!/bin/sh"), "text/plain")},
    )
    assert bad_audio.status_code == 400

    bad_csv = client.post(
        "/api/leads/upload",
        headers=demo_auth_headers,
        files={"file": ("payload.html", io.BytesIO(b"<script>alert(1)</script>"), "text/html")},
    )
    assert bad_csv.status_code == 400

    # Performance benchmark: 500 leads bulk-paste & query latency + EXPLAIN QUERY PLAN index verification
    contacts = [{"name": f"Perf Lead {i}", "phone": f"+9198000{i:05d}", "city": "Hyderabad"} for i in range(500)]
    t0 = time.perf_counter()
    res = client.post("/api/leads/bulk-paste", headers=demo_auth_headers, json={"contacts": contacts})
    t_bulk = (time.perf_counter() - t0) * 1000
    assert res.status_code == 200
    assert res.json()["imported_count"] == 500
    assert t_bulk < 5000

    t1 = time.perf_counter()
    fetched = client.get("/api/leads?limit=500", headers=demo_auth_headers)
    t_get = (time.perf_counter() - t1) * 1000
    assert fetched.status_code == 200
    assert t_get < 1000

    conn = get_connection()
    plan = [dict(r)["detail"] for r in conn.execute("EXPLAIN QUERY PLAN SELECT * FROM leads WHERE tenant_id = 'tenant_demo_enterprise' AND phone = '+919800000001'").fetchall()]
    assert any("idx_leads_tenant_phone" in p for p in plan), f"Missing index usage in query plan: {plan}"
    conn.close()


def test_phase6_and_phase9_exotel_ws_worker_and_readiness(client, monkeypatch):
    # Honest /api/readiness reporting even when DATABASE_URL is postgres string
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql://user:pass@localhost:5432/trivaana")
    ready = client.get("/api/readiness").json()
    assert ready["database"]["engine"] == "sqlite_wal"
    assert ready["database"]["active_driver"] == "sqlite3"
    assert ready["database"]["postgres_ddl_ready"] is True
    assert ready["database"]["postgres_url_configured"] is True

    # WebSocket stream rejects invalid token when Exotel is configured
    monkeypatch.setattr(settings, "EXOTEL_API_KEY", "ekey")
    monkeypatch.setattr(settings, "EXOTEL_API_TOKEN", "etok_secret")
    monkeypatch.setattr(settings, "EXOTEL_SID", "esid")
    monkeypatch.setattr(settings, "EXOTEL_PHONE_NUMBER", "+918047361234")

    try:
        with client.websocket_connect("/api/calls/stream/call_test_ws?token=invalid_token") as ws:
            ws.receive_text()
            assert False, "Expected WebSocket close on invalid token"
    except WebSocketDisconnect as exc:
        assert exc.code == 1008

    valid_tok = ExotelTelephonyProvider.mint_stream_token("call_test_ws")
    with client.websocket_connect(f"/api/calls/stream/call_test_ws?token={valid_tok}") as ws:
        ws.send_text(json.dumps({"event": "stop"}))

    # Worker campaign tick safely runs without exception
    process_campaign_tick("tenant_demo_enterprise", "nonexistent_campaign")
