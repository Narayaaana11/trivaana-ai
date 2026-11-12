"""
TRIVAANA AI: Phase 3 Business Actions, Calendar Sync, Workflows & Agent Tool Calling Regression Tests
Covers:
1. Appointments API non-sandbox Google Calendar sync when workspace integration is connected.
2. Workflow graph traversal (`trigger_workflow_execution`): conditional branching (`yes`/`no`), skipping unchosen branches.
3. `ActionService.execute_action`: `custom_api` SSRF protection (via `safe_http_request`) and `call_transfer` TwiML/control_xml.
4. `AIPromptService.simulate_agent_turn` `ACTION_CALL:` marker parsing & `RealtimeVoicePipeline.run_turn` live tool dispatch.
5. Integrations `/api/integrations/{provider}/test` for `gemini`, `google_calendar`, `google_sheets`.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from main import app
from core.config import settings
from core.security import create_access_token
from core.vault import encrypt_config_json
from database import get_connection
from services.action_service import ActionService
from services.ai_prompt_service import AIPromptService
from voice_engine.pipeline import RealtimeVoicePipeline
from workers.workflows.temporal_worker import trigger_workflow_execution


def _get_demo_owner_headers():
    conn = get_connection()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE tenant_id = 'tenant_demo_enterprise' AND role = 'owner' LIMIT 1"
        ).fetchone()
        assert user is not None
        token = create_access_token(
            {"sub": user["id"], "tenant_id": user["tenant_id"], "role": user["role"]}
        )
        return {"Authorization": f"Bearer {token}"}, user["tenant_id"]
    finally:
        conn.close()


def test_appointment_non_sandbox_google_calendar_sync(monkeypatch):
    headers, tenant_id = _get_demo_owner_headers()
    conn = get_connection()
    posted_calls = []

    try:
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "DELETE FROM integrations WHERE tenant_id = ? AND provider_key = 'google_calendar'",
            (tenant_id,),
        )
        conn.execute(
            """INSERT INTO integrations
               (id, tenant_id, provider_key, display_name, category, status, config_json, permissions_json, created_at, updated_at)
               VALUES (?, ?, 'google_calendar', 'Google Calendar', 'calendar', 'connected', ?, '[]', ?, ?)""",
            (
                f"int_{uuid.uuid4().hex[:8]}",
                tenant_id,
                encrypt_config_json({"calendar_id": "primary", "access_token": "ya29.test_oauth_token"}),
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    class _MockResponse:
        status_code = 200
        text = '{"id": "gcal_evt_999", "htmlLink": "https://calendar.google.com/event?eid=999"}'

        def json(self):
            return {"id": "gcal_evt_999", "htmlLink": "https://calendar.google.com/event?eid=999"}

    def _mock_httpx_post(url, headers=None, json=None, timeout=10.0):
        posted_calls.append({"url": url, "headers": headers, "json": json})
        return _MockResponse()

    monkeypatch.setattr("httpx.post", _mock_httpx_post)

    client = TestClient(app)
    day_offset = 10 + (uuid.uuid4().int % 15)
    start_dt = datetime(2026, 12, day_offset, 11, 0, tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(minutes=45)
    resp = client.post(
        "/api/appointments",
        headers=headers,
        json={
            "contact_name": "Enterprise Prospect",
            "phone": "+919848055111",
            "title": "Enterprise Demo Sync",
            "scheduled_start": start_dt.isoformat(),
            "scheduled_end": end_dt.isoformat(),
            "timezone": "Asia/Kolkata",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "scheduled"
    assert data["appointment_id"].startswith("apt_")
    assert data["calendar_sync"]["status"] == "executed"
    assert data["calendar_sync"]["result"]["calendar_response"]["id"] == "gcal_evt_999"
    assert len(posted_calls) == 1
    assert "calendars/primary/events" in posted_calls[0]["url"]
    assert posted_calls[0]["headers"]["Authorization"] == "Bearer ya29.test_oauth_token"


def test_workflow_conditional_branching_yes_vs_no():
    conn = get_connection()
    try:
        tenant_id = "tenant_demo_enterprise"
        now = datetime.now(timezone.utc).isoformat()
        agent = conn.execute("SELECT id FROM agents WHERE tenant_id = ? LIMIT 1", (tenant_id,)).fetchone()
        assert agent is not None
        agent_id = agent["id"]

        wf_id = f"wf_{uuid.uuid4().hex[:8]}"
        graph = {
            "nodes": [
                {"id": "n1", "data": {"kind": "trigger", "label": "Lead Received"}},
                {"id": "n2", "data": {"kind": "condition", "label": "Interested?", "condition_field": "interested", "expected_value": True}},
                {"id": "n3", "data": {"kind": "notify", "label": "Notify Sales Team"}},
                {"id": "n4", "data": {"kind": "followup", "label": "Schedule Follow-Up", "delay_seconds": 600}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "target": "n2"},
                {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "yes", "label": "Yes"},
                {"id": "e3", "source": "n2", "target": "n4", "sourceHandle": "no", "label": "No"},
            ],
        }
        conn.execute(
            """INSERT INTO workflows (id, tenant_id, name, trigger_type, graph_json, is_active, created_at, updated_at)
               VALUES (?, ?, 'Branch Test Flow', 'lead_received', ?, 1, ?, ?)""",
            (wf_id, tenant_id, json.dumps(graph), now, now),
        )
        conn.commit()

        res_yes = trigger_workflow_execution(
            conn=conn,
            tenant_id=tenant_id,
            workflow_id=wf_id,
            trigger_event="lead_received",
            context={"interested": True, "lead_name": "Interested Lead", "phone": "+919800000001", "agent_id": agent_id, "is_sandbox": True},
        )
        yes_ids = [s["node_id"] for s in res_yes["steps"]]
        assert "n1" in yes_ids
        assert "n2" in yes_ids
        assert "n3" in yes_ids
        assert "n4" not in yes_ids

        res_no = trigger_workflow_execution(
            conn=conn,
            tenant_id=tenant_id,
            workflow_id=wf_id,
            trigger_event="lead_received",
            context={"interested": False, "lead_name": "Cold Lead", "phone": "+919800000002", "agent_id": agent_id, "is_sandbox": True},
        )
        no_ids = [s["node_id"] for s in res_no["steps"]]
        assert "n1" in no_ids
        assert "n2" in no_ids
        assert "n4" in no_ids
        assert "n3" not in no_ids
    finally:
        conn.close()


def test_action_service_custom_api_ssrf_and_call_transfer():
    conn = get_connection()
    try:
        tenant_id = "tenant_demo_enterprise"
        now = datetime.now(timezone.utc).isoformat()
        call_id = f"call_{uuid.uuid4().hex[:8]}"
        conn.execute(
            """INSERT INTO calls (id, tenant_id, contact_name, phone, direction, status, provider, provider_call_id, is_sandbox, created_at)
               VALUES (?, ?, 'Caller One', '+919848000001', 'outbound', 'in-progress', 'twilio', 'CA_TEST_999', 0, ?)""",
            (call_id, tenant_id, now),
        )
        conn.commit()

        ssrf_res = ActionService.execute_action(
            conn=conn,
            tenant_id=tenant_id,
            call_id=call_id,
            action_type="custom_api",
            action_name="Internal Metadata Probe",
            arguments={"url": "http://169.254.169.254/latest/meta-data/", "method": "GET"},
            is_sandbox=False,
        )
        assert ssrf_res["status"] == "failed"
        err_text = str(ssrf_res["result"].get("error") or "").lower()
        assert any(tok in err_text for tok in ("unsafe", "blocked", "private", "target", "loopback", "link"))

        transfer_res = ActionService.execute_action(
            conn=conn,
            tenant_id=tenant_id,
            call_id=call_id,
            action_type="call_transfer",
            action_name="Escalate to Specialist",
            arguments={"transfer_number": "+919848099111", "reason": "High-value booking"},
            is_sandbox=False,
        )
        # Unconfigured live carrier must never fake 'executed'
        assert transfer_res["status"] == "not_configured"

        # Sandbox transfer simulates cleanly and renders XML-escaped Dial target
        sim_transfer = ActionService.execute_action(
            conn=conn,
            tenant_id=tenant_id,
            call_id=call_id,
            action_type="call_transfer",
            action_name="Escalate to Specialist (Sandbox)",
            arguments={"transfer_number": "+919848099111", "reason": "High-value booking"},
            is_sandbox=True,
        )
        assert sim_transfer["status"] == "simulated"
        assert "<Dial>" in sim_transfer["result"]["control_xml"]
        assert "+919848099111" in sim_transfer["result"]["control_xml"]
    finally:
        conn.close()


def test_ai_prompt_action_call_parsing_and_pipeline_tool_dispatch(monkeypatch):
    conn = get_connection()
    try:
        tenant_id = "tenant_demo_enterprise"
        now = datetime.now(timezone.utc).isoformat()
        agent_id = f"agent_{uuid.uuid4().hex[:8]}"
        call_id = f"call_{uuid.uuid4().hex[:8]}"

        conn.execute(
            """INSERT INTO agents
               (id, tenant_id, name, vertical, language, provider, system_prompt, status, created_at, updated_at)
               VALUES (?, ?, 'Action Agent', 'Healthcare', 'en-IN', 'sarvam', 'Book appointments accurately.', 'active', ?, ?)""",
            (agent_id, tenant_id, now, now),
        )
        conn.execute(
            """INSERT INTO agent_actions
               (id, agent_id, tenant_id, name, action_type, description, config_json, is_enabled, created_at, updated_at)
               VALUES (?, ?, ?, 'Send Visit Confirmation', 'whatsapp_template', 'Send WhatsApp visit confirmation', '{}', 1, ?, ?)""",
            (f"act_{uuid.uuid4().hex[:8]}", agent_id, tenant_id, now, now),
        )
        conn.execute(
            """INSERT INTO calls (id, tenant_id, agent_id, contact_name, phone, direction, status, is_sandbox, created_at)
               VALUES (?, ?, ?, 'Patient One', '+919848077665', 'outbound', 'in-progress', 1, ?)""",
            (call_id, tenant_id, agent_id, now),
        )
        conn.commit()

        agent_row = dict(conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone())

        monkeypatch.setattr(settings, "GEMINI_API_KEY", "test_gemini_key_123")
        monkeypatch.setattr(
            "services.ai_prompt_service.LLMAdapter.complete",
            lambda **kwargs: {
                "provider": "gemini",
                "model": "gemini-2.5-flash",
                "text": (
                    "I have sent the confirmation to your WhatsApp.\n"
                    'ACTION_CALL: {"action_type": "whatsapp_template", "action_name": "Send Visit Confirmation", "arguments": {"to": "+919848077665", "template_name": "visit_confirmed"}}'
                ),
            },
        )

        turn = AIPromptService.simulate_agent_turn(
            conn=conn,
            tenant_id=tenant_id,
            agent=agent_row,
            user_message="Yes please confirm my visit",
            history=[],
        )
        assert "ACTION_CALL" not in turn["reply"]
        assert "confirmation" in turn["reply"].lower()
        assert len(turn["action_calls"]) == 1
        assert turn["action_calls"][0]["action_type"] == "whatsapp_template"

        res = RealtimeVoicePipeline.run_turn(
            conn=conn,
            tenant_id=tenant_id,
            agent=agent_row,
            user_text="Yes please confirm my visit",
            call_id=call_id,
            synthesize_audio=False,
        )
        assert "ACTION_CALL" not in res["reply_text"]
        assert len(res["action_events"]) == 1
        assert res["action_events"][0]["action_type"] == "whatsapp_template"
        assert res["action_events"][0]["status"] == "simulated"
    finally:
        conn.close()


def test_integrations_test_endpoint_supports_gemini_and_google_workspace(monkeypatch):
    headers, _ = _get_demo_owner_headers()
    client = TestClient(app)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test_gemini_key_123")

    res_gemini = client.post("/api/integrations/gemini/test", headers=headers)
    assert res_gemini.status_code == 200, res_gemini.text
    assert res_gemini.json()["status"] == "success"
    assert res_gemini.json()["configured"] is True

    res_gcal = client.post("/api/integrations/google_calendar/test", headers=headers)
    assert res_gcal.status_code == 200, res_gcal.text
    assert res_gcal.json()["provider_key"] == "google_calendar"

    res_gsheets = client.post("/api/integrations/google_sheets/test", headers=headers)
    assert res_gsheets.status_code == 200, res_gsheets.text
    assert res_gsheets.json()["provider_key"] == "google_sheets"
