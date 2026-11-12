"""
TRIVAANA AI: Sprint F Regression Tests — No Dummy Data, Auth Security & 10k-Scale Hardening
Verifies:
1. Zero dummy/demo seeding by default (even in non-production environments) unless ALLOW_DEMO_SEEDING=true.
2. Hardened HTTP security headers + Cache-Control: no-store on /api/auth/* routes.
3. Fail-closed production JWT_SECRET and ENCRYPTION_MASTER_KEY enforcement.
4. Tunable PostgreSQL connection pool sizing for high concurrency.
"""

import tempfile
import os
import pytest
from fastapi.testclient import TestClient

from main import app
from core.config import Settings, settings
from database import init_db, get_connection
from database.seed import seed_demo_data


client = TestClient(app)


def test_zero_dummy_data_seeded_when_allow_demo_seeding_disabled(monkeypatch):
    """Even in development, seed_demo_data must insert zero demo tenants/users/leads when ALLOW_DEMO_SEEDING is False."""
    fd, db_path = tempfile.mkstemp(suffix="_nodemo.db")
    os.close(fd)
    try:
        monkeypatch.setattr(settings, "ENVIRONMENT", "development")
        monkeypatch.setattr(settings, "ALLOW_DEMO_SEEDING", False)
        init_db(db_path)

        conn = get_connection(db_path)
        try:
            seed_demo_data(conn)
            cur = conn.cursor()
            assert cur.execute("SELECT COUNT(*) FROM tenants").fetchone()[0] == 0
            assert cur.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
            assert cur.execute("SELECT COUNT(*) FROM leads").fetchone()[0] == 0
            assert cur.execute("SELECT COUNT(*) FROM calls").fetchone()[0] == 0
        finally:
            conn.close()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


def test_security_headers_and_auth_no_store():
    """Verify SecurityHeadersMiddleware attaches security headers and prevents caching of auth endpoints."""
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.headers.get("X-Content-Type-Options") == "nosniff"
    assert health_res.headers.get("X-Frame-Options") == "DENY"
    assert health_res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "Permissions-Policy" in health_res.headers

    auth_res = client.post("/api/auth/login", json={"email": "nonexistent@trivaana.ai", "password": "wrong"})
    assert auth_res.status_code == 401
    assert auth_res.headers.get("Cache-Control") == "no-store"


def test_production_rejects_default_or_short_secrets():
    """Production mode must fail closed if JWT_SECRET or ENCRYPTION_MASTER_KEY is missing, short, or dev default."""
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET="trivaana-dev-secret-key-change-in-production-981a27e",
            ENCRYPTION_MASTER_KEY="a" * 32,
        )

    with pytest.raises(ValueError, match="ENCRYPTION_MASTER_KEY"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET="prod-strong-random-jwt-secret-key-at-least-32-chars",
            ENCRYPTION_MASTER_KEY="short",
        )


def test_high_concurrency_pool_settings_defaults():
    """Verify tunable high-concurrency PostgreSQL pool settings exist on Settings."""
    assert settings.PG_POOL_MIN_SIZE >= 5
    assert settings.PG_POOL_MAX_SIZE >= 50
    assert settings.PG_POOL_TIMEOUT >= 2.0
