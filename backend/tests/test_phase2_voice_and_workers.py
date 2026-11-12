"""
TRIVAANA AI: Phase 2 Voice Pipeline, Carrier Integration, Broadcast, Inbound & Worker Regression Tests
Covers:
1. Delayed intake DB queue (`scheduled_calls` + `process_due_scheduled_calls` via `run_worker_tick`).
2. `CampaignService.process_due_retries` (resolves `agent["language"]`, returns `dispatched` & `requeued_count`)
   and `advance_campaign_queue` (enforces concurrency limit and TRAI window on live campaigns).
3. `DeepgramSTT` & `FasterWhisperSTT` transcription and `get_stt_provider` selection.
4. `TelephonyStreamSession._build_outbound_frames` 20ms codec framing (`160` bytes mulaw, `320` bytes pcm16)
   + `RealtimeVoicePipeline.run_turn(..., telephony_audio=True)` for ElevenLabs (`pcm_8000`) & OpenAI (`pcm` downsampled).
5. `start_broadcast` TRAI window blocking & dispatch-gated debiting when live.
6. TwiML `<Connect><Stream>` + multi-turn conversational `<Gather>` in `handle_twiml_gather`
   and `ExotelTelephonyProvider.generate_passthru_response` signed `stream_url`.
7. Inbound `/api/inbound/plivo`, `/api/inbound/vobiz`, and after-hours `transfer` `<Dial>`.
8. Provider COGS recording (`provider_usage_costs`) and LiveKit `finalize_call_session`.
"""

import base64
from datetime import datetime, timedelta, timezone
import uuid
import pytest

from core.config import settings
from database import get_connection
from providers.base import CallDispatchResult
from providers.exotel_adapter import ExotelTelephonyProvider
from providers.twilio_adapter import TwilioTelephonyProvider
from services.call_service import CallService
from services.campaign_service import CampaignService
from services.compliance_service import ComplianceService
from voice_engine.livekit_agent_worker import finalize_call_session
from voice_engine.pipeline import RealtimeVoicePipeline
from voice_engine.stt_providers import DeepgramSTT, FasterWhisperSTT, get_stt_provider
from voice_engine.telephony_stream import TelephonyStreamSession
from worker.tasks import run_worker_tick, schedule_delayed_intake_call


def _get_demo_agent_and_lead(conn):
    tenant_id = "tenant_demo_enterprise"
    ag = conn.execute("SELECT id FROM agents WHERE tenant_id = ? LIMIT 1", (tenant_id,)).fetchone()
    ld = conn.execute("SELECT id FROM leads WHERE tenant_id = ? LIMIT 1", (tenant_id,)).fetchone()
    return tenant_id, (ag["id"] if ag else None), (ld["id"] if ld else None)


def test_scheduled_intake_db_queue_and_worker_tick():
    conn = get_connection()
    try:
        tenant_id, agent_id, lead_id = _get_demo_agent_and_lead(conn)
    finally:
        conn.close()

    res = schedule_delayed_intake_call(
        delay_seconds=5,
        tenant_id=tenant_id,
        lead_id=lead_id or "",
        contact_name="Scheduled Lead",
        phone="+919848099988",
        language="hi-IN",
        agent_id=agent_id,
        is_sandbox=True,
    )
    assert res["scheduled"] is True
    assert res["backend"] == "db_scheduler"
    sched_id = res["task_id"]

    conn = get_connection()
    try:
        past = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
        conn.execute("UPDATE scheduled_calls SET scheduled_for = ? WHERE id = ?", (past, sched_id))
        conn.commit()

        tick = run_worker_tick(conn)
        assert tick["delayed_dispatched"] >= 1

        row = conn.execute("SELECT status, call_id FROM scheduled_calls WHERE id = ?", (sched_id,)).fetchone()
        assert row["status"] == "dispatched"
        assert row["call_id"]
    finally:
        conn.close()


