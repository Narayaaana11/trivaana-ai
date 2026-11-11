"""
TRIVAANA AI: Comprehensive Platform Module & Acceptance Tests
Verifies AI Employee Builder, Prompt Engine, Voice Library, Real-Time Voice Engine,
4 Calling Modes, Knowledge Base RAG, Actions, Integrations, Webhooks, Phone Numbers,
Compliance, Workspaces/RBAC, Analytics, and Super Admin.
"""

import uuid


def test_ai_employee_builder_prompt_versioning_and_lifecycle(client, demo_auth_headers):
    # 1. Generate structured prompt from natural language
    gen_resp = client.post(
        "/api/agents/generate-prompt",
        headers=demo_auth_headers,
        json={
            "description": "Call real estate leads, ask about budget, location, timeline, and book a site visit.",
            "employee_name": "Kavya",
            "business_name": "Trivaana Estates",
            "industry": "Real Estate",
            "language": "en-IN",
        },
    )
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()
    assert gen_data["status"] == "success"
    assert "system_prompt" in gen_data["config"]
    assert len(gen_data["config"]["question_sequence"]) >= 3
    assert len(gen_data["config"]["data_extraction_schema"]) >= 3

    # 2. Create AI Employee with full builder fields
    create_resp = client.post(
        "/api/agents",
        headers=demo_auth_headers,
        json={
            "name": "Kavya Real Estate Advisor",
            "business_name": "Trivaana Estates",
            "vertical": "Real Estate",
            "designation": "Site Visit Specialist",
            "objective": "Qualify leads and schedule site visits",
            "call_direction": "both",
            "language": "en-IN",
            "voice_id": "alloy",
            "provider": "openai",
            "greeting_message": "Hello! This is Kavya from Trivaana Estates.",
            "system_prompt": gen_data["config"]["system_prompt"],
            "questions": gen_data["config"]["question_sequence"],
            "extraction_schema": gen_data["config"]["data_extraction_schema"],
            "never_say": ["Guaranteed returns"],
            "caller_memory_enabled": True,
            "status": "draft",
        },
    )
    assert create_resp.status_code == 200
    created = create_resp.json()
    agent_id = created["agent_id"]
    slug = created["slug"]
    intake_secret = created["intake_secret"]
    assert slug
    assert intake_secret.startswith("trv_lead_")

    # 3. Update prompt to create v2, list versions, restore v1
    upd = client.put(
        f"/api/agents/{agent_id}",
        headers=demo_auth_headers,
        json={"system_prompt": "Updated v2 prompt instructions", "change_note": "Refined tone"},
    )
    assert upd.status_code == 200
    assert upd.json()["current_version"] == 2

    vers = client.get(f"/api/agents/{agent_id}/prompt/versions", headers=demo_auth_headers).json()["versions"]
    assert len(vers) == 2
    v1_id = [v["id"] for v in vers if v["version_number"] == 1][0]

    rest = client.post(f"/api/agents/{agent_id}/prompt/restore/{v1_id}", headers=demo_auth_headers)
    assert rest.status_code == 200
    assert rest.json()["new_version"] == 3

    # 4. Lifecycle transitions: draft -> testing -> published -> active -> paused
    for target in ("testing", "published", "active", "paused", "active"):
        lc = client.post(f"/api/agents/{agent_id}/lifecycle", headers=demo_auth_headers, json={"status": target})
        assert lc.status_code == 200
        assert lc.json()["lifecycle_status"] == target

    # 5. Test grounded conversation turn
    turn = client.post(
        f"/api/agents/{agent_id}/test-turn",
        headers=demo_auth_headers,
        json={"message": "What is the price of 3BHK villas?", "history": []},
    )
    assert turn.status_code == 200
    assert "reply" in turn.json()


