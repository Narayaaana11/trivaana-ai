"""
TRIVAANA AI: Regression Tests for Option C Hardening & OSS-Inspired Capabilities
Covers:
1. Exotel SSRF subdomain allowlist, 0-prefix CallerId normalization, HMAC capability token verification.
2. OpenDialer-inspired weekday calling hours & 24h daily per-number cap.
3. Dograh-inspired provider HTTP 401/402/403 & failure-rate campaign circuit breaker.
4. LiveKit worker capability introspection without optional SDK crash.
"""

import uuid
import pytest
from datetime import datetime, timezone
from core.config import settings
from database.connection import get_connection
from providers.exotel_adapter import ExotelTelephonyProvider
from services.compliance_service import ComplianceService
from services.campaign_service import CampaignService
from voice_engine.livekit_agent_worker import get_worker_capabilities


def test_exotel_ssrf_allowlist_caller_id_and_hmac_tokens(monkeypatch):
    monkeypatch.setattr(settings, "EXOTEL_API_KEY", "key_test")
    monkeypatch.setattr(settings, "EXOTEL_API_TOKEN", "tok_secret_123")
    monkeypatch.setattr(settings, "EXOTEL_SID", "sid_test")
    monkeypatch.setattr(settings, "EXOTEL_PHONE_NUMBER", "+918047361234")

    # Allowlisted Mumbai endpoint works
    ex = ExotelTelephonyProvider(subdomain="api.in.exotel.com")
    assert ex.subdomain == "api.in.exotel.com"
    assert ExotelTelephonyProvider._exotel_dial_number("+918047361234") == "08047361234"

    # Untrusted subdomain blocked against SSRF
    with pytest.raises(ValueError, match="Unsupported Exotel domain"):
        ExotelTelephonyProvider(subdomain="169.254.169.254")

    # HMAC status callback capability token & stream token verification
    url = ex.build_status_callback_url("https://api.trivaana.ai", "call_abc")
    token = url.split("exotel_auth=")[1]
    assert ex.verify_request({}, {"exotel_auth": token, "_call_id": "call_abc"}) is True
    assert ex.verify_request({}, {"exotel_auth": "forged_token", "_call_id": "call_abc"}) is False

    st_tok = ExotelTelephonyProvider.mint_stream_token("call_abc")
    assert ExotelTelephonyProvider.verify_stream_token("call_abc", st_tok) is True
    assert ExotelTelephonyProvider.verify_stream_token("call_abc", "wrong") is False


def test_compliance_daily_cap_and_weekday_filter(client):
    conn = get_connection()
    cur = conn.cursor()
    phone = "+919848077889"
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("DELETE FROM calls WHERE tenant_id = 'tenant_demo_enterprise' AND phone = ?", (phone,))
    conn.commit()

    assert ComplianceService.check_daily_call_cap(conn, "tenant_demo_enterprise", phone, max_per_day=3)["allowed"] is True

    for _ in range(3):
        cur.execute(
            """
            INSERT INTO calls (
                id, tenant_id, contact_name, phone, direction, status, outcome,
                duration_seconds, cost_paise, is_sandbox, created_at
            ) VALUES (?, 'tenant_demo_enterprise', 'Cap Test', ?, 'outbound', 'completed', 'Completed', 10, 0, 0, ?)
            """,
            (f"call_{uuid.uuid4().hex[:8]}", phone, now),
        )
    conn.commit()

    cap = ComplianceService.check_daily_call_cap(conn, "tenant_demo_enterprise", phone, max_per_day=3)
    assert cap["allowed"] is False
    assert cap["attempts_24h"] == 3

    # Weekday helper accepts empty-mismatch block when an impossible day is configured
    assert ComplianceService.is_within_calling_hours("00:00", "23:59", calling_days=["InvalidDay"]) is False
    conn.close()


def test_campaign_provider_circuit_breaker(client):
    conn = get_connection()
    cmp = CampaignService.create_campaign(conn, "tenant_demo_enterprise", "Breaker Test", is_sandbox=True)
    cid = cmp["campaign_id"]
    cur = conn.cursor()
    cur.execute("UPDATE campaigns SET status = 'running' WHERE id = ?", (cid,))
    conn.commit()

    res = CampaignService.evaluate_provider_circuit_breaker(
        conn, "tenant_demo_enterprise", cid, http_status=402
    )
    assert res["tripped"] is True
    assert res["status"] == "paused"

    cur.execute("SELECT status FROM campaigns WHERE id = ?", (cid,))
    assert cur.fetchone()["status"] == "paused"
    conn.close()


