"""
TRIVAANA AI: Application Configuration & Environment Settings
Strict separation of secrets, environment-driven defaults, and CORS controls.
"""

import os
from pathlib import Path
import sys
from typing import List
from pydantic import BaseModel, Field, model_validator

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
_LOCAL_DEPS_DIR = BASE_DIR / ".deps"
if _LOCAL_DEPS_DIR.is_dir() and str(_LOCAL_DEPS_DIR) not in sys.path:
    sys.path.append(str(_LOCAL_DEPS_DIR))
DATA_DIR = Path(os.environ.get("TRIVAANA_DATA_DIR", str(Path.home() / ".trivaana")))
os.makedirs(str(DATA_DIR), exist_ok=True)
STORAGE_DIR = DATA_DIR / "storage"
os.makedirs(str(STORAGE_DIR), exist_ok=True)


def _load_dotenv_files() -> None:
    """Load environment variables from .env / .env.local files without overriding OS env."""
    candidates = [
        PROJECT_ROOT / ".env",
        PROJECT_ROOT / ".env.local",
        BASE_DIR / ".env",
        BASE_DIR / ".env.local",
    ]
    for env_path in candidates:
        if not env_path.is_file():
            continue
        try:
            for raw_line in env_path.read_text(encoding="utf-8").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                if line.startswith("export "):
                    line = line[7:].strip()
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
        except OSError:
            continue


_load_dotenv_files()


