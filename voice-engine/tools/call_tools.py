"""
TRIVAANA AI: Structured Pydantic Tool Contracts for Mid-Call AI Actions
"""

from typing import Optional
from pydantic import BaseModel, Field


class BookAppointmentToolInput(BaseModel):
    contact_name: str
    phone: str
    title: str = "Consultation Call"
    scheduled_start: str = Field(..., description="ISO-8601 start timestamp")
    scheduled_end: str = Field(..., description="ISO-8601 end timestamp")
    notes: Optional[str] = None


class WhatsAppTemplateToolInput(BaseModel):
    phone: str
    template_name: str = "appointment_confirmation"
    language_code: str = "en"


class HumanTransferToolInput(BaseModel):
    transfer_number: str
    reason: str = "Caller requested human specialist"


class OptOutToolInput(BaseModel):
    phone: str
    reason: str = "Caller requested Do-Not-Call"

