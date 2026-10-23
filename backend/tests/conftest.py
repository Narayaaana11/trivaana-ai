"""
TRIVAANA AI: Pytest Test Fixtures
Configures isolated temporary test database and FastAPI TestClient.
"""

import os
import tempfile
import pytest
import sqlite3
from fastapi.testclient import TestClient

# Create temp db path before importing app/settings
temp_db_fd, temp_db_path = tempfile.mkstemp(suffix="_trivaana_test.db")
os.close(temp_db_fd)
os.environ["SQLITE_DB_PATH"] = temp_db_path

from pathlib import Path
from core.config import settings
settings.DATABASE_PATH = Path(temp_db_path)
settings.SQLITE_DB_PATH = Path(temp_db_path)

from database import init_db, get_connection
from database.seed import seed_demo_data
from main import app

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_db(temp_db_path)
    conn = get_connection(temp_db_path)
    try:
        seed_demo_data(conn)
    finally:
        conn.close()
    yield
    try:
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)
    except Exception:
        pass

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def demo_auth_headers(client):
    """Authenticate as the default seeded demo enterprise tenant."""
    resp = client.post("/api/auth/login", json={
        "email": "demo@trivaana.ai",
        "password": "Trivaana@2026"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def second_tenant_auth_headers(client):
    """Register and authenticate a secondary tenant to test strict cross-tenant isolation."""
    email = "acme@example.com"
    pwd = "Password@123"
    reg_resp = client.post("/api/auth/register", json={
        "email": email,
        "password": pwd,
        "full_name": "Acme Admin",
        "company_name": "Acme Corp"
    })
    assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
    token = reg_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
