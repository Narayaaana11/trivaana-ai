"""
TRIVAANA AI: Transactional Email Service
Sends password reset and email verification messages over SMTP when configured.
"""

import logging
import smtplib
from email.message import EmailMessage
from typing import Any, Dict

from core.config import settings

logger = logging.getLogger("trivaana.email")


class EmailService:
    @staticmethod
    def send_email(to_email: str, subject: str, body_text: str) -> Dict[str, Any]:
        if not settings.has_smtp:
            return {
                "sent": False,
                "provider": "unconfigured",
                "message": "SMTP_HOST not configured; token persisted in auth_tokens table.",
            }

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email
        msg.set_content(body_text)

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10.0) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            return {"sent": True, "provider": "smtp"}
        except Exception as exc:
            logger.warning("Failed to send transactional email to %s: %s", to_email, exc)
            return {"sent": False, "provider": "smtp", "error": str(exc)}

    @staticmethod
    def send_password_reset(to_email: str, reset_token: str) -> Dict[str, Any]:
        reset_link = f"{settings.FRONTEND_URL.rstrip('/')}/?reset_token={reset_token}"
        body = (
            "Hello,\n\n"
            "We received a request to reset your Trivaana AI password.\n"
            f"Reset Token: {reset_token}\n"
            f"Direct Link: {reset_link}\n\n"
            "This token expires in 1 hour. If you did not request this, please ignore this email.\n"
        )
        return EmailService.send_email(to_email, "Trivaana AI — Password Reset", body)

    @staticmethod
    def send_verification_email(to_email: str, verification_token: str) -> Dict[str, Any]:
        body = (
            "Hello,\n\n"
            "Please verify your email address in Trivaana AI Settings -> Account & Security.\n"
            f"Verification Token: {verification_token}\n\n"
            "This token expires in 24 hours.\n"
        )
        return EmailService.send_email(to_email, "Trivaana AI — Verify Your Email", body)

