"""
TRIVAANA AI: Authenticated Envelope Encryption Vault (Fernet / KMS-Ready)
Encrypts tenant BYOK secrets, platform provider credentials, and webhook signing secrets at rest.
"""

import base64
import hashlib
import json
from typing import Any, Dict
from cryptography.fernet import Fernet, InvalidToken
from core.config import settings


def _derive_fernet_key() -> bytes:
    """Derive a 32-byte URL-safe base64 Fernet key from ENCRYPTION_MASTER_KEY or JWT_SECRET in dev."""
    raw_secret = settings.ENCRYPTION_MASTER_KEY or f"dev-vault:{settings.JWT_SECRET}"
    digest = hashlib.sha256(raw_secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_secret(plaintext: str) -> str:
    if not plaintext:
        return ""
    if plaintext.startswith("enc:v1:"):
        return plaintext
    f = Fernet(_derive_fernet_key())
    token = f.encrypt(plaintext.encode("utf-8")).decode("ascii")
    return f"enc:v1:{token}"


def decrypt_secret(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    if not ciphertext.startswith("enc:v1:"):
        # Legacy plaintext backward compatibility
        return ciphertext
    token = ciphertext[len("enc:v1:"):].encode("ascii")
    f = Fernet(_derive_fernet_key())
    try:
        return f.decrypt(token).decode("utf-8")
    except InvalidToken:
        return ""


def encrypt_config_json(cfg: Dict[str, Any]) -> str:
    """Encrypt sensitive fields inside integration/provider config JSON payloads."""
    if not cfg:
        return "{}"
    envelope = {
        "_encrypted": True,
        "v": 1,
        "ciphertext": encrypt_secret(json.dumps(cfg, separators=(",", ":"))),
    }
    return json.dumps(envelope)


def decrypt_config_json(raw_json: str) -> Dict[str, Any]:
    """Decrypt integration/provider config JSON, preserving backward compatibility with legacy plaintext."""
    if not raw_json:
        return {}
    try:
        parsed = json.loads(raw_json)
    except Exception:
        return {}
    if isinstance(parsed, dict) and parsed.get("_encrypted") and parsed.get("ciphertext"):
        plain = decrypt_secret(str(parsed["ciphertext"]))
        if not plain:
            return {}
        try:
            decoded = json.loads(plain)
            return decoded if isinstance(decoded, dict) else {}
        except Exception:
            return {}
    return parsed if isinstance(parsed, dict) else {}