def test_livekit_worker_capabilities():
    caps = get_worker_capabilities()
    assert "sdk_installed" in caps
    assert "livekit_configured" in caps


def test_plivo_and_vobiz_telephony_adapters(monkeypatch):
    import base64
    import hashlib
    import hmac
    from providers.plivo_adapter import PlivoTelephonyProvider
    from providers.vobiz_adapter import VobizTelephonyProvider
    from providers import get_telephony_provider

    monkeypatch.setattr(settings, "PLIVO_AUTH_ID", "MA_PLIVO_1")
    monkeypatch.setattr(settings, "PLIVO_AUTH_TOKEN", "plivo_secret_tok")
    monkeypatch.setattr(settings, "PLIVO_PHONE_NUMBER", "+918047369999")
    plivo = get_telephony_provider("plivo")
    assert isinstance(plivo, PlivoTelephonyProvider)
    assert "<Stream bidirectional=\"true\"" in plivo.generate_stream_xml("call_p1")

    url = "https://api.trivaana.ai/api/calls/callback/call_p1"
    nonce = "nonce123"
    sig_v2 = base64.b64encode(
        hmac.new(b"plivo_secret_tok", (url + nonce).encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8")
    assert plivo.verify_request({"X-Plivo-Signature-V2": sig_v2, "X-Plivo-Signature-V2-Nonce": nonce}, {}, url=url) is True
    assert plivo.verify_request({"X-Plivo-Signature-V2": "bad", "X-Plivo-Signature-V2-Nonce": nonce}, {}, url=url) is False

    monkeypatch.setattr(settings, "VOBIZ_AUTH_ID", "MA_VOBIZ_1")
    monkeypatch.setattr(settings, "VOBIZ_AUTH_TOKEN", "vobiz_secret_tok")
    monkeypatch.setattr(settings, "VOBIZ_PHONE_NUMBER", "+918047368888")
    vobiz = get_telephony_provider("vobiz")
    assert isinstance(vobiz, VobizTelephonyProvider)
    assert "provider=vobiz" in vobiz.generate_stream_xml("call_v1")
    cb_tok = vobiz.build_callback_token("call_v1")
    assert vobiz.verify_request({}, {"_call_id": "call_v1", "vobiz_auth": cb_tok}) is True
    assert vobiz.verify_request({}, {"_call_id": "call_v1", "vobiz_auth": "bad"}) is False


def test_telephony_ws_audio_codec_barge_in_dtmf_and_tts_cache(client, demo_auth_headers):
    import base64
    import struct
    from voice_engine.telephony_stream import (
        DtmfAccumulator,
        TelephonyStreamSession,
        mulaw_to_pcm16,
        pcm16_to_mulaw,
        pcm16_to_wav,
    )
    from voice_engine.tts_cache import TTSCache
    import tempfile
    from pathlib import Path

    # Codec roundtrip & WAV header check
    pcm = struct.pack("<40h", *[1200 if i % 2 == 0 else -1200 for i in range(40)])
    ulaw = pcm16_to_mulaw(pcm)
    assert len(ulaw) == 40
    decoded_pcm = mulaw_to_pcm16(ulaw)
    assert len(decoded_pcm) == len(pcm)
    wav = pcm16_to_wav(decoded_pcm)
    assert wav[:4] == b"RIFF"

    # DTMF accumulator
    dtmf = DtmfAccumulator()
    assert dtmf.press("1") is None
    assert dtmf.press("2") is None
    assert dtmf.press("#") == "12"

    # TTS cache
    with tempfile.TemporaryDirectory() as tmpdir:
        cache = TTSCache(cache_dir=Path(tmpdir))
        assert cache.get("sarvam", "meera", "te-IN", "Namaskaram") is None
        cache.set("sarvam", "meera", "te-IN", "Namaskaram", b"RIFF_AUDIO_BYTES")
        assert cache.get("sarvam", "meera", "te-IN", "Namaskaram") == b"RIFF_AUDIO_BYTES"

    # Live WebSocket media + barge-in clear + transcript + stop
    conn = get_connection()
    session = TelephonyStreamSession(conn=conn, call_id="call_ws_demo", provider="twilio")
    session.ai_speaking = True
    session.stream_sid = "strm_1"
    loud_pcm = struct.pack("<200h", *[8000 if i % 2 == 0 else -8000 for i in range(200)])
    loud_ulaw_b64 = base64.b64encode(pcm16_to_mulaw(loud_pcm)).decode("ascii")
    res = session.handle_event({"event": "media", "media": {"payload": loud_ulaw_b64, "track": "inbound"}})
    assert any(f.get("event") == "clear" for f in res["outbound"])
    assert res["barge_in_count"] == 1
    conn.close()

    calls = client.get("/api/calls", headers=demo_auth_headers).json()["calls"]
    ws_call_id = calls[0]["id"] if calls else "call_ws_demo"
    with client.websocket_connect(f"/api/calls/stream/{ws_call_id}?provider=exotel") as ws:
        ws.send_json({"event": "start", "start": {"streamSid": "st_1", "callSid": "cs_1"}})
        ws.send_json({"event": "transcript", "text": "Tell me about pricing"})
        reply = ws.receive_json()
        assert reply["event"] in ("trivaana_turn", "media")
        ws.send_json({"event": "stop"})


def test_dispositions_transfer_worker_scheduler_rate_limit_and_pg_compat(client, demo_auth_headers):
    from core.rate_limit import SlidingWindowRateLimiter
    from database.connection import _translate_sqlite_params
    from services.email_service import EmailService
    from worker.tasks import run_worker_tick

    # Rate limit check
    rl = SlidingWindowRateLimiter()
    for _ in range(3):
        allowed, _ = rl.is_allowed("test:ip", 3, 60)
        assert allowed is True
    allowed, rem = rl.is_allowed("test:ip", 3, 60)
    assert allowed is False
    assert rem == 0

    # Postgres SQL translation helper
    pg_sql = _translate_sqlite_params("SELECT * FROM calls WHERE id = ? AND phone = '?'")
    assert pg_sql == "SELECT * FROM calls WHERE id = %s AND phone = '?'"

    # SMTP truthful unconfigured status
    mail_res = EmailService.send_email("test@example.com", "Test", "Hello")
    assert mail_res["sent"] is False

    # Disposition mapping API
    put_res = client.put(
        "/api/compliance/dispositions",
        json={"mapping": {"interested": "HOT_LEAD", "do_not_call": "VICIDIAL_DNC"}},
        headers=demo_auth_headers,
    )
    assert put_res.status_code == 200
    assert put_res.json()["mapping"]["interested"] == "HOT_LEAD"
    get_res = client.get("/api/compliance/dispositions", headers=demo_auth_headers)
    assert get_res.json()["mapping"]["do_not_call"] == "VICIDIAL_DNC"

    # Warm transfer endpoint
    calls = client.get("/api/calls", headers=demo_auth_headers).json()["calls"]
    assert len(calls) > 0
    xfer_res = client.post(
        f"/api/calls/{calls[0]['id']}/transfer",
        json={"target_phone": "+919848099999", "reason": "Enterprise pricing request"},
        headers=demo_auth_headers,
    )
    assert xfer_res.status_code == 200
    assert "<Dial>+919848099999</Dial>" in xfer_res.json()["control_xml"]

    # Worker tick scheduled activation check
    conn = get_connection()
    cmp = CampaignService.create_campaign(conn, "tenant_demo_enterprise", "Scheduled Auto Test", is_sandbox=True)
    cur = conn.cursor()
    cur.execute(
        "UPDATE campaigns SET status = 'scheduled', scheduled_at = '2020-01-01T00:00:00+00:00' WHERE id = ?",
        (cmp["campaign_id"],),
    )
    conn.commit()
    tick = run_worker_tick(conn)
    assert tick["activated"] >= 1
    conn.close()


def test_legacy_transactions_migration_allows_wallet_credit(tmp_path):
    import sqlite3
    from database.schema import create_tables
    from services.billing_service import BillingService

    db_file = tmp_path / "legacy_tx.db"
    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE tenants (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, api_key_hash TEXT UNIQUE NOT NULL,
            wallet_balance_paise INTEGER NOT NULL DEFAULT 10000, currency TEXT NOT NULL DEFAULT 'INR',
            plan TEXT NOT NULL DEFAULT 'growth', concurrency_limit INTEGER NOT NULL DEFAULT 10,
            created_at TEXT NOT NULL
        );
        CREATE TABLE transactions (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, type TEXT NOT NULL,
            amount_paise INTEGER NOT NULL, amount_inr REAL NOT NULL,
            description TEXT NOT NULL, invoice_id TEXT,
            running_balance REAL NOT NULL, created_at TEXT NOT NULL
        );
        INSERT INTO tenants VALUES ('t1', 'Legacy Co', 'h1', 10000, 'INR', 'growth', 10, '2026-01-01');
        INSERT INTO transactions VALUES ('tx0', 't1', 'credit', 10000, 100.0, 'Opening', 'INV-0', 100.0, '2026-01-01');
    """)
    create_tables(conn)
    res = BillingService.credit_wallet(conn, "t1", 5000, "Legacy migration topup", "idem_legacy_1")
    assert res["status"] == "success"
    assert res["running_balance_paise"] == 15000
    conn.close()


def test_legacy_tenant_unification_and_voice_402_handling(tmp_path, client, demo_auth_headers, monkeypatch):
    import sqlite3
    from database.schema import create_tables
    from providers.voice_adapters import ElevenLabsVoiceProvider, VoiceProviderPlanError

    db_file = tmp_path / "legacy_tenant.db"
    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    create_tables(conn)
    now = "2026-01-01T00:00:00+00:00"
    conn.execute("INSERT INTO tenants (id, name, api_key_hash, created_at) VALUES ('tenant_demo_enterprise', 'Demo', 'hd', ?)", (now,))
    conn.execute("INSERT INTO tenants (id, name, api_key_hash, created_at) VALUES ('tenant_enterprise_demo', 'Legacy', 'hl', ?)", (now,))
    conn.execute("PRAGMA foreign_keys=OFF")
    conn.execute("INSERT INTO agents (id, tenant_id, name, vertical, language, system_prompt, created_at, updated_at) VALUES ('ag_leg', 'tenant_enterprise_demo', 'Legacy Agent', 'Real Estate', 'te-IN', 'Hello', ?, ?)", (now, now))
    conn.commit()
    conn.execute("PRAGMA foreign_keys=ON")
    create_tables(conn)
    row = conn.execute("SELECT tenant_id FROM agents WHERE id = 'ag_leg'").fetchone()
    assert row["tenant_id"] == "tenant_demo_enterprise"
    conn.close()

    def _raise_402(*args, **kwargs):
        raise VoiceProviderPlanError("ElevenLabs free-tier library voice restricted")

    monkeypatch.setattr(settings, "ELEVENLABS_API_KEY", "sk_free_test")
    monkeypatch.setattr(ElevenLabsVoiceProvider, "synthesize_speech", _raise_402)
    pv = client.post(
        "/api/voices/preview",
        json={"provider": "elevenlabs", "voice_id": "21m00Tcm4TlvDq8ikWAM", "language": "en-IN", "text": "Hello"},
        headers=demo_auth_headers,
    )
    assert pv.status_code == 200
    assert pv.json()["status"] == "plan_upgrade_required"
    assert pv.json()["requires_paid_plan_or_custom_voice"] is True

    # Integrations catalog exposes plivo & vobiz + DELETE /api/agents/{id} archives cleanly
    ints = client.get("/api/integrations", headers=demo_auth_headers).json()["integrations"]
    keys = {i["provider_key"] for i in ints}
    assert {"exotel", "plivo", "vobiz", "twilio"}.issubset(keys)

    ag = client.post(
        "/api/agents",
        json={"name": "Archive Test Bot", "system_prompt": "Test prompt", "language": "en-IN"},
        headers=demo_auth_headers,
    )
    assert ag.status_code in (200, 201)
    ag_data = ag.json()
    aid = ag_data.get("id") or ag_data.get("agent_id") or (ag_data.get("agent") or {}).get("id")
    assert aid
    del_res = client.delete(f"/api/agents/{aid}", headers=demo_auth_headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "archived"