def test_voice_library_and_voice_engine_pipeline(client, demo_auth_headers):
    langs = client.get("/api/voices/languages").json()["languages"]
    codes = {l["code"] for l in langs}
    assert {"en-IN", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN", "mr-IN"}.issubset(codes)

    voices = client.get("/api/voices?language=te-IN", headers=demo_auth_headers).json()["voices"]
    assert len(voices) >= 1

    # Preview unconfigured voice truthfully returns sandbox_only
    prev = client.post(
        "/api/voices/preview",
        headers=demo_auth_headers,
        json={"provider": "sarvam", "voice_id": "meera", "language": "te-IN", "text": "Namaskaram"},
    )
    assert prev.status_code == 200
    assert prev.json()["status"] in ("sandbox_only", "synthesized")

    # Voice Engine status & benchmark
    ve = client.get("/api/voice-engine/status", headers=demo_auth_headers)
    assert ve.status_code == 200
    assert ve.json()["features"]["barge_in_interruption"] is True

    bench = client.post("/api/voice-engine/benchmark", headers=demo_auth_headers)
    assert bench.status_code == 200
    assert "stages" in bench.json()


def test_knowledge_base_rag_ingest_and_search(client, demo_auth_headers):
    ing = client.post(
        "/api/knowledge/documents/text",
        headers=demo_auth_headers,
        json={
            "title": "Hyderabad Clinic Pricing Policy",
            "source_type": "pricelist",
            "content": "Root canal treatment costs Rs 4500. Scaling and polishing is Rs 1200. Clinic hours are 9 AM to 8 PM Monday to Saturday.",
        },
    )
    assert ing.status_code == 200
    doc_id = ing.json()["document_id"]
    assert ing.json()["chunk_count"] >= 1

    search = client.post(
        "/api/knowledge/search",
        headers=demo_auth_headers,
        json={"query": "How much does root canal cost?"},
    )
    assert search.status_code == 200
    results = search.json()["results"]
    assert len(results) >= 1
    assert "4500" in results[0]["content"]

    reidx = client.post(f"/api/knowledge/documents/{doc_id}/reindex", headers=demo_auth_headers)
    assert reidx.status_code == 200

    delete_resp = client.delete(f"/api/knowledge/documents/{reidx.json()['document_id']}", headers=demo_auth_headers)
    assert delete_resp.status_code == 200


def test_public_lead_intake_and_compliance_gates(client, demo_auth_headers):
    # Create agent to get unique slug and secret
    ag = client.post(
        "/api/agents",
        headers=demo_auth_headers,
        json={"name": "Instant Intake Bot", "language": "en-IN", "system_prompt": "Test intake bot", "status": "active"},
    ).json()
    slug = ag["slug"]
    secret = ag["intake_secret"]

    # Unauthorized without secret
    unauth = client.post(f"/api/public/lead-intake/{slug}", json={"name": "Rahul", "phone": "+919876500111"})
    assert unauth.status_code == 401

    # Schema endpoint with secret
    schema = client.get(f"/api/public/lead-intake/{slug}/schema", headers={"X-Intake-Secret": secret})
    assert schema.status_code == 200

    # Without consent -> blocked before dialing!
    no_consent = client.post(
        f"/api/public/lead-intake/{slug}",
        headers={"X-Intake-Secret": secret},
        json={"name": "Rahul", "phone": "+919876500111", "consent_confirmed": False, "is_sandbox": True},
    )
    assert no_consent.status_code == 200
    assert no_consent.json()["call_initiated"] is False
    assert no_consent.json()["status"] == "blocked_consent_missing"

    # Valid intake -> initiates sandbox call
    ok = client.post(
        f"/api/public/lead-intake/{slug}",
        headers={"X-Intake-Secret": secret},
        json={"name": "Rahul", "phone": "+919876500112", "property": "2BHK", "budget": "90 Lakhs", "is_sandbox": True},
    )
    assert ok.status_code == 200
    assert ok.json()["call_initiated"] is True
    call_id = ok.json()["call_id"]

    # Public call status
    st = client.get(f"/api/public/calls/{call_id}/status", headers={"X-Intake-Secret": secret})
    assert st.status_code == 200
    assert st.json()["call_id"] == call_id


def test_inbound_broadcast_actions_integrations_and_admin(client, demo_auth_headers, second_tenant_auth_headers):
    # 1. Inbound simulation against seeded +918047361234
    inb = client.post(
        "/api/inbound/simulate",
        headers=demo_auth_headers,
        json={"to_number": "+918047361234", "from_number": "+919848012345", "initial_query": "3BHK Villa price"},
    )
    assert inb.status_code == 200
    assert inb.json()["is_sandbox"] is True
    call_id = inb.json()["call_id"]

    # 2. Post-call analysis & structured transcript
    an = client.post(f"/api/calls/{call_id}/analyze", headers=demo_auth_headers)
    assert an.status_code == 200
    trn = client.get(f"/api/calls/{call_id}/transcript", headers=demo_auth_headers)
    assert trn.status_code == 200
    assert len(trn.json()["messages"]) >= 1

    # 3. During-call action execution (Calendar + Caller Memory)
    act_cal = client.post(
        f"/api/calls/{call_id}/actions/execute",
        headers=demo_auth_headers,
        json={"action_type": "google_calendar", "action_name": "book_site_visit", "arguments": {"slot": "Sat 11 AM"}, "is_sandbox": True},
    )
    assert act_cal.status_code == 200
    assert act_cal.json()["status"] == "simulated"

    act_mem = client.post(
        f"/api/calls/{call_id}/actions/execute",
        headers=demo_auth_headers,
        json={"action_type": "caller_memory", "action_name": "save_pref", "arguments": {"phone": "+919848012345", "caller_name": "Venkat", "summary": "Prefers East-facing 3BHK"}},
    )
    assert act_mem.status_code == 200
    assert act_mem.json()["status"] == "executed"

    # 4. Voice Broadcast (separate module)
    brc = client.post(
        "/api/broadcasts",
        headers=demo_auth_headers,
        json={
            "name": "Diwali Announcement",
            "message_text": "Happy Diwali from Trivaana Estates!",
            "language": "en-IN",
            "is_sandbox": True,
            "recipients": [{"name": "Test User", "phone": "+919888877777"}],
        },
    )
    assert brc.status_code == 200
    bid = brc.json()["broadcast_id"]
    start_brc = client.post(f"/api/broadcasts/{bid}/start?is_sandbox=true", headers=demo_auth_headers)
    assert start_brc.status_code == 200
    assert start_brc.json()["processed_count"] == 1

    # 5. Integrations & Webhooks
    ints = client.get("/api/integrations", headers=demo_auth_headers).json()["integrations"]
    assert len(ints) >= 15

    wh = client.post(
        "/api/webhooks",
        headers=demo_auth_headers,
        json={"name": "CRM Sync", "url": "https://example.com/webhook", "events": ["call.completed"]},
    )
    assert wh.status_code == 200
    wh_id = wh.json()["webhook_id"]
    rot = client.post(f"/api/webhooks/{wh_id}/rotate-secret", headers=demo_auth_headers)
    assert rot.status_code == 200

    # 6. Analytics & Compliance
    stats = client.get("/api/analytics", headers=demo_auth_headers)
    assert stats.status_code == 200
    assert "daily_series" in stats.json()

    dnc = client.post("/api/compliance/dnc", headers=demo_auth_headers, json={"phone": "+919111122222", "reason": "Requested opt-out"})
    assert dnc.status_code == 200

    # 7. Super Admin RBAC check: regular second tenant must get 403, demo super admin gets 200
    non_admin = client.get("/api/admin/overview", headers=second_tenant_auth_headers)
    assert non_admin.status_code == 403

    admin_ok = client.get("/api/admin/overview", headers=demo_auth_headers)
    assert admin_ok.status_code == 200
    assert admin_ok.json()["workspaces"]["total"] >= 1