def test_campaign_retries_language_and_concurrency_trai_gating(monkeypatch):
    conn = get_connection()
    try:
        tenant_id = "tenant_demo_enterprise"
        now = datetime.now(timezone.utc).isoformat()
        agent_id = f"agent_{uuid.uuid4().hex[:8]}"
        cmp_id = f"cmp_{uuid.uuid4().hex[:8]}"
        lead1 = f"lead_{uuid.uuid4().hex[:8]}"
        lead2 = f"lead_{uuid.uuid4().hex[:8]}"
        job1 = f"job_{uuid.uuid4().hex[:8]}"
        job2 = f"job_{uuid.uuid4().hex[:8]}"

        conn.execute(
            "INSERT INTO agents (id, tenant_id, name, vertical, language, provider, system_prompt, status, created_at, updated_at) VALUES (?, ?, 'Hindi Agent', 'Real Estate', 'hi-IN', 'sarvam', 'Assist caller', 'active', ?, ?)",
            (agent_id, tenant_id, now, now),
        )
        for lid, phone in [(lead1, "+919811111111"), (lead2, "+919822222222")]:
            conn.execute(
                "INSERT INTO leads (id, tenant_id, name, phone, consent_status, opt_out, created_at) VALUES (?, ?, 'Test Lead', ?, 'opted_in', 0, ?)",
                (lid, tenant_id, phone, now),
            )
        conn.execute(
            "INSERT INTO campaigns (id, tenant_id, name, agent_id, status, concurrency, is_sandbox, created_at) VALUES (?, ?, 'Retry Cmp', ?, 'running', 1, 1, ?)",
            (cmp_id, tenant_id, agent_id, now),
        )
        conn.execute(
            "INSERT INTO campaign_jobs (id, campaign_id, tenant_id, lead_id, status, retry_count, max_retries, next_retry_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', 1, 2, ?, ?, ?)",
            (job1, cmp_id, tenant_id, lead1, (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(), now, now),
        )
        conn.commit()

        retry_res = CampaignService.process_due_retries(conn, tenant_id, cmp_id)
        assert retry_res["dispatched"] == 1
        assert retry_res["requeued_count"] == 1
        dispatched_call_id = conn.execute("SELECT call_id FROM campaign_jobs WHERE id = ?", (job1,)).fetchone()["call_id"]
        call_row = conn.execute("SELECT language FROM calls WHERE id = ?", (dispatched_call_id,)).fetchone()
        assert call_row["language"] == "hi-IN"

        # Add second pending job; concurrency=1 and job1 is 'calling' so advance_campaign_queue must hold
        conn.execute(
            "INSERT INTO campaign_jobs (id, campaign_id, tenant_id, lead_id, status, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', 0, 2, ?, ?)",
            (job2, cmp_id, tenant_id, lead2, now, now),
        )
        conn.commit()
        CampaignService.advance_campaign_queue(conn, tenant_id, cmp_id)
        assert conn.execute("SELECT status FROM campaign_jobs WHERE id = ?", (job2,)).fetchone()["status"] == "pending"

        # Outside TRAI hours blocks live (is_sandbox=0) queue advance even when slot opens
        conn.execute("UPDATE campaign_jobs SET status = 'completed' WHERE id = ?", (job1,))
        conn.execute("UPDATE campaigns SET is_sandbox = 0 WHERE id = ?", (cmp_id,))
        conn.commit()
        monkeypatch.setattr(ComplianceService, "is_within_calling_hours", staticmethod(lambda *a, **kw: False))
        CampaignService.advance_campaign_queue(conn, tenant_id, cmp_id)
        assert conn.execute("SELECT status FROM campaign_jobs WHERE id = ?", (job2,)).fetchone()["status"] == "pending"
    finally:
        conn.close()


def test_stt_providers_deepgram_and_faster_whisper(monkeypatch):
    monkeypatch.setattr(settings, "DEEPGRAM_API_KEY", "dg_test_key")
    stt = get_stt_provider()
    assert isinstance(stt, DeepgramSTT)

    class _FakeResp:
        status_code = 200
        def json(self):
            return {"results": {"channels": [{"alternatives": [{"transcript": "namaste site visit"}]}]}}

    monkeypatch.setattr("voice_engine.stt_providers.requests.post", lambda *a, **kw: _FakeResp())
    out = stt.transcribe(b"RIFF....", language="te-IN")
    assert out["text"] == "namaste site visit"
    assert out["provider"] == "deepgram"

    fw = FasterWhisperSTT()
    fw.endpoint = "http://localhost:8001"
    monkeypatch.setattr("voice_engine.stt_providers.requests.post", lambda *a, **kw: type("R", (), {"raise_for_status": lambda s: None, "json": lambda s: {"text": "local fw"}})())
    assert fw.transcribe(b"WAV", language="en-IN")["text"] == "local fw"


def test_telephony_20ms_codec_framing_and_pipeline_telephony_audio(monkeypatch):
    conn = get_connection()
    try:
        tenant_id, agent_id, _ = _get_demo_agent_and_lead(conn)
        pcm_40ms = b"\x01\x02" * 320
        tw_session = TelephonyStreamSession(conn=conn, call_id="call_frame_tw", provider="twilio")
        tw_frames = tw_session._build_outbound_frames(pcm_40ms)
        tw_media = [f for f in tw_frames if f["event"] == "media"]
        assert len(tw_media) == 2
        assert all(len(base64.b64decode(f["media"]["payload"])) == 160 for f in tw_media)
        assert tw_frames[-1]["event"] == "mark"

        ex_session = TelephonyStreamSession(conn=conn, call_id="call_frame_ex", provider="exotel")
        ex_frames = ex_session._build_outbound_frames(pcm_40ms)
        ex_media = [f for f in ex_frames if f["event"] == "media"]
        assert len(ex_media) == 2
        assert all(len(base64.b64decode(f["media"]["payload"])) == 320 for f in ex_media)

        captured = {}
        class _FakeOpenAITTS:
            is_configured = True
            def synthesize_speech(self, text, language="en-IN", voice_id="alloy", response_format="mp3"):
                captured["response_format"] = response_format
                return b"\x10\x20" * 300

        monkeypatch.setattr("voice_engine.pipeline.get_voice_provider", lambda name: _FakeOpenAITTS())
        res = RealtimeVoicePipeline.run_turn(
            conn=conn,
            tenant_id=tenant_id,
            agent={"id": agent_id or "agent_demo", "provider": "openai", "language": "en-IN", "voice_id": "alloy"},
            user_text="Tell me the price",
            synthesize_audio=True,
            telephony_audio=True,
        )
        assert captured["response_format"] == "pcm"
        assert len(base64.b64decode(res["audio_base64"])) == 200
    finally:
        conn.close()


def test_broadcast_live_trai_and_dispatch_gating(client, demo_auth_headers, monkeypatch):
    b_res = client.post(
        "/api/broadcasts",
        json={"name": "Live TRAI Broadcast", "message_text": "Open house Sunday"},
        headers=demo_auth_headers,
    )
    assert b_res.status_code == 200
    bid = b_res.json()["broadcast_id"]
    csv_file = ("rec.csv", b"name,phone\nRaju,+919848055566\n", "text/csv")
    assert client.post(f"/api/broadcasts/{bid}/recipients/csv", files={"file": csv_file}, headers=demo_auth_headers).status_code == 200

    monkeypatch.setattr(settings, "EXOTEL_API_KEY", "ex_k")
    monkeypatch.setattr(settings, "EXOTEL_API_TOKEN", "ex_t")
    monkeypatch.setattr(settings, "EXOTEL_SID", "ex_s")
    monkeypatch.setattr(settings, "EXOTEL_PHONE_NUMBER", "0401234567")
    monkeypatch.setattr(ComplianceService, "is_within_calling_hours", staticmethod(lambda *a, **kw: False))

    blocked = client.post(f"/api/broadcasts/{bid}/start", headers=demo_auth_headers)
    assert blocked.status_code == 400
    assert "TRAI" in blocked.json()["detail"]

    monkeypatch.setattr(ComplianceService, "is_within_calling_hours", staticmethod(lambda *a, **kw: True))
    class _FailTel:
        is_configured = True
        def initiate_call(self, **kwargs):
            return CallDispatchResult(success=False, provider="exotel", status="failed", error_message="carrier down")

    monkeypatch.setattr("routers.broadcasts.get_telephony_provider", lambda: _FailTel())
    res_fail = client.post(f"/api/broadcasts/{bid}/start", headers=demo_auth_headers)
    assert res_fail.status_code == 200
    body = res_fail.json()
    assert body["failed_count"] == 1
    assert body["total_cost_paise"] == 0


def test_twiml_connect_stream_conversational_gather_and_exotel_passthru(client, demo_auth_headers):
    twiml = TwilioTelephonyProvider.generate_twiml(call_id="call_tw_1", language="te-IN")
    assert "<Connect><Stream url=" in twiml
    assert "provider=twilio" in twiml

    passthru = ExotelTelephonyProvider.generate_passthru_response("call_ex_1", "te-IN")
    assert passthru["stream_url"].startswith("ws")
    assert "token=" in passthru["stream_url"]

    conn = get_connection()
    try:
        tenant_id, agent_id, _ = _get_demo_agent_and_lead(conn)
        call_id = f"call_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO calls (id, tenant_id, agent_id, contact_name, phone, provider, status, language, created_at) VALUES (?, ?, ?, 'Sita', '+919848011223', 'twilio', 'connected', 'te-IN', ?)",
            (call_id, tenant_id, agent_id, now),
        )
        conn.commit()
    finally:
        conn.close()

    resp = client.post(f"/api/calls/twiml-gather/{call_id}", data={"SpeechResult": "What is the 3BHK price?"})
    assert resp.status_code == 200
    assert "<Gather" in resp.text
    assert "<Hangup/>" in resp.text

    conn = get_connection()
    try:
        tr = conn.execute("SELECT transcript FROM calls WHERE id = ?", (call_id,)).fetchone()["transcript"]
        assert "User: What is the 3BHK price?" in tr
        assert "Agent:" in tr
    finally:
        conn.close()


