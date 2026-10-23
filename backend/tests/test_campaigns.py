"""
TRIVAANA AI: Batch Campaigns, TRAI Compliance & Kill Switch Tests
"""

from services.campaign_service import CampaignService

def test_campaign_creation_and_listing(client, demo_auth_headers):
    create_resp = client.post("/api/campaigns", headers=demo_auth_headers, json={
        "name": "Q4 Real Estate Hyderabad Launch",
        "concurrency": 10
    })
    assert create_resp.status_code == 200
    camp = create_resp.json()
    assert camp["name"] == "Q4 Real Estate Hyderabad Launch"
    assert camp["status"] == "idle"

    list_resp = client.get("/api/campaigns", headers=demo_auth_headers)
    assert list_resp.status_code == 200
    camps = list_resp.json()["campaigns"]
    assert any(c["id"] == camp["campaign_id"] for c in camps)

def test_trai_compliance_window_and_bypass(client, demo_auth_headers):
    is_in_window = CampaignService.is_within_trai_window()

    # Create campaign
    camp = client.post("/api/campaigns", headers=demo_auth_headers, json={
        "name": "TRAI Test Campaign",
        "concurrency": 2
    }).json()
    camp_id = camp["campaign_id"]

    if not is_in_window:
        # Starting without bypass outside window MUST fail
        fail_resp = client.post("/api/campaigns/start", headers=demo_auth_headers, json={
            "campaign_id": camp_id,
            "concurrency": 2,
            "max_calls": 5,
            "bypass_trai": False
        })
        assert fail_resp.status_code == 400
        assert "TRAI" in fail_resp.json()["detail"]

    # Starting with bypass_trai=True MUST succeed regardless of time of day
    succ_resp = client.post("/api/campaigns/start", headers=demo_auth_headers, json={
        "campaign_id": camp_id,
        "concurrency": 2,
        "max_calls": 5,
        "bypass_trai": True
    })
    assert succ_resp.status_code == 200
    data = succ_resp.json()
    assert data["status"] in ("campaign_running", "idle")

def test_emergency_kill_switch(client, demo_auth_headers):
    # Launch campaign with bypass_trai
    camp = client.post("/api/campaigns", headers=demo_auth_headers, json={
        "name": "Kill Switch Target Campaign",
        "concurrency": 5
    }).json()
    camp_id = camp["campaign_id"]

    client.post("/api/campaigns/start", headers=demo_auth_headers, json={
        "campaign_id": camp_id,
        "concurrency": 5,
        "max_calls": 10,
        "bypass_trai": True
    })

    # Activate emergency kill switch
    kill_resp = client.post("/api/campaigns/kill", headers=demo_auth_headers, json={
        "campaign_id": camp_id
    })
    assert kill_resp.status_code == 200
    kill_data = kill_resp.json()
    assert kill_data["status"] == "halted"
    assert "Kill switch successfully executed" in kill_data["message"]

    # Verify campaign status is halted
    list_resp = client.get("/api/campaigns", headers=demo_auth_headers)
    target = next((c for c in list_resp.json()["campaigns"] if c["id"] == camp_id), None)
    assert target is not None
    assert target["status"] == "halted"
