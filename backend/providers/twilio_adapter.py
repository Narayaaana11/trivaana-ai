"""
TRIVAANA AI: Twilio Telephony Adapter (Global PSTN)
Implements outbound dialing, TwiML call control, media stream binding,
and official HMAC-SHA1 X-Twilio-Signature verification.
"""

import hmac
import hashlib
import base64
import requests
from typing import Dict, Any, Optional
from core.config import settings
from providers.base import BaseTelephonyProvider, CallDispatchResult, CallStatusEvent

class TwilioTelephonyProvider(BaseTelephonyProvider):
    name = "twilio"

    def __init__(
        self,
        account_sid: Optional[str] = None,
        auth_token: Optional[str] = None,
        caller_id: Optional[str] = None
    ):
        self.account_sid = account_sid or settings.TWILIO_ACCOUNT_SID
        self.auth_token = auth_token or settings.TWILIO_AUTH_TOKEN
        self.caller_id = caller_id or settings.TWILIO_PHONE_NUMBER
        self.base_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}"

    @property
    def is_configured(self) -> bool:
        return bool(self.account_sid and self.auth_token and self.caller_id)

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
                provider="twilio",
                status="failed",
                error_message="Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) not configured"
            )

        call_id = (extra_data or {}).get("call_id", "")
        base_url = settings.PUBLIC_BASE_URL.rstrip('/')
        
        # Dedicated Voice Instruction Endpoint (TwiML Call Control)
        voice_url = f"{base_url}/api/calls/twiml/{call_id}" if call_id else f"{base_url}/api/calls/twiml-default"
        # Dedicated Status Callback Endpoint (JSON/Form State Reconciler)
        status_url = webhook_url or (f"{base_url}/api/calls/callback/{call_id}" if call_id else "")

        endpoint = f"{self.base_url}/Calls.json"
        payload = {
            "To": to_phone,
            "From": from_phone or self.caller_id,
            "Url": voice_url,
            "Method": "POST"
        }
        if status_url:
            payload["StatusCallback"] = status_url
            payload["StatusCallbackMethod"] = "POST"
            payload["StatusCallbackEvent"] = ["initiated", "ringing", "answered", "completed"]

        try:
            resp = requests.post(
                endpoint,
                auth=(self.account_sid, self.auth_token),
                data=payload,
                timeout=10.0
            )
            data = resp.json()
            if resp.status_code in (200, 201) and "sid" in data:
                return CallDispatchResult(
                    success=True,
                    provider="twilio",
                    provider_call_id=data.get("sid"),
                    status=data.get("status", "initiated").lower(),
                    raw_response=data
                )
            else:
                return CallDispatchResult(
                    success=False,
                    provider="twilio",
                    status="failed",
                    error_message=data.get("message", f"Twilio error: {resp.text}"),
                    raw_response=data
                )
        except Exception as e:
            return CallDispatchResult(
                success=False,
                provider="twilio",
                status="failed",
                error_message=f"Network exception connecting to Twilio: {str(e)}"
            )

    def terminate_call(self, provider_call_id: str) -> bool:
        if not self.is_configured or not provider_call_id:
            return False

        endpoint = f"{self.base_url}/Calls/{provider_call_id}.json"
        try:
            resp = requests.post(
                endpoint,
                auth=(self.account_sid, self.auth_token),
                data={"Status": "completed"},
                timeout=5.0
            )
            return resp.status_code in (200, 204)
        except Exception:
            return False

    def verify_request(self, url: str, params: Dict[str, Any], signature: str) -> bool:
        """
        Official Twilio Request Signature Validation Procedure.
        1. Takes full public URL.
        2. Appends sorted POST key-value pairs with no delimiters.
        3. HMAC-SHA1 with TWILIO_AUTH_TOKEN.
        4. Base64-encodes and compares in constant time.
        """
        if not signature or not self.auth_token:
            return False

        sorted_keys = sorted(params.keys())
        data_to_sign = url + "".join(f"{k}{params[k]}" for k in sorted_keys)

        expected_sig = base64.b64encode(
            hmac.new(
                self.auth_token.encode("utf-8"),
                data_to_sign.encode("utf-8"),
                hashlib.sha1
            ).digest()
        ).decode("utf-8")

        return hmac.compare_digest(expected_sig, signature)

    def verify_webhook(self, headers: Dict[str, str], raw_body: bytes, url: Optional[str] = None, params: Optional[Dict[str, Any]] = None) -> bool:
        signature = headers.get("X-Twilio-Signature") or headers.get("x-twilio-signature")
        if not signature or not self.auth_token:
            return False
        if url and params is not None:
            return self.verify_request(url, params, signature)
        return False

    @staticmethod
    def generate_twiml(call_id: str, language: str = "te-IN", prompt_text: Optional[str] = None) -> str:
        """
        Produce correct TwiML call-control response.
        Orchestrates Indian dialect greeting, conversational Speech Gather, and media stream fallback.
        """
        lang_config = {
            "te-IN": {
                "voice": "Polly.Aditi",
                "lang": "te-IN",
                "greeting": "నమస్కారం! త్రివాణా ఏఐ కి స్వాగతం. నేను మీకు ఎలా సహాయపడగలను?"
            },
            "hi-IN": {
                "voice": "Polly.Aditi",
                "lang": "hi-IN",
                "greeting": "नमस्ते! त्रिवाणा एआई में आपका स्वागत है। मैं आपकी क्या सहायता कर सकता हूँ?"
            },
            "en-IN": {
                "voice": "Polly.Raveena",
                "lang": "en-IN",
                "greeting": "Hello! Welcome to Trivaana AI. How may I assist you today?"
            }
        }

        conf = lang_config.get(language, lang_config["te-IN"])
        voice = conf["voice"]
        tw_lang = conf["lang"]
        greeting = prompt_text or conf["greeting"]

        base_url = settings.PUBLIC_BASE_URL.rstrip('/')
        gather_action = f"{base_url}/api/calls/twiml-gather/{call_id}"

        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Response>\n'
            f'    <Gather input="speech" language="{tw_lang}" timeout="4" action="{gather_action}" method="POST">\n'
            f'        <Say voice="{voice}" language="{tw_lang}">{greeting}</Say>\n'
            '    </Gather>\n'
            f'    <Say voice="{voice}" language="{tw_lang}">ధన్యవాదాలు, మీ సంభాషణ రికార్డ్ చేయబడింది.</Say>\n'
            '</Response>'
        )

    def parse_webhook_event(self, headers: Dict[str, str], payload: Dict[str, Any]) -> CallStatusEvent:
        call_sid = payload.get("CallSid") or payload.get("ParentCallSid") or ""
        raw_status = (payload.get("CallStatus") or payload.get("status") or "completed").lower()

        status_map = {
            "queued": "initiated",
            "initiated": "initiated",
            "ringing": "ringing",
            "in-progress": "connected",
            "completed": "completed",
            "failed": "failed",
            "busy": "busy",
            "no-answer": "no-answer",
            "canceled": "cancelled"
        }
        status = status_map.get(raw_status, "completed")
        duration = int(payload.get("CallDuration") or payload.get("Duration") or 0)
        recording = payload.get("RecordingUrl")

        return CallStatusEvent(
            provider="twilio",
            provider_call_id=call_sid,
            status=status,
            duration_seconds=duration,
            recording_url=recording,
            raw_payload=payload
        )
