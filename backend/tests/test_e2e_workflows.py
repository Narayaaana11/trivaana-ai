"""
TRIVAANA AI: Full End-to-End SaaS Customer Journey & Storage/Retry Tests
Covers Section 23 E2E Checklist:
Sign up -> Workspace -> AI Employee -> Prompt Gen -> Voice -> KB -> Test Agent ->
Contacts + CSV Import -> Bulk Campaign -> Retries -> Simulated Calls ->
Transcripts & Analysis -> Export -> Wallet Transactions & GST Invoices -> Storage Media.
"""

import io
import uuid


def test_full_saas_e2e_customer_journey(client):
    uid = uuid.uuid4().hex[:6]
    email = f"founder_{uid}@trivaana-test.in"

    # 1. Sign up & create isolated workspace
    reg = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "StrongPassword@2026",
            "full_name": "Anitha Rao",
            "organization_name": f"Aarav Realty {uid}",
        },
    )
    assert reg.status_code == 200
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify workspace & welcome credit
    ws = client.get("/api/workspaces/current", headers=headers)
    assert ws.status_code == 200
    assert ws.json()["wallet_balance_inr"] == 5000.0

    # 2. Generate AI prompt & create AI employee
    gen = client.post(
        "/api/agents/generate-prompt",
        headers=headers,
        json={
            "description": "Call real estate buyers, ask budget, location, and book site visits.",
            "employee_name": "Divya",
            "business_name": f"Aarav Realty {uid}",
            "industry": "Real Estate",
            "language": "te-IN",
        },
    )
    assert gen.status_code == 200
    cfg = gen.json()["config"]

    ag = client.post(
        "/api/agents",
        headers=headers,
        json={
            "name": "Divya Property Advisor",
            "vertical": "Real Estate",
            "language": "te-IN",
            "voice_id": "meera",
            "provider": "sarvam",
            "greeting_message": cfg["greeting"],
            "system_prompt": cfg["system_prompt"],
            "questions": cfg["question_sequence"],
            "extraction_schema": cfg["data_extraction_schema"],
            "status": "testing",
        },
    )
    assert ag.status_code == 200
    agent_id = ag.json()["agent_id"]

    # 3. Select & test voice
    voices = client.get("/api/voices?language=te-IN", headers=headers).json()["voices"]
    assert len(voices) >= 1
    v_test = client.post(f"/api/voices/{voices[0]['id']}/test", headers=headers)
    assert v_test.status_code == 200

    # 4. Add Knowledge Base (upload file & text) and test agent
    kb_file = io.BytesIO(b"Aarav Sky Villas in Kokapet start at Rs 2.4 Crore. Possession is Dec 2027.")
    kb_up = client.post(
        "/api/knowledge/documents/upload",
        headers=headers,
        files={"file": ("villas_brochure.txt", kb_file, "text/plain")},
        data={"agent_id": agent_id},
    )
    assert kb_up.status_code == 200
    assert kb_up.json()["storage_key"]

    media_resp = client.get(kb_up.json()["storage_url"], headers=headers)
    assert media_resp.status_code == 200
    assert b"Kokapet" in media_resp.content

    test_turn = client.post(
        f"/api/agents/{agent_id}/test-turn",
        headers=headers,
        json={"message": "What is the price in Kokapet?"},
    )
    assert test_turn.status_code == 200
    assert "2.4" in test_turn.json()["reply"] or len(test_turn.json()["kb_chunks_used"]) >= 1

    # 5. Create contact + import CSV
    c1 = client.post(
        "/api/leads",
        headers=headers,
        json={"name": "Ramesh Kumar", "phone": "+919848100001", "city": "Hyderabad"},
    )
    assert c1.status_code == 200

    csv_content = "name,phone,city\nSita Devi,+919848100002,Vizag\nInvalidRow,123,Hyd\n"
    csv_up = client.post(
        "/api/leads/upload",
        headers=headers,
        data={"consent_confirmed": "true"},
        files={"file": ("leads.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert csv_up.status_code == 200
    assert csv_up.json()["imported_count"] == 1
    assert csv_up.json()["rejected_count"] == 1

    # 6. Create & run simulated campaign
    cmp = client.post(
        "/api/campaigns",
        headers=headers,
        json={"name": "Kokapet VIP Launch", "agent_id": agent_id, "concurrency": 2, "retry_attempts": 1, "is_sandbox": True},
    )
    assert cmp.status_code == 200
    cmp_id = cmp.json()["campaign_id"]

    start = client.post(
        "/api/campaigns/start",
        headers=headers,
        json={"campaign_id": cmp_id, "concurrency": 2, "max_calls": 10, "bypass_trai": True, "is_sandbox": True},
    )
    assert start.status_code == 200
    assert start.json()["initial_dispatched"] == 2

    sim = client.post(f"/api/campaigns/{cmp_id}/simulate-progress", headers=headers)
    assert sim.status_code == 200
    assert sim.json()["completed_now"] == 2

    # Export campaign CSV
    exp = client.get(f"/api/campaigns/{cmp_id}/export", headers=headers)
    assert exp.status_code == 200
    assert "Contact Name" in exp.text

    # 7. Inspect calls, transcripts, exports & wallet transactions
    calls = client.get("/api/calls", headers=headers).json()["calls"]
    assert len(calls) >= 2
    call_id = calls[0]["id"]

    an = client.post(f"/api/calls/{call_id}/analyze", headers=headers)
    assert an.status_code == 200

    calls_csv = client.get("/api/calls/export", headers=headers)
    assert calls_csv.status_code == 200
    assert "Call ID" in calls_csv.text

    txs = client.get("/api/billing/transactions", headers=headers).json()["transactions"]
    assert len(txs) >= 2

    # 8. Upload audio for Voice Broadcast
    brc_up = client.post(
        "/api/broadcasts/upload-audio",
        headers=headers,
        files={"file": ("promo.mp3", io.BytesIO(b"\xff\xfb\x90\x00demo-audio"), "audio/mpeg")},
    )
    assert brc_up.status_code == 200
    assert brc_up.json()["url"].startswith("/api/media/") or brc_up.json()["storage_backend"] == "s3"

    # 9. Process due retries endpoint check
    ret = client.post(f"/api/campaigns/{cmp_id}/process-retries", headers=headers)
    assert ret.status_code == 200

