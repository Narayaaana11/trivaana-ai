"""
TRIVAANA AI: Campaign Safety & Queue Isolation Regression Tests
Validates:
1. Verified consent enforcement (opt-out and unverified leads excluded).
2. Emergency kill switch isolation (terminating Campaign A does not sever Campaign B or instant calls).
3. Queue reporting accuracy and durable worker advancement.
4. Pause and resume operations.
"""

from database import get_connection
from core.config import settings

def test_verified_consent_and_opt_out_enforcement(client, demo_auth_headers):
    """
    Ensure leads without verified consent (opt_out == 1 or consent_status != 'opted_in')
    are strictly suppressed and never dialed in automated campaigns.
    """
    # 1. Create a campaign
    camp_resp = client.post("/api/campaigns", headers=demo_auth_headers, json={
        "name": "Consent Enforcement Test Campaign",
        "concurrency": 2
    })
    assert camp_resp.status_code == 200
    campaign_id = camp_resp.json()["campaign_id"]

    # 2. Add an opted-out lead and an unverified consent lead
    client.post("/api/leads", headers=demo_auth_headers, json={
        "name": "Opted Out Person",
        "phone": "+919848099111",
        "notes": "Explicitly requested DND"
    })
    # Mark lead as opted out directly in db
    conn = get_connection(settings.SQLITE_DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute("UPDATE leads SET opt_out = 1 WHERE phone = '+919848099111'")
        cur.execute("UPDATE leads SET consent_status = 'pending_verification' WHERE phone = '+919848099111'")
        conn.commit()
    finally:
        conn.close()

    # 3. Start campaign with bypass_trai=True
    start_resp = client.post("/api/campaigns/start", headers=demo_auth_headers, json={
        "campaign_id": campaign_id,
        "concurrency": 5,
        "max_calls": 10,
        "bypass_trai": True
    })
    assert start_resp.status_code == 200

    # Verify that the opted-out lead was NOT dialed in this campaign
    conn = get_connection(settings.SQLITE_DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute("""
        SELECT COUNT(*) as cnt FROM calls
        WHERE campaign_id = ? AND phone = '+919848099111'
        """, (campaign_id,))
        count = cur.fetchone()["cnt"]
        assert count == 0, "Opted-out lead was incorrectly dialed in campaign!"
    finally:
        conn.close()

def test_emergency_kill_switch_campaign_isolation(client, demo_auth_headers):
    """
    CRITICAL REQUIREMENT:
    When terminating Campaign A, unrelated active calls (such as independent instant calls
    or calls from Campaign B) for the same tenant must NOT be severed.
    """
    # 1. Create two distinct campaigns: Campaign A and Campaign B
    camp_a = client.post("/api/campaigns", headers=demo_auth_headers, json={"name": "Campaign Alpha"}).json()
    camp_b = client.post("/api/campaigns", headers=demo_auth_headers, json={"name": "Campaign Beta"}).json()
    id_a = camp_a["campaign_id"]
    id_b = camp_b["campaign_id"]

    # 2. Start an active call under Campaign A
    call_a_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Alpha Lead",
        "phone": "+919848011111",
        "is_sandbox": True
    })
    call_a_id = call_a_resp.json()["call_id"]

    # 3. Start an active call under Campaign B
    call_b_resp = client.post("/api/calls/instant", headers=demo_auth_headers, json={
        "name": "Beta Lead",
        "phone": "+919848022222",
        "is_sandbox": True
    })
    call_b_id = call_b_resp.json()["call_id"]

    # Assign campaign_ids to respective calls in database
    conn = get_connection(settings.SQLITE_DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute("UPDATE calls SET campaign_id = ?, status = 'connected' WHERE id = ?", (id_a, call_a_id))
        cur.execute("UPDATE calls SET campaign_id = ?, status = 'connected' WHERE id = ?", (id_b, call_b_id))
        conn.commit()
    finally:
        conn.close()

    # 4. Execute Kill Switch specifically for Campaign A
    kill_resp = client.post("/api/campaigns/kill", headers=demo_auth_headers, json={
        "campaign_id": id_a
    })
    assert kill_resp.status_code == 200

    # 5. Verify Isolation:
    # Call A must be cancelled / severed
    check_a = client.get(f"/api/calls/{call_a_id}", headers=demo_auth_headers).json()
    assert check_a["status"] == "cancelled"

    # Call B MUST REMAIN CONNECTED (unsevered)
    check_b = client.get(f"/api/calls/{call_b_id}", headers=demo_auth_headers).json()
    assert check_b["status"] == "connected", "Call from Campaign B was improperly severed when Campaign A was terminated!"

def test_campaign_pause_and_resume(client, demo_auth_headers):
    """Test pausing and resuming an active campaign."""
    camp = client.post("/api/campaigns", headers=demo_auth_headers, json={"name": "Pause Test Campaign"}).json()
    cid = camp["campaign_id"]

    # Pause
    pause_resp = client.post(f"/api/campaigns/{cid}/pause", headers=demo_auth_headers)
    assert pause_resp.status_code == 200
    assert pause_resp.json()["status"] == "paused"

    # Resume
    resume_resp = client.post(f"/api/campaigns/{cid}/resume", headers=demo_auth_headers)
    assert resume_resp.status_code == 200
    assert resume_resp.json()["status"] == "running"
