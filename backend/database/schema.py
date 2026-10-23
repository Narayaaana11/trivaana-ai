"""
TRIVAANA AI: Relational Database Schema & Migrations
Strict Integer Paise Accounting, Tenant Scoping, Foreign Keys, and Performance Indexes.
"""

import sqlite3

SCHEMA_SQL = """
-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key_hash TEXT UNIQUE NOT NULL,
    wallet_balance_paise INTEGER NOT NULL DEFAULT 500000,
    currency TEXT NOT NULL DEFAULT 'INR',
    plan TEXT NOT NULL DEFAULT 'growth',
    concurrency_limit INTEGER NOT NULL DEFAULT 10,
    created_at TEXT NOT NULL
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    full_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 3. Agents Table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    vertical TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'te-IN',
    voice_model TEXT NOT NULL DEFAULT 'Sarvam AI (bulbul:v4-flash)',
    provider TEXT NOT NULL DEFAULT 'sarvam',
    system_prompt TEXT NOT NULL,
    speech_rate REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 4. Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Hyderabad',
    vertical TEXT NOT NULL DEFAULT 'Real Estate',
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'Manual Entry',
    consent_status TEXT NOT NULL DEFAULT 'opted_in',
    opt_out INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 5. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    agent_id TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    concurrency INTEGER NOT NULL DEFAULT 5,
    total_contacts INTEGER NOT NULL DEFAULT 0,
    placed INTEGER NOT NULL DEFAULT 0,
    connected INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    demos INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 6. Campaign Jobs Table (Durable Queue)
CREATE TABLE IF NOT EXISTS campaign_jobs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    call_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- 7. Calls Table
CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    campaign_id TEXT,
    agent_id TEXT,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'outbound',
    provider TEXT NOT NULL DEFAULT 'mock',
    provider_call_id TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    billable_duration_seconds INTEGER NOT NULL DEFAULT 0,
    cost_paise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'initiated',
    language TEXT NOT NULL DEFAULT 'te-IN',
    outcome TEXT DEFAULT 'pending',
    transcript TEXT,
    recording_url TEXT,
    created_at TEXT NOT NULL,
    ended_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 8. Financial Ledger & GST Tax Invoices (Whole Integer Paise)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'credit' or 'debit'
    amount_paise INTEGER NOT NULL,
    description TEXT NOT NULL,
    invoice_id TEXT,
    running_balance_paise INTEGER NOT NULL,
    idempotency_key TEXT UNIQUE,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 9. Phone Numbers Inventory
CREATE TABLE IF NOT EXISTS phone_numbers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'exotel',
    status TEXT NOT NULL DEFAULT 'active',
    monthly_rental_paise INTEGER NOT NULL DEFAULT 79900,
    assigned_agent_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Performance & Tenant Scoping Indexes
CREATE INDEX IF NOT EXISTS idx_leads_tenant_phone ON leads(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_date ON calls(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status ON campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_lookup ON campaign_jobs(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_tx_tenant_date ON transactions(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
"""

from core.security import hash_api_key

