"""
TRIVAANA AI: Application Configuration & Environment Settings
Strict separation of secrets, environment-driven defaults, and CORS controls.
"""

import os
from pathlib import Path
from typing import List
from pydantic import BaseModel, Field

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("TRIVAANA_DATA_DIR", str(Path.home() / ".trivaana")))
os.makedirs(str(DATA_DIR), exist_ok=True)

class Settings(BaseModel):
    # Server Host & Port
    HOST: str = Field(default_factory=lambda: os.environ.get("HOST", "0.0.0.0"))
    PORT: int = Field(default_factory=lambda: int(os.environ.get("PORT", "8000")))

    # Environment
    ENVIRONMENT: str = Field(default_factory=lambda: os.environ.get("ENVIRONMENT", "development"))
    DEBUG: bool = Field(default_factory=lambda: os.environ.get("DEBUG", "true").lower() in ("true", "1"))
    
    # Database
    DATABASE_PATH: Path = Field(default_factory=lambda: Path(os.environ.get("DATABASE_PATH", str(DATA_DIR / "trivaana_saas.db"))))
    SQLITE_DB_PATH: Path = Field(default_factory=lambda: Path(os.environ.get("SQLITE_DB_PATH", str(DATA_DIR / "trivaana_saas.db"))))
    
    # Security & Auth
    JWT_SECRET: str = Field(default_factory=lambda: os.environ.get("JWT_SECRET", "trivaana-dev-secret-key-change-in-production-981a27e"))
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # CORS
    ALLOWED_ORIGINS: List[str] = Field(default_factory=lambda: [
        origin.strip() for origin in os.environ.get(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8001"
        ).split(",") if origin.strip()
    ])

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return self.ALLOWED_ORIGINS
    
    # Telephony: Exotel (India)
    EXOTEL_API_KEY: str = Field(default_factory=lambda: os.environ.get("EXOTEL_API_KEY", ""))
    EXOTEL_API_TOKEN: str = Field(default_factory=lambda: os.environ.get("EXOTEL_API_TOKEN", ""))
    EXOTEL_SID: str = Field(default_factory=lambda: os.environ.get("EXOTEL_SID", ""))
    EXOTEL_PHONE_NUMBER: str = Field(default_factory=lambda: os.environ.get("EXOTEL_PHONE_NUMBER", ""))
    
    # Telephony: Twilio (Global Fallback)
    TWILIO_ACCOUNT_SID: str = Field(default_factory=lambda: os.environ.get("TWILIO_ACCOUNT_SID", ""))
    TWILIO_AUTH_TOKEN: str = Field(default_factory=lambda: os.environ.get("TWILIO_AUTH_TOKEN", ""))
    TWILIO_PHONE_NUMBER: str = Field(default_factory=lambda: os.environ.get("TWILIO_PHONE_NUMBER", ""))
    
    # Voice AI Providers
    SARVAM_API_KEY: str = Field(default_factory=lambda: os.environ.get("SARVAM_API_KEY", ""))
    ELEVENLABS_API_KEY: str = Field(default_factory=lambda: os.environ.get("ELEVENLABS_API_KEY", ""))
    
    # Payment Gateway: Razorpay
    RAZORPAY_KEY_ID: str = Field(default_factory=lambda: os.environ.get("RAZORPAY_KEY_ID", ""))
    RAZORPAY_KEY_SECRET: str = Field(default_factory=lambda: os.environ.get("RAZORPAY_KEY_SECRET", ""))
    RAZORPAY_WEBHOOK_SECRET: str = Field(default_factory=lambda: os.environ.get("RAZORPAY_WEBHOOK_SECRET", ""))

    # WhatsApp API
    WHATSAPP_API_TOKEN: str = Field(default_factory=lambda: os.environ.get("WHATSAPP_API_TOKEN", ""))
    WHATSAPP_PHONE_NUMBER_ID: str = Field(default_factory=lambda: os.environ.get("WHATSAPP_PHONE_NUMBER_ID", ""))
    
    # Server-owned pricing catalog (in integer paise)
    RATE_STANDARD_PAISE_PER_MIN: int = 650   # ₹6.50 / min
    RATE_PREMIUM_PAISE_PER_MIN: int = 850    # ₹8.50 / min
    NUMBER_RENTAL_PAISE_PER_MONTH: int = 79900  # ₹799 / month
    CHANNEL_RENTAL_PAISE_PER_MONTH: int = 64900 # ₹649 / month
    BILLING_INCREMENT_SECONDS: int = 30     # Round up to nearest 30 seconds for connected calls

    @property
    def has_exotel(self) -> bool:
        return bool(self.EXOTEL_API_KEY and self.EXOTEL_API_TOKEN and self.EXOTEL_SID and self.EXOTEL_PHONE_NUMBER)

    @property
    def has_twilio(self) -> bool:
        return bool(self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN and self.TWILIO_PHONE_NUMBER)

    @property
    def has_razorpay(self) -> bool:
        return bool(self.RAZORPAY_KEY_ID and self.RAZORPAY_KEY_SECRET)

    @property
    def has_sarvam(self) -> bool:
        return bool(self.SARVAM_API_KEY)

    @property
    def has_elevenlabs(self) -> bool:
        return bool(self.ELEVENLABS_API_KEY)

settings = Settings()