class Settings(BaseModel):
    # Server Host & Port
    HOST: str = Field(default_factory=lambda: os.environ.get("HOST", "0.0.0.0"))
    PORT: int = Field(default_factory=lambda: int(os.environ.get("PORT", "8000")))

    # Environment
    ENVIRONMENT: str = Field(default_factory=lambda: os.environ.get("ENVIRONMENT", "development"))
    DEBUG: bool = Field(default_factory=lambda: os.environ.get("DEBUG", "true").lower() in ("true", "1"))
    PUBLIC_BASE_URL: str = Field(
        default_factory=lambda: os.environ.get("APP_BASE_URL") or os.environ.get("PUBLIC_BASE_URL", "https://api.trivaana.ai")
    )
    APP_BASE_URL: str = Field(
        default_factory=lambda: os.environ.get("APP_BASE_URL") or os.environ.get("PUBLIC_BASE_URL", "https://api.trivaana.ai")
    )
    FRONTEND_URL: str = Field(default_factory=lambda: os.environ.get("FRONTEND_URL", "http://localhost:5173"))

    # Demo & Testing Flags
    ALLOW_DEMO_SEEDING: bool = Field(default_factory=lambda: os.environ.get("ALLOW_DEMO_SEEDING", "false").lower() in ("true", "1"))
    ALLOW_SANDBOX_TOPUP: bool = Field(default_factory=lambda: os.environ.get("ALLOW_SANDBOX_TOPUP", "false").lower() in ("true", "1"))
    ALLOW_WELCOME_CREDIT: bool = Field(
        default_factory=lambda: (
            os.environ.get("ALLOW_WELCOME_CREDIT", "").lower() in ("true", "1")
            if os.environ.get("ENVIRONMENT", "development").lower() in ("production", "prod")
            else os.environ.get("ALLOW_WELCOME_CREDIT", "true").lower() in ("true", "1")
        )
    )

    # Database & Cache (tunable for high-concurrency workloads)
    DATABASE_URL: str = Field(default_factory=lambda: os.environ.get("DATABASE_URL", ""))
    DATABASE_PATH: Path = Field(default_factory=lambda: Path(os.environ.get("DATABASE_PATH", str(DATA_DIR / "trivaana_saas.db"))))
    SQLITE_DB_PATH: Path = Field(default_factory=lambda: Path(os.environ.get("SQLITE_DB_PATH", str(DATA_DIR / "trivaana_saas.db"))))
    PG_POOL_MIN_SIZE: int = Field(default_factory=lambda: int(os.environ.get("PG_POOL_MIN_SIZE", "5")))
    PG_POOL_MAX_SIZE: int = Field(default_factory=lambda: int(os.environ.get("PG_POOL_MAX_SIZE", "50")))
    PG_POOL_TIMEOUT: float = Field(default_factory=lambda: float(os.environ.get("PG_POOL_TIMEOUT", "5.0")))
    REDIS_URL: str = Field(default_factory=lambda: os.environ.get("REDIS_URL", ""))

    # Object Storage (S3-compatible or local fallback)
    STORAGE_ENDPOINT: str = Field(default_factory=lambda: os.environ.get("STORAGE_ENDPOINT", ""))
    STORAGE_ACCESS_KEY: str = Field(default_factory=lambda: os.environ.get("STORAGE_ACCESS_KEY", ""))
    STORAGE_SECRET_KEY: str = Field(default_factory=lambda: os.environ.get("STORAGE_SECRET_KEY", ""))
    STORAGE_BUCKET: str = Field(default_factory=lambda: os.environ.get("STORAGE_BUCKET", "trivaana-media"))
    LOCAL_STORAGE_PATH: Path = Field(default_factory=lambda: Path(os.environ.get("LOCAL_STORAGE_PATH", str(STORAGE_DIR))))

    # Security, Auth & Encryption
    JWT_SECRET: str = Field(default_factory=lambda: os.environ.get("JWT_SECRET", "trivaana-dev-secret-key-change-in-production-981a27e"))
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours
    ENCRYPTION_MASTER_KEY: str = Field(default_factory=lambda: os.environ.get("ENCRYPTION_MASTER_KEY", ""))
    TRUSTED_PROXY_CIDRS: str = Field(default_factory=lambda: os.environ.get("TRUSTED_PROXY_CIDRS", "127.0.0.1/32,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"))
    OIDC_ISSUER: str = Field(default_factory=lambda: os.environ.get("OIDC_ISSUER", ""))
    OIDC_AUDIENCE: str = Field(default_factory=lambda: os.environ.get("OIDC_AUDIENCE", ""))
    OIDC_JWKS_URL: str = Field(default_factory=lambda: os.environ.get("OIDC_JWKS_URL", ""))

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

    # AI & LLM Reasoning (Provider-independent: Gemini primary + OpenAI fallback)
    GEMINI_API_KEY: str = Field(default_factory=lambda: os.environ.get("GEMINI_API_KEY", ""))
    GEMINI_MODEL: str = Field(default_factory=lambda: os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
    GEMINI_EMBEDDING_MODEL: str = Field(default_factory=lambda: os.environ.get("GEMINI_EMBEDDING_MODEL", "text-embedding-004"))
    OPENAI_API_KEY: str = Field(default_factory=lambda: os.environ.get("OPENAI_API_KEY", ""))
    OPENAI_MODEL: str = Field(default_factory=lambda: os.environ.get("OPENAI_MODEL", "gpt-4o-mini"))
    OPENAI_EMBEDDING_MODEL: str = Field(default_factory=lambda: os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"))
    DEEPGRAM_API_KEY: str = Field(default_factory=lambda: os.environ.get("DEEPGRAM_API_KEY", ""))

    # Workflow & Observability
    TEMPORAL_ADDRESS: str = Field(default_factory=lambda: os.environ.get("TEMPORAL_ADDRESS", ""))
    TEMPORAL_NAMESPACE: str = Field(default_factory=lambda: os.environ.get("TEMPORAL_NAMESPACE", "default"))
    SENTRY_DSN: str = Field(default_factory=lambda: os.environ.get("SENTRY_DSN", ""))
    LANGFUSE_PUBLIC_KEY: str = Field(default_factory=lambda: os.environ.get("LANGFUSE_PUBLIC_KEY", ""))
    LANGFUSE_SECRET_KEY: str = Field(default_factory=lambda: os.environ.get("LANGFUSE_SECRET_KEY", ""))
    LANGFUSE_HOST: str = Field(default_factory=lambda: os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"))

    # LiveKit Real-Time Voice Framework
    LIVEKIT_URL: str = Field(default_factory=lambda: os.environ.get("LIVEKIT_URL", ""))
    LIVEKIT_API_KEY: str = Field(default_factory=lambda: os.environ.get("LIVEKIT_API_KEY", ""))
    LIVEKIT_API_SECRET: str = Field(default_factory=lambda: os.environ.get("LIVEKIT_API_SECRET", ""))
    LIVEKIT_SIP_CONFIG: str = Field(default_factory=lambda: os.environ.get("LIVEKIT_SIP_CONFIG", ""))

    # Telephony: Exotel (India)
    EXOTEL_API_KEY: str = Field(default_factory=lambda: os.environ.get("EXOTEL_API_KEY", ""))
    EXOTEL_API_TOKEN: str = Field(default_factory=lambda: os.environ.get("EXOTEL_API_TOKEN", ""))
    EXOTEL_SUBDOMAIN: str = Field(default_factory=lambda: os.environ.get("EXOTEL_SUBDOMAIN", "api.exotel.com"))
    EXOTEL_SID: str = Field(default_factory=lambda: os.environ.get("EXOTEL_SID", ""))
    EXOTEL_PHONE_NUMBER: str = Field(default_factory=lambda: os.environ.get("EXOTEL_PHONE_NUMBER", ""))

    # Telephony: Twilio (Global Fallback)
    TWILIO_ACCOUNT_SID: str = Field(default_factory=lambda: os.environ.get("TWILIO_ACCOUNT_SID", ""))
    TWILIO_AUTH_TOKEN: str = Field(default_factory=lambda: os.environ.get("TWILIO_AUTH_TOKEN", ""))
    TWILIO_PHONE_NUMBER: str = Field(default_factory=lambda: os.environ.get("TWILIO_PHONE_NUMBER", ""))

    # Telephony: Plivo & Vobiz (Indian & Global SIP/PSTN)
    PLIVO_AUTH_ID: str = Field(default_factory=lambda: os.environ.get("PLIVO_AUTH_ID", ""))
    PLIVO_AUTH_TOKEN: str = Field(default_factory=lambda: os.environ.get("PLIVO_AUTH_TOKEN", ""))
    PLIVO_PHONE_NUMBER: str = Field(default_factory=lambda: os.environ.get("PLIVO_PHONE_NUMBER", ""))

    VOBIZ_AUTH_ID: str = Field(default_factory=lambda: os.environ.get("VOBIZ_AUTH_ID", ""))
    VOBIZ_AUTH_TOKEN: str = Field(default_factory=lambda: os.environ.get("VOBIZ_AUTH_TOKEN", ""))
    VOBIZ_PHONE_NUMBER: str = Field(default_factory=lambda: os.environ.get("VOBIZ_PHONE_NUMBER", ""))

    # Transactional SMTP (Password Reset & Email Verification)
    SMTP_HOST: str = Field(default_factory=lambda: os.environ.get("SMTP_HOST", ""))
    SMTP_PORT: int = Field(default_factory=lambda: int(os.environ.get("SMTP_PORT", "587")))
    SMTP_USER: str = Field(default_factory=lambda: os.environ.get("SMTP_USER", ""))
    SMTP_PASSWORD: str = Field(default_factory=lambda: os.environ.get("SMTP_PASSWORD", ""))
    SMTP_FROM_EMAIL: str = Field(default_factory=lambda: os.environ.get("SMTP_FROM_EMAIL", "no-reply@trivaana.ai"))
    SMTP_USE_TLS: bool = Field(default_factory=lambda: os.environ.get("SMTP_USE_TLS", "true").lower() in ("true", "1"))

    # Voice AI Providers
    SARVAM_API_KEY: str = Field(default_factory=lambda: os.environ.get("SARVAM_API_KEY", ""))
    ELEVENLABS_API_KEY: str = Field(default_factory=lambda: os.environ.get("ELEVENLABS_API_KEY", ""))
    INDICF5_ENDPOINT: str = Field(default_factory=lambda: os.environ.get("INDICF5_ENDPOINT", ""))

    # Payment Gateway: Razorpay
    RAZORPAY_KEY_ID: str = Field(default_factory=lambda: os.environ.get("RAZORPAY_KEY_ID", ""))
    RAZORPAY_KEY_SECRET: str = Field(default_factory=lambda: os.environ.get("RAZORPAY_KEY_SECRET", ""))
    RAZORPAY_WEBHOOK_SECRET: str = Field(default_factory=lambda: os.environ.get("RAZORPAY_WEBHOOK_SECRET", ""))

    # WhatsApp API (supports both WHATSAPP_ACCESS_TOKEN and legacy WHATSAPP_API_TOKEN)
    WHATSAPP_ACCESS_TOKEN: str = Field(
        default_factory=lambda: os.environ.get("WHATSAPP_ACCESS_TOKEN") or os.environ.get("WHATSAPP_API_TOKEN", "")
    )
    WHATSAPP_API_TOKEN: str = Field(
        default_factory=lambda: os.environ.get("WHATSAPP_API_TOKEN") or os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
    )
    WHATSAPP_PHONE_NUMBER_ID: str = Field(default_factory=lambda: os.environ.get("WHATSAPP_PHONE_NUMBER_ID", ""))

    # Google OAuth (Calendar / Sheets)
    GOOGLE_CLIENT_ID: str = Field(default_factory=lambda: os.environ.get("GOOGLE_CLIENT_ID", ""))
    GOOGLE_CLIENT_SECRET: str = Field(default_factory=lambda: os.environ.get("GOOGLE_CLIENT_SECRET", ""))

    # Indian Legal, DPDP Act 2023 & Startup Entity Disclosure
    COMPANY_LEGAL_NAME: str = Field(default_factory=lambda: os.environ.get("COMPANY_LEGAL_NAME", "Trivaana AI"))
    COMPANY_ENTITY_STATUS: str = Field(default_factory=lambda: os.environ.get("COMPANY_ENTITY_STATUS", "pre_incorporation_beta"))
    COMPANY_GSTIN: str = Field(default_factory=lambda: os.environ.get("COMPANY_GSTIN", ""))
    COMPANY_JURISDICTION: str = Field(default_factory=lambda: os.environ.get("COMPANY_JURISDICTION", "Hyderabad, Telangana, India"))
    GRIEVANCE_OFFICER_NAME: str = Field(default_factory=lambda: os.environ.get("GRIEVANCE_OFFICER_NAME", "Grievance Officer, Trivaana AI"))
    GRIEVANCE_OFFICER_EMAIL: str = Field(default_factory=lambda: os.environ.get("GRIEVANCE_OFFICER_EMAIL", "grievance@trivaana.ai"))
    NCPR_API_URL: str = Field(default_factory=lambda: os.environ.get("NCPR_API_URL", ""))
    NCPR_API_KEY: str = Field(default_factory=lambda: os.environ.get("NCPR_API_KEY", ""))

    # Server-owned pricing catalog defaults (in integer paise)
    RATE_STANDARD_PAISE_PER_MIN: int = 650    # ₹6.50 / min
    RATE_PREMIUM_PAISE_PER_MIN: int = 850     # ₹8.50 / min
    BROADCAST_PAISE_PER_CALL: int = 120       # ₹1.20 / broadcast attempt
    NUMBER_RENTAL_PAISE_PER_MONTH: int = 79900  # ₹799 / month
    CHANNEL_RENTAL_PAISE_PER_MONTH: int = 64900 # ₹649 / month
    BILLING_INCREMENT_SECONDS: int = 30       # Round up to nearest 30 seconds for connected calls

    @property
    def has_gemini(self) -> bool:
        return bool(self.GEMINI_API_KEY)

    @property
    def has_openai(self) -> bool:
        return bool(self.OPENAI_API_KEY)

    @property
    def has_deepgram(self) -> bool:
        return bool(self.DEEPGRAM_API_KEY)

    @property
    def has_oidc(self) -> bool:
        return bool(self.OIDC_ISSUER and self.OIDC_JWKS_URL)

    @property
    def has_temporal(self) -> bool:
        return bool(self.TEMPORAL_ADDRESS)

    @property
    def has_langfuse(self) -> bool:
        return bool(self.LANGFUSE_PUBLIC_KEY and self.LANGFUSE_SECRET_KEY)

    @property
    def has_livekit(self) -> bool:
        return bool(self.LIVEKIT_URL and self.LIVEKIT_API_KEY and self.LIVEKIT_API_SECRET)

    @property
    def has_exotel(self) -> bool:
        return bool(self.EXOTEL_API_KEY and self.EXOTEL_API_TOKEN and self.EXOTEL_SID and self.EXOTEL_PHONE_NUMBER)

    @property
    def has_twilio(self) -> bool:
        return bool(self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN and self.TWILIO_PHONE_NUMBER)

    @property
    def has_plivo(self) -> bool:
        return bool(self.PLIVO_AUTH_ID and self.PLIVO_AUTH_TOKEN and self.PLIVO_PHONE_NUMBER)

    @property
    def has_vobiz(self) -> bool:
        return bool(self.VOBIZ_AUTH_ID and self.VOBIZ_AUTH_TOKEN and self.VOBIZ_PHONE_NUMBER)

    @property
    def has_smtp(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_FROM_EMAIL)

    @property
    def has_razorpay(self) -> bool:
        return bool(self.RAZORPAY_KEY_ID and self.RAZORPAY_KEY_SECRET)

    @property
    def has_sarvam(self) -> bool:
        return bool(self.SARVAM_API_KEY)

    @property
    def has_elevenlabs(self) -> bool:
        return bool(self.ELEVENLABS_API_KEY)

    @property
    def has_indicf5(self) -> bool:
        return bool(self.INDICF5_ENDPOINT)

    @property
    def has_whatsapp(self) -> bool:
        return bool((self.WHATSAPP_ACCESS_TOKEN or self.WHATSAPP_API_TOKEN) and self.WHATSAPP_PHONE_NUMBER_ID)

    @property
    def has_google_oauth(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)

    @property
    def has_s3_storage(self) -> bool:
        return bool(self.STORAGE_ENDPOINT and self.STORAGE_ACCESS_KEY and self.STORAGE_SECRET_KEY)

    @property
    def has_redis(self) -> bool:
        return bool(self.REDIS_URL)

    @property
    def has_postgres(self) -> bool:
        return bool(self.DATABASE_URL and self.DATABASE_URL.startswith(("postgres://", "postgresql://")))

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.ENVIRONMENT.lower() in ("production", "prod"):
            known_dev_secrets = {
                "trivaana-dev-secret-key-change-in-production-981a27e",
                "trivaana-dev-compose-jwt-secret-change-me-32chars",
                "trivaana-dev-compose-vault-key-change-me",
                "secret",
                "changeme",
                "jwtsecret",
                "development",
                "admin",
            }
            if not self.JWT_SECRET or len(self.JWT_SECRET) < 32 or self.JWT_SECRET.lower() in known_dev_secrets:
                raise ValueError(
                    "FATAL SECURITY VIOLATION: Production startup rejected because JWT_SECRET is missing, "
                    "shorter than 32 characters, or set to a known development default."
                )
            if (
                not self.ENCRYPTION_MASTER_KEY
                or len(self.ENCRYPTION_MASTER_KEY) < 32
                or self.ENCRYPTION_MASTER_KEY.lower() in known_dev_secrets
            ):
                raise ValueError(
                    "FATAL SECURITY VIOLATION: Production startup rejected because ENCRYPTION_MASTER_KEY is missing, "
                    "shorter than 32 characters, or set to a known development default."
                )
        return self


settings = Settings()