def migrate_existing_database(conn: sqlite3.Connection):
    """Safely migrate existing database columns to integer paise and hashed API keys."""
    cur = conn.cursor()
    
    # 1. Check tenants table
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'")
    if cur.fetchone():
        cur.execute("PRAGMA table_info(tenants)")
        cols = {row[1] for row in cur.fetchall()}
        if "api_key" in cols:
            cur.execute("PRAGMA foreign_keys=OFF;")
            cur.execute("""
            CREATE TABLE IF NOT EXISTS tenants_migrated (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                api_key_hash TEXT UNIQUE NOT NULL,
                wallet_balance_paise INTEGER NOT NULL DEFAULT 500000,
                currency TEXT NOT NULL DEFAULT 'INR',
                plan TEXT NOT NULL DEFAULT 'growth',
                concurrency_limit INTEGER NOT NULL DEFAULT 10,
                created_at TEXT NOT NULL
            );
            """)
            cur.execute("SELECT id, name, api_key, wallet_balance, currency, plan, concurrency_limit, created_at FROM tenants")
            for r in cur.fetchall():
                key_hash = hash_api_key(r[2] or "demo")
                bal_paise = int(round((r[3] or 5000.0) * 100))
                cur.execute("""
                INSERT OR REPLACE INTO tenants_migrated (id, name, api_key_hash, wallet_balance_paise, currency, plan, concurrency_limit, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (r[0], r[1], key_hash, bal_paise, r[4] or 'INR', r[5] or 'growth', r[6] or 10, r[7]))
            cur.execute("DROP TABLE tenants")
            cur.execute("ALTER TABLE tenants_migrated RENAME TO tenants")
            cur.execute("PRAGMA foreign_keys=ON;")
        elif "wallet_balance_paise" not in cols:
            cur.execute("ALTER TABLE tenants ADD COLUMN wallet_balance_paise INTEGER DEFAULT 500000")
            if "wallet_balance" in cols:
                cur.execute("UPDATE tenants SET wallet_balance_paise = CAST(ROUND(wallet_balance * 100) AS INTEGER)")

    # 2. Check calls table
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='calls'")
    if cur.fetchone():
        cur.execute("PRAGMA table_info(calls)")
        cols = {row[1] for row in cur.fetchall()}
        if "campaign_id" not in cols:
            cur.execute("ALTER TABLE calls ADD COLUMN campaign_id TEXT")
        if "agent_id" not in cols:
            cur.execute("ALTER TABLE calls ADD COLUMN agent_id TEXT")
        if "duration_seconds" not in cols:
            cur.execute("ALTER TABLE calls ADD COLUMN duration_seconds INTEGER DEFAULT 0")
            if "duration" in cols:
                cur.execute("UPDATE calls SET duration_seconds = duration")
        if "billable_duration_seconds" not in cols:
            cur.execute("ALTER TABLE calls ADD COLUMN billable_duration_seconds INTEGER DEFAULT 0")
            if "duration" in cols:
                cur.execute("UPDATE calls SET billable_duration_seconds = duration")
        if "cost_paise" not in cols:
            cur.execute("ALTER TABLE calls ADD COLUMN cost_paise INTEGER DEFAULT 0")
            if "cost" in cols:
                cur.execute("UPDATE calls SET cost_paise = CAST(ROUND(cost * 100) AS INTEGER)")
        if "provider" not in cols:
            cur.execute("ALTER TABLE calls ADD COLUMN provider TEXT DEFAULT 'mock'")
        if "provider_call_id" not in cols:
            cur.execute("ALTER TABLE calls ADD COLUMN provider_call_id TEXT")
        if "ended_at" not in cols:
            cur.execute("ALTER TABLE calls ADD COLUMN ended_at TEXT")

    # 3. Check campaigns table
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='campaigns'")
    if cur.fetchone():
        cur.execute("PRAGMA table_info(campaigns)")
        cols = {row[1] for row in cur.fetchall()}
        if "agent_id" not in cols:
            cur.execute("ALTER TABLE campaigns ADD COLUMN agent_id TEXT")
        if "failed" not in cols:
            cur.execute("ALTER TABLE campaigns ADD COLUMN failed INTEGER DEFAULT 0")

    # 3. Check leads table
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'")
    if cur.fetchone():
        cur.execute("PRAGMA table_info(leads)")
        cols = {row[1] for row in cur.fetchall()}
        if "consent_status" not in cols:
            cur.execute("ALTER TABLE leads ADD COLUMN consent_status TEXT DEFAULT 'opted_in'")
        if "opt_out" not in cols:
            cur.execute("ALTER TABLE leads ADD COLUMN opt_out INTEGER DEFAULT 0")

    # 4. Check agents table
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='agents'")
    if cur.fetchone():
        cur.execute("PRAGMA table_info(agents)")
        cols = {row[1] for row in cur.fetchall()}
        if "provider" not in cols:
            cur.execute("ALTER TABLE agents ADD COLUMN provider TEXT DEFAULT 'sarvam'")
        if "speech_rate" not in cols:
            cur.execute("ALTER TABLE agents ADD COLUMN speech_rate REAL DEFAULT 1.0")
        if "updated_at" not in cols:
            cur.execute("ALTER TABLE agents ADD COLUMN updated_at TEXT")
            cur.execute("UPDATE agents SET updated_at = created_at")

    # 5. Check transactions table
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'")
    if cur.fetchone():
        cur.execute("PRAGMA table_info(transactions)")
        cols = {row[1] for row in cur.fetchall()}
        if "running_balance_paise" not in cols:
            cur.execute("ALTER TABLE transactions ADD COLUMN running_balance_paise INTEGER DEFAULT 0")
            if "running_balance" in cols:
                cur.execute("UPDATE transactions SET running_balance_paise = CAST(ROUND(running_balance * 100) AS INTEGER)")
        if "idempotency_key" not in cols:
            cur.execute("ALTER TABLE transactions ADD COLUMN idempotency_key TEXT")

    conn.commit()

def create_tables(conn: sqlite3.Connection):
    """Execute migration and DDL creation for all tables and indexes."""
    migrate_existing_database(conn)
    conn.executescript(SCHEMA_SQL)
    conn.commit()
