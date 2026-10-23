"""
TRIVAANA AI: Leads & CSV Upload Validation Tests
"""

import io

def test_create_lead_normalizes_phone(client, demo_auth_headers):
    resp = client.post("/api/leads", headers=demo_auth_headers, json={
        "name": "Kiran Varma",
        "phone": "9876599991",  # 10 digits without prefix
        "city": "Hyderabad",
        "vertical": "Real Estate"
    })
    assert resp.status_code == 200
    lead = resp.json()["lead"]
    assert lead["phone"] == "+919876599991"
    assert lead["name"] == "Kiran Varma"

def test_csv_upload_validation(client, demo_auth_headers):
    csv_content = """name,phone,city,vertical
Ravi Teja,+919123456789,Hyderabad,Real Estate
Invalid Phone User,,Vijayawada,Automotive
Priya Sharma,9876501234,Bengaluru,Healthcare
"""
    file_bytes = csv_content.encode("utf-8")
    files = {"file": ("leads_test.csv", io.BytesIO(file_bytes), "text/csv")}

    resp = client.post("/api/leads/upload", headers=demo_auth_headers, files=files)
    assert resp.status_code == 200
    data = resp.json()

    assert data["success"] is True
    assert data["imported_count"] == 2
    assert data["failed_count"] == 1
    assert len(data["errors"]) == 1
    assert "Invalid Phone User" in data["errors"][0]["reason"] or "Phone number is empty" in data["errors"][0]["reason"]

def test_lead_opt_out_suppression(client, demo_auth_headers):
    # 1. Create lead
    create_resp = client.post("/api/leads", headers=demo_auth_headers, json={
        "name": "Opt Out Test User",
        "phone": "+919988776655",
        "city": "Hyderabad",
        "vertical": "Insurance"
    })
    assert create_resp.status_code == 200
    lead_id = create_resp.json()["lead"]["id"]

    # 2. Trigger opt-out
    opt_resp = client.post(f"/api/leads/{lead_id}/opt-out", headers=demo_auth_headers)
    assert opt_resp.status_code == 200
    assert opt_resp.json()["status"] == "opted_out"

    # 3. Verify lead is marked opt_out = 1
    list_resp = client.get("/api/leads", headers=demo_auth_headers)
    matching = [l for l in list_resp.json()["leads"] if l["id"] == lead_id]
    assert len(matching) == 1
    assert matching[0]["opt_out"] == 1
