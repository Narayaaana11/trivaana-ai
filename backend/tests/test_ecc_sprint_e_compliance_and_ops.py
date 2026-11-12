"""
ECC Sprint E TDD Tests:
1. Indian Telecom DLT PE/TM & Template Registry + Staff Review Queue + Promotional Enforcement
2. Auditable NCPR / DND Scrubbing Engine (live API hook + local registry fallback)
3. Production Deployment Preflight Checker (/api/admin/preflight)
"""

from database.connection import get_connection
from services.compliance_service import ComplianceService


def test_dlt_registration_staff_review_and_promotional_enforcement(client, demo_auth_headers):
    # Enable promotional calls + strict DLT check on workspace policy
    res_pol = client.put(
        "/api/compliance/policy",
        json={"allow_promotional_calls": True, "require_dlt_for_promotional": True},
        headers=demo_auth_headers,
    )
    assert res_pol.status_code == 200
    assert res_pol.json()["policy"]["require_dlt_for_promotional"] == 1

    # Before DLT approval, promotional pre-call check should fail closed
    conn = get_connection()
    try:
        pre_before = ComplianceService.evaluate_pre_call(
            conn,
            tenant_id="tenant_demo_enterprise",
            phone="+919848011223",
            call_category="promotional",
            bypass_calling_hours=True,
            is_sandbox=False,
        )
    finally:
        conn.close()
    assert pre_before["allowed"] is False
    assert pre_before["code"] == "DLT_NOT_APPROVED"

    # Tenant registers Principal Entity (PE) + Telemarketer (TM) + Header + Template
    res_reg = client.post(
        "/api/compliance/dlt",
        json={
            "entity_name": "Acme Realty Pvt Ltd",
            "pe_id": "1101999888777666",
            "tm_id": "1702111222333444",
            "header_id": "ACMERL",
            "template_id": "1107169000001234",
            "template_name": "Weekend Villa Invite",
            "template_content": "Hi {#var#}, book your weekend site visit at Acme Realty.",
            "call_category": "promotional",
        },
        headers=demo_auth_headers,
    )
    assert res_reg.status_code == 200
    dlt_id = res_reg.json()["registration"]["id"]
    assert res_reg.json()["registration"]["status"] == "pending_review"

    # Staff reviews DLT queue and approves
    res_q = client.get("/api/staff/dlt-queue", headers=demo_auth_headers)
    assert res_q.status_code == 200
    assert any(item["id"] == dlt_id for item in res_q.json()["dlt_items"])

    res_rev = client.post(
        f"/api/staff/dlt-queue/{dlt_id}/review",
        json={"status": "approved", "notes": "PE & header verified on TRAI DLT portal"},
        headers=demo_auth_headers,
    )
    assert res_rev.status_code == 200
    assert res_rev.json()["status"] == "approved"

    # Now promotional pre-call check passes DLT gate
    conn2 = get_connection()
    try:
        pre_after = ComplianceService.evaluate_pre_call(
            conn2,
            tenant_id="tenant_demo_enterprise",
            phone="+919848011223",
            call_category="promotional",
            bypass_calling_hours=True,
            is_sandbox=False,
        )
    finally:
        conn2.close()
    assert pre_after["allowed"] is True


def test_ncpr_scrub_engine_and_audit_log(client, demo_auth_headers):
    # Add one phone to workspace DNC first
    res_dnc = client.post(
        "/api/compliance/dnc",
        json={"phone": "+919848099900", "reason": "NCPR customer opt-out", "source": "manual"},
        headers=demo_auth_headers,
    )
    assert res_dnc.status_code == 200

    # Scrub batch of numbers
    res_scrub = client.post(
        "/api/compliance/ncpr/scrub",
        json={"phones": ["+919848099900", "+919848012340", "12345"]},
        headers=demo_auth_headers,
    )
    assert res_scrub.status_code == 200
    data = res_scrub.json()
    assert data["total_checked"] == 3
    assert data["blocked_count"] == 2  # 1 DNC + 1 invalid
    assert data["eligible_count"] == 1
    assert data["eligible_phones"] == ["+919848012340"]
    assert data["provider_mode"] in ("local_registry", "live_ncpr")

    # Scrub job is persisted in audit history
    res_jobs = client.get("/api/compliance/ncpr/jobs", headers=demo_auth_headers)
    assert res_jobs.status_code == 200
    assert len(res_jobs.json()["jobs"]) >= 1


def test_admin_production_preflight_endpoint(client, demo_auth_headers):
    res = client.get("/api/admin/preflight", headers=demo_auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert "ready_for_production" in body
    assert isinstance(body["ready_for_production"], bool)
    check_keys = {c["key"] for c in body["checks"]}
    assert {"jwt_secret", "database_url", "telephony_provider", "voice_provider", "legal_entity"}.issubset(check_keys)


def test_public_legal_metadata_and_env_example_completeness(client):
    res = client.get("/api/public/legal")
    assert res.status_code == 200
    legal = res.json()
    assert legal["company_legal_name"]
    assert "Digital Personal Data Protection Act, 2023" in legal["governing_acts"]
    assert "TRAI TCCCPR, 2018" in legal["governing_acts"]
    assert "@" in legal["grievance_officer_email"]

    from pathlib import Path
    env_example = (Path(__file__).resolve().parents[2] / ".env.example").read_text(encoding="utf-8")
    for required_var in (
        "GEMINI_API_KEY",
        "DEEPGRAM_API_KEY",
        "ENCRYPTION_MASTER_KEY",
        "TEMPORAL_ADDRESS",
        "NCPR_API_URL",
        "COMPANY_LEGAL_NAME",
        "COMPANY_ENTITY_STATUS",
        "COMPANY_GSTIN",
        "GRIEVANCE_OFFICER_EMAIL",
    ):
        assert f"{required_var}=" in env_example
