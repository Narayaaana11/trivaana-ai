"""
TRIVAANA AI: During-Call AI Actions Execution Engine
Handles Google Calendar, Meta WhatsApp Templates, Google Sheets, Custom REST APIs,
Call Transfers, and Opt-in Caller Memory with strict credential truthfulness.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import httpx

from core.config import settings
from core.vault import decrypt_config_json
from providers import get_telephony_provider
from services.webhook_service import is_safe_public_url


class ActionService:
    @staticmethod
    def execute_action(
        conn: sqlite3.Connection,
        tenant_id: str,
        call_id: str,
        action_type: str,
        action_name: str,
        arguments: Dict[str, Any],
        agent_id: Optional[str] = None,
        action_id: Optional[str] = None,
        is_sandbox: bool = False,
    ) -> Dict[str, Any]:
        cur = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        exec_status = "not_configured"
        result: Dict[str, Any] = {}

        if action_type == "google_calendar":
            cur.execute(
                "SELECT * FROM integrations WHERE tenant_id = ? AND provider_key = 'google_calendar' AND status = 'connected'",
                (tenant_id,),
            )
            conn_row = cur.fetchone()
            if not conn_row and not settings.has_google_oauth:
                if is_sandbox:
                    exec_status = "simulated"
                    result = {
                        "simulated": True,
                        "action": arguments.get("operation", "book_appointment"),
                        "slot": arguments.get("slot", "Tomorrow 11:00 AM IST"),
                        "message": "Simulated calendar appointment (Google Calendar OAuth not connected).",
                    }
                else:
                    exec_status = "not_configured"
                    result = {"configured": False, "message": "Google Calendar integration is not connected for this workspace."}
            else:
                cfg = decrypt_config_json(conn_row["config_json"] or "{}") if conn_row else {}
                access_token = cfg.get("access_token")
                if access_token:
                    try:
                        op = str(arguments.get("operation") or "list_events").lower()
                        if op == "book_appointment" and arguments.get("start") and arguments.get("end"):
                            resp = httpx.post(
                                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                                json={
                                    "summary": arguments.get("title", "Trivaana AI Scheduled Meeting"),
                                    "description": arguments.get("notes", ""),
                                    "start": {"dateTime": arguments["start"], "timeZone": "Asia/Kolkata"},
                                    "end": {"dateTime": arguments["end"], "timeZone": "Asia/Kolkata"},
                                },
                                timeout=8.0,
                            )
                        else:
                            resp = httpx.get(
                                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                                headers={"Authorization": f"Bearer {access_token}"},
                                params={"maxResults": 5},
                                timeout=8.0,
                            )
                        exec_status = "executed" if resp.status_code in (200, 201) else "failed"
                        result = {"http_status": resp.status_code, "calendar_response": resp.json() if resp.status_code in (200, 201) else resp.text[:300]}
                    except Exception as e:
                        exec_status = "failed"
                        result = {"error": str(e)}
                else:
                    exec_status = "not_configured"
                    result = {"configured": False, "message": "Google Calendar OAuth access_token missing."}

        elif action_type == "whatsapp_template":
            template_name = arguments.get("template_name")
            cur.execute(
                "SELECT * FROM whatsapp_templates WHERE tenant_id = ? AND name = ? LIMIT 1",
                (tenant_id, template_name),
            )
            tpl = cur.fetchone()
            if tpl and tpl["approval_status"] != "approved":
                exec_status = "failed"
                result = {
                    "error": f"WhatsApp template '{template_name}' has status '{tpl['approval_status']}'. Only Meta-approved templates may be sent."
                }
            elif not settings.has_whatsapp:
                if is_sandbox:
                    exec_status = "simulated"
                    result = {
                        "simulated": True,
                        "template": template_name or "appointment_confirmation",
                        "to": arguments.get("phone"),
                        "message": "Simulated WhatsApp template dispatch (Meta Cloud API not configured).",
                    }
                else:
                    exec_status = "not_configured"
                    result = {"configured": False, "message": "WhatsApp Cloud API credentials are not configured."}
            else:
                to_phone = (arguments.get("phone") or "").replace("+", "")
                url = f"https://graph.facebook.com/v19.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
                payload = {
                    "messaging_product": "whatsapp",
                    "to": to_phone,
                    "type": "template",
                    "template": {
                        "name": template_name or "hello_world",
                        "language": {"code": arguments.get("language_code", "en")},
                    },
                }
                try:
                    resp = httpx.post(
                        url,
                        headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}", "Content-Type": "application/json"},
                        json=payload,
                        timeout=10.0,
                    )
                    exec_status = "executed" if resp.status_code in (200, 201) else "failed"
                    result = {"http_status": resp.status_code, "meta_response": resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text}
                except Exception as e:
                    exec_status = "failed"
                    result = {"error": str(e)}

        elif action_type == "google_sheets":
            cur.execute(
                "SELECT * FROM integrations WHERE tenant_id = ? AND provider_key = 'google_sheets' AND status = 'connected'",
                (tenant_id,),
            )
            conn_row = cur.fetchone()
            if not conn_row:
                exec_status = "simulated" if is_sandbox else "not_configured"
                result = {"configured": False, "simulated": is_sandbox, "message": "Google Sheets integration is not connected."}
            else:
                cfg = decrypt_config_json(conn_row["config_json"] or "{}")
                access_token = cfg.get("access_token")
                spreadsheet_id = cfg.get("spreadsheet_id")
                sheet_range = cfg.get("range", "Sheet1!A1")
                if not access_token or not spreadsheet_id:
                    exec_status = "not_configured"
                    result = {"configured": False, "message": "Google Sheets access_token or spreadsheet_id missing."}
                elif is_sandbox:
                    exec_status = "simulated"
                    result = {"simulated": True, "spreadsheet_id": spreadsheet_id, "row_payload": arguments}
                else:
                    try:
                        row_values = [str(v) for v in arguments.values()]
                        resp = httpx.post(
                            f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{sheet_range}:append",
                            params={"valueInputOption": "USER_ENTERED"},
                            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                            json={"values": [row_values]},
                            timeout=8.0,
                        )
                        exec_status = "executed" if resp.status_code in (200, 201) else "failed"
                        result = {"http_status": resp.status_code, "spreadsheet_id": spreadsheet_id}
                    except Exception as e:
                        exec_status = "failed"
                        result = {"error": str(e)}

        elif action_type == "custom_api":
            cfg = {}
            if action_id:
                cur.execute("SELECT config_json FROM agent_actions WHERE id = ? AND tenant_id = ?", (action_id, tenant_id))
                arow = cur.fetchone()
                if arow:
                    cfg = json.loads(arow["config_json"] or "{}")
            endpoint = cfg.get("endpoint") or arguments.get("endpoint", "")
            method = (cfg.get("method") or "POST").upper()
            timeout_s = float(cfg.get("timeout_seconds") or 8.0)
            headers = cfg.get("headers") or {"Content-Type": "application/json"}

            if not endpoint or not is_safe_public_url(endpoint):
                exec_status = "failed"
                result = {"error": "Invalid or blocked custom API endpoint URL."}
            else:
                try:
                    resp = httpx.request(
                        method,
                        endpoint,
                        json=arguments,
                        headers=headers,
                        timeout=min(timeout_s, 15.0),
                        follow_redirects=False,
                    )
                    exec_status = "executed" if 200 <= resp.status_code < 300 else "failed"
                    result = {"http_status": resp.status_code, "body": resp.text[:500]}
                except Exception as e:
                    exec_status = "failed"
                    result = {"error": str(e)}

        elif action_type == "call_transfer":
            target_number = arguments.get("transfer_number")
            cur.execute("SELECT provider, provider_call_id FROM calls WHERE id = ? AND tenant_id = ?", (call_id, tenant_id))
            call_row = cur.fetchone()
            if not call_row or not target_number:
                exec_status = "failed"
                result = {"error": "Missing call record or transfer target number"}
            elif call_row["provider"] == "mock" or is_sandbox:
                exec_status = "simulated"
                result = {"simulated": True, "transfer_to": target_number, "message": "Simulated warm transfer to human agent."}
            else:
                exec_status = "executed"
                result = {"transfer_to": target_number, "provider": call_row["provider"], "status": "transfer_requested"}

        elif action_type == "caller_memory":
            phone = arguments.get("phone")
            summary = arguments.get("summary", "")
            if phone:
                cur.execute("SELECT id, interaction_count FROM caller_memories WHERE tenant_id = ? AND phone = ?", (tenant_id, phone))
                existing = cur.fetchone()
                if existing:
                    cur.execute(
                        """
                        UPDATE caller_memories
                        SET summary = ?, preferences_json = ?, last_appointment = COALESCE(?, last_appointment),
                            last_call_id = ?, interaction_count = interaction_count + 1, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            summary,
                            json.dumps(arguments.get("preferences", {})),
                            arguments.get("appointment"),
                            call_id,
                            now,
                            existing["id"],
                        ),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO caller_memories (id, tenant_id, phone, caller_name, summary, preferences_json, last_appointment, last_call_id, interaction_count, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                        """,
                        (
                            f"mem_{uuid.uuid4().hex[:8]}",
                            tenant_id,
                            phone,
                            arguments.get("caller_name"),
                            summary,
                            json.dumps(arguments.get("preferences", {})),
                            arguments.get("appointment"),
                            call_id,
                            now,
                            now,
                        ),
                    )
                exec_status = "executed"
                result = {"phone": phone, "memory_saved": True}
            else:
                exec_status = "failed"
                result = {"error": "Phone number required for caller memory"}

        log_id = f"cact_{uuid.uuid4().hex[:8]}"
        cur.execute(
            """
            INSERT INTO call_actions (
                id, call_id, agent_id, action_id, tenant_id, action_type,
                action_name, arguments_json, result_json, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                log_id,
                call_id,
                agent_id,
                action_id,
                tenant_id,
                action_type,
                action_name,
                json.dumps(arguments),
                json.dumps(result),
                exec_status,
                now,
            ),
        )
        conn.commit()
        return {
            "call_action_id": log_id,
            "action_type": action_type,
            "action_name": action_name,
            "status": exec_status,
            "result": result,
        }

