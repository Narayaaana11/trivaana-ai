"""
TRIVAANA AI — ECC Sprint B Feature Tests (TDD RED -> GREEN)
Covers POST /api/voice-engine/evaluate scorecard + standalone backend eval_service.
"""

from services import eval_service


def test_voice_engine_evaluate_endpoint_and_tenant_scoping(client, demo_auth_headers):
    # Shared eval_service must contain default multilingual & safety cases
    assert len(eval_service.DEFAULT_EVAL_CASES) >= 4

    agents_resp = client.get("/api/agents", headers=demo_auth_headers)
    assert agents_resp.status_code == 200
    agents = agents_resp.json()["agents"]
    assert len(agents) >= 1
    agent_id = agents[0]["id"]

    eval_resp = client.post(
        "/api/voice-engine/evaluate",
        headers=demo_auth_headers,
        json={"agent_id": agent_id, "min_pass_rate": 0.75},
    )
    assert eval_resp.status_code == 200
    body = eval_resp.json()
    assert body["agent_id"] == agent_id
    assert body["total"] >= 4
    assert 0 <= body["passed"] <= body["total"]
    assert isinstance(body["pass_rate"], float)
    assert isinstance(body["ready_for_publish"], bool)
    assert "p95_latency_ms" in body
    assert isinstance(body["results"], list)
    assert len(body["results"]) == body["total"]

    # Nonexistent or cross-tenant agent must return 404
    missing_resp = client.post(
        "/api/voice-engine/evaluate",
        headers=demo_auth_headers,
        json={"agent_id": "agent_does_not_exist"},
    )
    assert missing_resp.status_code == 404

