"""
TRIVAANA AI: Phase 4 Call Intelligence, Voice Engine Status/Benchmark, Staff & Admin Operations Tests
"""

import json
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from main import app
from core.config import settings
from core.security import create_access_token
from database import get_connection


def _headers_for_role(role: str):
    conn = get_connection()
    try:
        if role == "super_admin":
            user = conn.execute("SELECT * FROM users WHERE is_super_admin = 1 LIMIT 1").fetchone()
        else:
            user = conn.execute(
                "SELECT * FROM users WHERE tenant_id = 'tenant_demo_enterprise' AND role = ? AND COALESCE(is_super_admin, 0) = 0 LIMIT 1",
                (role,),
            ).fetchone()
        if not user:
            uid = f"usr_{uuid.uuid4().hex[:8]}"
            now = datetime.now(timezone.utc).isoformat()
            is_sa = 1 if role == "super_admin" else 0
            staff_role = "support" if role == "staff" else None
            db_role = "admin" if role == "super_admin" else role
            conn.execute(
                """INSERT INTO users (id, tenant_id, email, full_name, hashed_password, role, is_super_admin, staff_role, status, created_at)
                   VALUES (?, 'tenant_demo_enterprise', ?, 'Test Operator', 'hash', ?, ?, ?, 'active', ?)""",
                (uid, f"{role}_{uuid.uuid4().hex[:6]}@trivaana.ai", db_role, is_sa, staff_role, now),
            )
            conn.commit()
            user = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
        token = create_access_token(
            {"sub": user["id"], "tenant_id": user["tenant_id"], "role": user["role"]}
        )
        return {"Authorization": f"Bearer {token}"}, user["tenant_id"]
    finally:
        conn.close()


def test_call_analyze_uses_llm_adapter_and_gemini(monkeypatch):
    headers, tenant_id = _headers_for_role("owner")
    conn = get_connection()
    call_id = f"call_{uuid.uuid4().hex[:8]}"
    try:
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """INSERT INTO calls (id, tenant_id, contact_name, phone, direction, status, language, is_sandbox, created_at)
               VALUES (?, ?, 'Meera Rao', '+919848022111', 'outbound', 'completed', 'te-IN', 1, ?)""",
            (call_id, tenant_id, now),
        )
        conn.execute(
            """INSERT INTO call_transcripts (id, call_id, tenant_id, speaker, message, timestamp_ms, created_at)
               VALUES (?, ?, ?, 'caller', 'Yes I am interested in Saturday 11am visit.', 1000, ?)""",
            (f"tr_{uuid.uuid4().hex[:8]}", call_id, tenant_id, now),
        )
        conn.commit()
    finally:
        conn.close()

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test_gemini_key")
    monkeypatch.setattr(
        "providers.llm_adapter.LLMAdapter.complete",
        lambda **kwargs: {
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "text": json.dumps({
                "summary": "Caller requested Saturday 11 AM site visit.",
                "sentiment": "positive",
                "outcome": "Demo Booked",
                "qualification_score": 92,
                "extracted_fields": {"visit_slot": "Saturday 11 AM"},
                "next_action": "Send calendar invite",
            }),
        },
    )

    client = TestClient(app)
    res = client.post(f"/api/calls/{call_id}/analyze", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["mode"] == "gemini"
    assert body["sentiment"] == "positive"
    assert body["outcome"] == "Demo Booked"
    assert body["extracted_data"]["visit_slot"] == "Saturday 11 AM"


def test_voice_engine_status_and_gemini_benchmark(monkeypatch):
    headers, _ = _headers_for_role("owner")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test_gemini_key")
    monkeypatch.setattr(settings, "DEEPGRAM_API_KEY", "test_dg_key")
    monkeypatch.setattr(
        "services.ai_prompt_service.LLMAdapter.complete",
        lambda **kwargs: {"provider": "gemini", "model": "gemini-2.5-flash", "text": "Plans start at Rs 6.50/min."},
    )

    client = TestClient(app)
    status_res = client.get("/api/voice-engine/status", headers=headers)
    assert status_res.status_code == 200
    s = status_res.json()
    assert s["llm_providers"]["gemini"] is True
    assert s["stt_providers"]["deepgram"] is True

    bench_res = client.post("/api/voice-engine/benchmark", headers=headers)
    assert bench_res.status_code == 200, bench_res.text
    b = bench_res.json()
    assert b["reasoning_mode"] == "gemini"
    assert b["is_live_provider"] is True


def test_staff_kyc_and_ticket_validation_and_admin_finance():
    owner_headers, tenant_id = _headers_for_role("owner")
    staff_headers, _ = _headers_for_role("super_admin")
    client = TestClient(app)

    conn = get_connection()
    num_id = f"num_{uuid.uuid4().hex[:8]}"
    tkt_id = f"tkt_{uuid.uuid4().hex[:8]}"
    try:
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """INSERT INTO phone_numbers (id, tenant_id, phone_number, provider, kyc_status, compliance_category, status, created_at)
               VALUES (?, ?, '+918047369999', 'exotel', 'pending_review', 'service_140_160', 'pending_kyc', ?)""",
            (num_id, tenant_id, now),
        )
        conn.execute(
            """INSERT INTO support_tickets (id, tenant_id, created_by_user_id, subject, description, category, priority, status, created_at, updated_at)
               VALUES (?, ?, 'usr_demo', 'KYC Help', 'Verify number', 'telephony', 'medium', 'open', ?, ?)""",
            (tkt_id, tenant_id, now, now),
        )
        conn.commit()
    finally:
        conn.close()

    # Non-staff blocked
    assert client.get("/api/staff/kyc-queue", headers=owner_headers).status_code in (401, 403)

    # Invalid KYC status rejected
    bad_kyc = client.post(
        f"/api/staff/kyc-queue/{num_id}/review",
        headers=staff_headers,
        json={"kyc_status": "unknown_state"},
    )
    assert bad_kyc.status_code == 400

    # Rejected KYC sets phone status to 'rejected' (not 'pending_kyc')
    rej_kyc = client.post(
        f"/api/staff/kyc-queue/{num_id}/review",
        headers=staff_headers,
        json={"kyc_status": "rejected", "notes": "Missing DLT entity doc"},
    )
    assert rej_kyc.status_code == 200
    conn = get_connection()
    try:
        row = conn.execute("SELECT kyc_status, status FROM phone_numbers WHERE id = ?", (num_id,)).fetchone()
        assert row["kyc_status"] == "rejected"
        assert row["status"] == "rejected"
    finally:
        conn.close()

    # Invalid ticket status rejected
    bad_tkt = client.patch(
        f"/api/staff/tickets/{tkt_id}",
        headers=staff_headers,
        json={"status": "bogus"},
    )
    assert bad_tkt.status_code == 400

    # Audited tenant summary exposes metrics without transcripts
    summary_res = client.get(f"/api/staff/tenants/{tenant_id}/summary", headers=staff_headers)
    assert summary_res.status_code == 200
    assert "transcript" not in json.dumps(summary_res.json()).lower()

    # Admin finance summary includes gross_margin_paise
    fin_res = client.get("/api/admin/finance/summary", headers=staff_headers)
    assert fin_res.status_code == 200
    fin = fin_res.json()
    assert "gross_margin_paise" in fin
    assert "wallet_liabilities_paise" in fin