def test_inbound_plivo_vobiz_and_after_hours_transfer(client, demo_auth_headers, monkeypatch):
    conn = get_connection()
    try:
        tenant_id, agent_id, _ = _get_demo_agent_and_lead(conn)
        num_id = f"num_{uuid.uuid4().hex[:8]}"
        phone = "+914099887766"
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO phone_numbers (id, tenant_id, phone_number, provider, status, assigned_agent_id, inbound_agent_id, after_hours_mode, business_hours_json, created_at)
            VALUES (?, ?, ?, 'plivo', 'active', ?, ?, 'transfer', '{"start":"09:00","end":"10:00","transfer_number":"+919900001122"}', ?)
            """,
            (num_id, tenant_id, phone, agent_id, agent_id, now),
        )
        conn.commit()
    finally:
        conn.close()

    monkeypatch.setattr(ComplianceService, "is_within_calling_hours", staticmethod(lambda *a, **kw: False))
    r_plivo = client.post("/api/inbound/plivo", data={"To": phone, "From": "+919848000001", "CallUUID": "plv_1"})
    assert r_plivo.status_code == 200
    assert "<Dial><Number>+919900001122</Number></Dial>" in r_plivo.text

    monkeypatch.setattr(ComplianceService, "is_within_calling_hours", staticmethod(lambda *a, **kw: True))
    r_vobiz = client.post("/api/inbound/vobiz", data={"To": phone, "From": "+919848000002", "CallUUID": "vbz_1"})
    assert r_vobiz.status_code == 200
    assert "provider=vobiz" in r_vobiz.text


def test_provider_cogs_and_livekit_finalize():
    conn = get_connection()
    try:
        tenant_id, agent_id, _ = _get_demo_agent_and_lead(conn)
        call_id = f"call_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO calls (id, tenant_id, agent_id, contact_name, phone, provider, status, is_sandbox, cost_paise, created_at) VALUES (?, ?, ?, 'COGS Caller', '+919848022334', 'exotel', 'in_progress', 0, 0, ?)",
            (call_id, tenant_id, agent_id, now),
        )
        conn.commit()

        from providers.base import CallStatusEvent
        CallService.process_call_event(
            conn,
            CallStatusEvent(provider="exotel", provider_call_id=call_id, status="completed", duration_seconds=60),
        )
        cogs_rows = conn.execute("SELECT category, estimated_cost_paise FROM provider_usage_costs WHERE call_id = ?", (call_id,)).fetchall()
        assert len(cogs_rows) == 2
        assert sum(r["estimated_cost_paise"] for r in cogs_rows) > 0

        lk_call = f"call_{uuid.uuid4().hex[:8]}"
        conn.execute(
            "INSERT INTO calls (id, tenant_id, agent_id, contact_name, phone, provider, status, is_sandbox, cost_paise, created_at) VALUES (?, ?, ?, 'LK Caller', '+919848022335', 'livekit', 'in_progress', 0, 0, ?)",
            (lk_call, tenant_id, agent_id, now),
        )
        conn.commit()
        fin = finalize_call_session(conn, lk_call, tenant_id, duration_seconds=45, transcript_text="User: Hi\nAgent: Hello")
        assert fin["updated"] is True
        assert fin["cost_paise"] > 0
        row = conn.execute("SELECT status, duration_seconds, transcript FROM calls WHERE id = ?", (lk_call,)).fetchone()
        assert row["status"] == "completed"
        assert row["duration_seconds"] == 45
        assert "User: Hi" in row["transcript"]
    finally:
        conn.close()
