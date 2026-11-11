"""
TRIVAANA AI: Cryptographic Security & JWT Token Management
PBKDF2-HMAC-SHA256 password hashing and JWT tenant authentication.
"""

import hmac
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from core.config import settings

def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with 600,000 iterations."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        600_000
    )
    return f"{salt}:{key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password in constant time to prevent timing attacks."""
    try:
        salt, expected_hex = hashed_password.split(":")
        key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            600_000
        )
        return hmac.compare_digest(key.hex(), expected_hex)
    except Exception:
        return False

def hash_api_key(api_key: str) -> str:
    """Hash an API key using SHA-256 for secure database storage."""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate a signed JWT access token containing user, tenant, and jti claims."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.setdefault("jti", secrets.token_hex(8))
    to_encode.setdefault("token_version", 1)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a local JWT or OIDC access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        if settings.has_oidc:
            return verify_oidc_token(token)
        return None


def verify_oidc_token(token: str) -> Optional[Dict[str, Any]]:
    """Validate an external OIDC/Keycloak RS256/ES256 token against configured JWKS."""
    if not settings.has_oidc:
        return None
    try:
        jwk_client = jwt.PyJWKClient(settings.OIDC_JWKS_URL)
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        decode_kwargs: Dict[str, Any] = {
            "algorithms": ["RS256", "ES256"],
            "issuer": settings.OIDC_ISSUER,
        }
        if settings.OIDC_AUDIENCE:
            decode_kwargs["audience"] = settings.OIDC_AUDIENCE
        return jwt.decode(token, signing_key.key, **decode_kwargs)
    except Exception:
        return None
