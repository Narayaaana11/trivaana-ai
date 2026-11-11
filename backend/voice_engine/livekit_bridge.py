"""
TRIVAANA AI: LiveKit Agents Bridge & SIP Token Generator
Generates compliant LiveKit room access tokens and manages SIP trunk dispatch configuration.
"""

import time
import uuid
from typing import Any, Dict, Optional
import jwt
from core.config import settings


def create_livekit_room_token(
    room_name: str,
    identity: str,
    participant_name: Optional[str] = None,
    ttl_seconds: int = 3600,
    metadata: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a signed LiveKit Access Token using LIVEKIT_API_KEY and LIVEKIT_API_SECRET."""
    if not settings.has_livekit:
        return {
            "configured": False,
            "mode": "sandbox_only",
            "livekit_url": None,
            "token": None,
            "room_name": room_name,
            "message": "LiveKit credentials (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) are not configured.",
        }

    now = int(time.time())
    claims = {
        "iss": settings.LIVEKIT_API_KEY,
        "sub": identity,
        "nbf": now,
        "exp": now + ttl_seconds,
        "jti": uuid.uuid4().hex,
        "name": participant_name or identity,
        "video": {
            "roomJoin": True,
            "room": room_name,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        },
    }
    if metadata:
        claims["metadata"] = metadata

    token = jwt.encode(claims, settings.LIVEKIT_API_SECRET, algorithm="HS256")
    return {
        "configured": True,
        "mode": "livekit",
        "livekit_url": settings.LIVEKIT_URL,
        "token": token,
        "room_name": room_name,
        "identity": identity,
        "sip_configured": bool(settings.LIVEKIT_SIP_CONFIG),
    }

