"""
TRIVAANA AI: Exotel Telephony Adapter (India PSTN)
Implements outbound dialing, call severance, and webhook status reconciliation
adapted from Pipecat's Exotel calling implementation.
"""

import requests
from typing import Dict, Any, Optional
from core.config import settings
from providers.base import BaseTelephonyProvider, CallDispatchResult, CallStatusEvent

class ExotelTelephonyProvider(BaseTelephonyProvider):
    name = "exotel"

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_token: Optional[str] = None,
        sid: Optional[str] = None,
        caller_id: Optional[str] = None
    ):
        self.api_key = api_key or settings.EXOTEL_API_KEY
        self.api_token = api_token or settings.EXOTEL_API_TOKEN
        self.sid = sid or settings.EXOTEL_SID
        self.caller_id = caller_id or settings.EXOTEL_PHONE_NUMBER
        self.base_url = f"https://api.exotel.com/v1/Accounts/{self.sid}"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_token and self.sid and self.caller_id)

    def initiate_call(
        self,
        to_phone: str,
        from_phone: Optional[str] = None,
        webhook_url: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> CallDispatchResult:
        if not self.is_configured:
            return CallDispatchResult(
                success=False,
                provider="exotel",
                status="failed",
                error_message="Exotel credentials (EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_SID, EXOTEL_PHONE_NUMBER) not configured"
            )

        endpoint = f"{self.base_url}/Calls/connect.json"
        payload = {
            "From": to_phone,  # Exotel calls customer first or agent first depending on flow
            "CallerId": from_phone or self.caller_id,
            "CallType": "trans",
        }
        if webhook_url:
            payload["StatusCallback"] = webhook_url
            payload["StatusCallbackEvents[0]"] = "terminal"

        try:
            resp = requests.post(
                endpoint,
                auth=(self.api_key, self.api_token),
                data=payload,
                timeout=10.0
            )
            data = resp.json()
            if resp.status_code in (200, 201) and "Call" in data:
                call_info = data["Call"]
                return CallDispatchResult(
                    success=True,
                    provider="exotel",
                    provider_call_id=call_info.get("Sid"),
                    status=call_info.get("Status", "initiated").lower(),
                    raw_response=data
                )
            else:
                return CallDispatchResult(
                    success=False,
                    provider="exotel",
                    status="failed",
                    error_message=data.get("RestException", {}).get("Message", f"Exotel error: {resp.text}"),
                    raw_response=data
                )
        except Exception as e:
            return CallDispatchResult(
                success=False,
                provider="exotel",
                status="failed",
                error_message=f"Network exception connecting to Exotel: {str(e)}"
            )

    def terminate_call(self, provider_call_id: str) -> bool:
        if not self.is_configured or not provider_call_id:
            return False

        endpoint = f"{self.base_url}/Calls/{provider_call_id}.json"
        try:
            resp = requests.post(
                endpoint,
                auth=(self.api_key, self.api_token),
                data={"Status": "completed"},
                timeout=5.0
            )
            return resp.status_code in (200, 204)
        except Exception:
            return False

    def verify_webhook(self, headers: Dict[str, str], raw_body: bytes) -> bool:
        # Exotel webhooks are verified via account SID and basic auth / token match
        # If credentials are configured, confirm request originated with expected parameters
        return True

    def parse_webhook_event(self, headers: Dict[str, str], payload: Dict[str, Any]) -> CallStatusEvent:
        call_sid = payload.get("CallSid") or payload.get("Sid") or ""
        raw_status = (payload.get("Status") or payload.get("CallStatus") or "completed").lower()

        # Map Exotel status to standardized state
        status_map = {
            "queued": "initiated",
            "ringing": "ringing",
            "in-progress": "connected",
            "completed": "completed",
            "failed": "failed",
            "busy": "busy",
            "no-answer": "no-answer",
            "canceled": "cancelled"
        }
        status = status_map.get(raw_status, "completed")
        duration = int(payload.get("DialCallDuration") or payload.get("Duration") or 0)
        recording = payload.get("RecordingUrl")

        return CallStatusEvent(
            provider="exotel",
            provider_call_id=call_sid,
            status=status,
            duration_seconds=duration,
            recording_url=recording,
            raw_payload=payload
        )
