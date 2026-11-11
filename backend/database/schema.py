"""
TRIVAANA AI: Relational Database Schema & Migrations
Strict Integer Paise Accounting, Multi-Tenant Scoping, Foreign Keys, and Performance Indexes.
Covers all 26 platform modules with PostgreSQL/pgvector parity.
"""

import sqlite3
from core.security import hash_api_key

SCHEMA_SQL = """
-- 1. Tenants (Workspaces / Organizations) Table
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key_hash TEXT UNIQUE NOT NULL,
    wallet_balance_paise INTEGER NOT NULL DEFAULT 500000,
    currency TEXT NOT NULL DEFAULT 'INR',
    plan TEXT NOT NULL DEFAULT 'growth',
    concurrency_limit INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'active',
    gstin TEXT,
    billing_email TEXT,
    low_balance_threshold_paise INTEGER NOT NULL DEFAULT 50000,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    staff_role TEXT,
    full_name TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 1,
    is_super_admin INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    token_version INTEGER NOT NULL DEFAULT 1,
    avatar_url TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 2b. Workspace Members & Invitations (RBAC: owner, admin, manager, operator, viewer)
CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'operator',
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'invited', 'suspended'
    invite_token TEXT,
    invited_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 2c. Password Resets & Email Verifications
CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_type TEXT NOT NULL, -- 'password_reset', 'email_verify'
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2d. Tenant API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    scopes_json TEXT NOT NULL DEFAULT '["*"]',
    last_used_at TEXT,
    revoked_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 3. AI Employees (Agents) Table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT,
    intake_secret_hash TEXT,
    vertical TEXT NOT NULL DEFAULT 'Real Estate',
    business_name TEXT,
    designation TEXT DEFAULT 'AI Voice Specialist',
    objective TEXT,
    calling_purpose TEXT DEFAULT 'lead_qualification',
    call_direction TEXT NOT NULL DEFAULT 'outbound', -- 'outbound', 'inbound', 'both'
    language TEXT NOT NULL DEFAULT 'te-IN',
    voice_model TEXT NOT NULL DEFAULT 'Sarvam AI (bulbul:v4-flash)',
    voice_id TEXT DEFAULT 'meera',
    voice_gender TEXT DEFAULT 'female',
    provider TEXT NOT NULL DEFAULT 'sarvam',
    speaking_style TEXT DEFAULT 'warm_professional',
    personality TEXT DEFAULT 'courteous, concise, helpful',
    greeting_message TEXT,
    system_prompt TEXT NOT NULL,
    conversation_instructions TEXT,
    questions_json TEXT DEFAULT '[]',
    extraction_schema_json TEXT DEFAULT '[]',
    qualification_criteria TEXT,
    appointment_requirements TEXT,
    call_ending_conditions TEXT,
    escalation_conditions TEXT,
    never_say_json TEXT DEFAULT '[]',
    never_do_json TEXT DEFAULT '[]',
    structured_config_json TEXT DEFAULT '{}',
    calling_hours_json TEXT DEFAULT '{"start":"10:00","end":"18:00","timezone":"Asia/Kolkata"}',
    caller_memory_enabled INTEGER NOT NULL DEFAULT 0,
    recording_disclosure_enabled INTEGER NOT NULL DEFAULT 1,
    transfer_number TEXT,
    post_call_webhook_url TEXT,
    speech_rate REAL NOT NULL DEFAULT 1.0,
    stability REAL NOT NULL DEFAULT 0.6,
    status TEXT NOT NULL DEFAULT 'active', -- 'draft', 'testing', 'published', 'active', 'paused', 'archived'
    current_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 3b. Agent Prompt & Config Versions
CREATE TABLE IF NOT EXISTS agent_versions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    system_prompt TEXT NOT NULL,
    structured_config_json TEXT NOT NULL DEFAULT '{}',
    change_note TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 3c. Voice Profiles Registry
CREATE TABLE IF NOT EXISTS voice_profiles (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL, -- 'openai', 'elevenlabs', 'sarvam', 'indicf5'
    provider_voice_id TEXT NOT NULL,
    name TEXT NOT NULL,
    language TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'neutral',
    quality_tier TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'premium'
    description TEXT,
    default_speed REAL NOT NULL DEFAULT 1.0,
    default_stability REAL NOT NULL DEFAULT 0.6,
    supports_ssml INTEGER NOT NULL DEFAULT 0,
    verified_status TEXT NOT NULL DEFAULT 'untested', -- 'verified', 'sandbox_only', 'untested', 'failed'
    last_tested_at TEXT,
    created_at TEXT NOT NULL
);

-- 4. Leads & Contacts Table
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    city TEXT NOT NULL DEFAULT 'Hyderabad',
    vertical TEXT NOT NULL DEFAULT 'Real Estate',
    status TEXT NOT NULL DEFAULT 'pending', -- legacy: pending, qualified, contacted, converted
    lead_status TEXT NOT NULL DEFAULT 'new', -- new, contacted, interested, not_interested, callback_required, converted, do_not_call
    source TEXT NOT NULL DEFAULT 'Manual Entry',
    consent_status TEXT NOT NULL DEFAULT 'opted_in',
    call_category TEXT NOT NULL DEFAULT 'service', -- 'service', 'transactional', 'promotional'
    opt_out INTEGER NOT NULL DEFAULT 0,
    tags_json TEXT NOT NULL DEFAULT '[]',
    custom_fields_json TEXT NOT NULL DEFAULT '{}',
    follow_up_at TEXT,
    callback_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 4b. Contact Lists
CREATE TABLE IF NOT EXISTS contact_lists (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    list_type TEXT NOT NULL DEFAULT 'reusable', -- 'reusable', 'suppression'
    description TEXT,
    contact_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_list_members (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 5. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    agent_id TEXT,
    list_id TEXT,
    suppression_list_id TEXT,
    campaign_type TEXT NOT NULL DEFAULT 'bulk', -- 'bulk', 'instant'
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled', 'halted', 'idle'
    concurrency INTEGER NOT NULL DEFAULT 5,
    calling_hours_json TEXT DEFAULT '{"start":"10:00","end":"18:00","timezone":"Asia/Kolkata"}',
    calling_days_json TEXT DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat"]',
    retry_attempts INTEGER NOT NULL DEFAULT 2,
    retry_delay_minutes INTEGER NOT NULL DEFAULT 30,
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    total_contacts INTEGER NOT NULL DEFAULT 0,
    placed INTEGER NOT NULL DEFAULT 0,
    connected INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    demos INTEGER NOT NULL DEFAULT 0,
    interested_count INTEGER NOT NULL DEFAULT 0,
    not_interested_count INTEGER NOT NULL DEFAULT 0,
    callback_count INTEGER NOT NULL DEFAULT 0,
    no_answer_count INTEGER NOT NULL DEFAULT 0,
    is_sandbox INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 6. Campaign Jobs / Contacts Table (Durable Queue)
CREATE TABLE IF NOT EXISTS campaign_jobs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    custom_fields_json TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, queued, calling, connected, interested, not_interested, callback_requested, no_answer, busy, invalid_number, failed, completed, skipped, cancelled
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 2,
    next_retry_at TEXT,
    last_error TEXT,
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
    lead_id TEXT,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'outbound', -- 'outbound', 'inbound'
    call_category TEXT NOT NULL DEFAULT 'service', -- 'service', 'transactional', 'promotional'
    provider TEXT NOT NULL DEFAULT 'mock',
    provider_call_id TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    billable_duration_seconds INTEGER NOT NULL DEFAULT 0,
    cost_paise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'initiated',
    language TEXT NOT NULL DEFAULT 'te-IN',
    outcome TEXT DEFAULT 'pending',
    summary TEXT,
    sentiment TEXT DEFAULT 'neutral', -- 'positive', 'neutral', 'negative'
    extracted_data_json TEXT DEFAULT '{}',
    transcript TEXT,
    recording_url TEXT,
    is_sandbox INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER,
    recording_disclosure_played INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    ended_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 7b. Call Events, Structured Transcripts, Recordings, Extractions
CREATE TABLE IF NOT EXISTS call_events (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS call_transcripts (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    speaker TEXT NOT NULL, -- 'ai', 'caller', 'system'
    message TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL DEFAULT 0,
    language TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS call_recordings (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    storage_key TEXT,
    url TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'mp3',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    is_simulated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS call_extractions (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    summary TEXT,
    sentiment TEXT DEFAULT 'neutral',
    qualification_score INTEGER DEFAULT 0,
    extracted_fields_json TEXT NOT NULL DEFAULT '{}',
    next_action TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    subtotal_paise INTEGER NOT NULL,
    gst_paise INTEGER NOT NULL,
    total_paise INTEGER NOT NULL,
    gst_percentage REAL NOT NULL DEFAULT 18.0,
    sac_code TEXT NOT NULL DEFAULT '998313',
    status TEXT NOT NULL DEFAULT 'paid',
    line_items_json TEXT NOT NULL DEFAULT '[]',
    billing_name TEXT,
    billing_gstin TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    monthly_fee_paise INTEGER NOT NULL DEFAULT 0,
    included_channels INTEGER NOT NULL DEFAULT 5,
    current_period_start TEXT NOT NULL,
    current_period_end TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 9. Phone Numbers & Separate Calling Channels
CREATE TABLE IF NOT EXISTS phone_numbers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    caller_id TEXT,
    provider TEXT NOT NULL DEFAULT 'exotel',
    status TEXT NOT NULL DEFAULT 'pending_kyc', -- 'pending_kyc', 'active', 'suspended', 'error'
    kyc_status TEXT NOT NULL DEFAULT 'verified', -- 'not_submitted', 'in_review', 'verified', 'rejected'
    compliance_category TEXT NOT NULL DEFAULT 'service_140_160', -- 'service_140_160', 'promotional_140', 'transactional', 'sandbox_virtual'
    monthly_rental_paise INTEGER NOT NULL DEFAULT 79900,
    assigned_agent_id TEXT,
    inbound_agent_id TEXT,
    after_hours_mode TEXT NOT NULL DEFAULT 'voicemail_callback', -- 'ai_24x7', 'voicemail_callback', 'transfer'
    business_hours_json TEXT DEFAULT '{"start":"09:00","end":"20:00","timezone":"Asia/Kolkata"}',
    channel_count INTEGER NOT NULL DEFAULT 2,
    config_error TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calling_channels (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    phone_number_id TEXT,
    provider TEXT NOT NULL DEFAULT 'exotel',
    channel_capacity INTEGER NOT NULL DEFAULT 5,
    active_calls_count INTEGER NOT NULL DEFAULT 0,
    monthly_rental_paise INTEGER NOT NULL DEFAULT 64900,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 10. Payment Orders Table (Server-Side Razorpay Order Tracking)
CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created',
    receipt TEXT,
    razorpay_payment_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 11. Knowledge Base (RAG Sources, Documents, Vector Chunks)
CREATE TABLE IF NOT EXISTS knowledge_sources (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    agent_id TEXT,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'text', 'faq', 'pdf', 'docx', 'txt', 'csv', 'url', 'policy', 'pricelist', 'audio'
    status TEXT NOT NULL DEFAULT 'ready', -- 'processing', 'ready', 'failed'
    description TEXT,
    document_count INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    agent_id TEXT,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    storage_key TEXT,
    raw_content TEXT,
    status TEXT NOT NULL DEFAULT 'ready', -- 'queued', 'processing', 'ready', 'failed'
    error_message TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    agent_id TEXT,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding_json TEXT, -- JSON array for vector similarity search (pgvector compatible)
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 12. AI Actions, Tool Executions & Caller Memory
CREATE TABLE IF NOT EXISTS agent_actions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'google_calendar', 'whatsapp_template', 'google_sheets', 'custom_api', 'call_transfer', 'caller_memory'
    description TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    parameters_schema_json TEXT NOT NULL DEFAULT '{}',
    execution_conditions TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS call_actions (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL,
    agent_id TEXT,
    action_id TEXT,
    tenant_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_name TEXT NOT NULL,
    arguments_json TEXT NOT NULL DEFAULT '{}',
    result_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'executed', -- 'executed', 'simulated', 'not_configured', 'failed'
    created_at TEXT NOT NULL,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS caller_memories (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    caller_name TEXT,
    summary TEXT,
    preferences_json TEXT NOT NULL DEFAULT '{}',
    last_appointment TEXT,
    last_call_id TEXT,
    interaction_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 13. Integrations, Webhooks & WhatsApp Templates
CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    provider_key TEXT NOT NULL, -- 'openai', 'elevenlabs', 'sarvam', 'livekit', 'exotel', 'twilio', 'google_calendar', 'google_sheets', 'whatsapp', 'zoho_crm', 'leadsquared', 'meta_lead_ads', 'zapier', 'make', 'pabbly', 'wordpress', 'custom_rest'
    display_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'ai', 'telephony', 'crm', 'calendar', 'messaging', 'automation'
    status TEXT NOT NULL DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error', 'not_configured'
    config_json TEXT NOT NULL DEFAULT '{}',
    permissions_json TEXT NOT NULL DEFAULT '[]',
    last_tested_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    integration_id TEXT,
    provider_key TEXT NOT NULL,
    event_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'failed', 'not_configured', 'retrying'
    request_payload_json TEXT DEFAULT '{}',
    response_payload_json TEXT DEFAULT '{}',
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events_json TEXT NOT NULL DEFAULT '["call.completed"]',
    signing_secret TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    include_transcripts INTEGER NOT NULL DEFAULT 1,
    retry_limit INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    payload_json TEXT NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'delivered', 'failed', 'retrying', 'pending'
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'UTILITY', -- 'UTILITY', 'MARKETING', 'AUTHENTICATION'
    language TEXT NOT NULL DEFAULT 'en',
    body_text TEXT NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'pending_meta_approval', -- 'approved', 'pending_meta_approval', 'rejected'
    meta_template_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 14. Voice Broadcast (Separate One-Way Announcement Module)
CREATE TABLE IF NOT EXISTS voice_broadcasts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    message_text TEXT,
    audio_url TEXT,
    language TEXT NOT NULL DEFAULT 'te-IN',
    voice_provider TEXT NOT NULL DEFAULT 'sarvam',
    voice_id TEXT DEFAULT 'meera',
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled'
    scheduled_at TEXT,
    total_recipients INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    total_cost_paise INTEGER NOT NULL DEFAULT 0,
    is_sandbox INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_broadcast_recipients (
    id TEXT PRIMARY KEY,
    broadcast_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    name TEXT,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'playing', 'delivered', 'no_answer', 'failed', 'dnc_blocked'
    provider_call_id TEXT,
    cost_paise INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (broadcast_id) REFERENCES voice_broadcasts(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 15. Compliance, Consent & Do-Not-Call (TRAI TCCCPR)
CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    lead_id TEXT,
    phone TEXT NOT NULL,
    consent_status TEXT NOT NULL DEFAULT 'opted_in', -- 'opted_in', 'opted_out', 'revoked'
    consent_source TEXT NOT NULL, -- 'web_form', 'meta_lead_ad', 'whatsapp_optin', 'written_contract', 'csv_declaration'
    consent_purpose TEXT NOT NULL DEFAULT 'service_callback',
    call_category TEXT NOT NULL DEFAULT 'service', -- 'service', 'transactional', 'promotional'
    evidence_url_or_ref TEXT,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS do_not_call_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    reason TEXT DEFAULT 'Customer opt-out',
    source TEXT DEFAULT 'manual', -- 'manual', 'call_opt_out', 'ndnc_sync', 'csv'
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS compliance_policies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT UNIQUE NOT NULL,
    calling_window_start TEXT NOT NULL DEFAULT '10:00',
    calling_window_end TEXT NOT NULL DEFAULT '18:00',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    enforce_dnd_scrubbing INTEGER NOT NULL DEFAULT 1,
    require_explicit_consent INTEGER NOT NULL DEFAULT 1,
    require_recording_disclosure INTEGER NOT NULL DEFAULT 1,
    allow_promotional_calls INTEGER NOT NULL DEFAULT 0,
    approved_series_prefix TEXT DEFAULT '140,160,+9180,+9140',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 16. Notifications, Audit Logs & Super Admin Platform Tables
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    category TEXT NOT NULL DEFAULT 'system', -- 'billing', 'campaign', 'compliance', 'integration', 'system'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'error', 'success'
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    actor_user_id TEXT,
    actor_email TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata_json TEXT DEFAULT '{}',
    ip_address TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    description TEXT,
    updated_by TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_errors (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    module TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'error',
    message TEXT NOT NULL,
    details_json TEXT DEFAULT '{}',
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS disposition_mappings (
    tenant_id TEXT PRIMARY KEY,
    mapping_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Appointments & Slot Reservations
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    lead_id TEXT,
    call_id TEXT,
    agent_id TEXT,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    title TEXT NOT NULL,
    scheduled_start TEXT NOT NULL,
    scheduled_end TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'rescheduled'
    external_calendar_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(tenant_id, scheduled_start, status),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Visual Workflows & Durable Execution Records
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL DEFAULT 'call_completed', -- 'call_completed', 'lead_created', 'appointment_booked', 'manual'
    is_active INTEGER NOT NULL DEFAULT 1,
    graph_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    temporal_workflow_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'running', 'completed', 'failed'
    context_json TEXT NOT NULL DEFAULT '{}',
    result_json TEXT NOT NULL DEFAULT '{}',
    error_message TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Internal Support Tickets (Customer <-> Staff Portal)
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    created_by_user_id TEXT,
    assigned_staff_id TEXT,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'technical', -- 'technical', 'billing', 'compliance', 'telephony', 'onboarding'
    priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'waiting_customer', 'resolved', 'closed'
    resolution_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Promotional Credits (Separated from Purchased Wallet Credits & Tax Invoices)
CREATE TABLE IF NOT EXISTS promo_credits (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    remaining_paise INTEGER NOT NULL,
    reason TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Provider COGS & Gross Margin Tracking
CREATE TABLE IF NOT EXISTS provider_usage_costs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    call_id TEXT,
    category TEXT NOT NULL, -- 'telephony', 'stt', 'llm', 'tts'
    provider_name TEXT NOT NULL,
    units REAL NOT NULL DEFAULT 0,
    estimated_cost_paise INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Performance & Tenant Scoping Indexes
CREATE INDEX IF NOT EXISTS idx_leads_tenant_phone ON leads(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads(tenant_id, lead_status);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_date ON calls(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_agent ON calls(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status ON campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_lookup ON campaign_jobs(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_tx_tenant_date ON transactions(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_slug ON agents(slug);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON payment_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_agent ON knowledge_chunks(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_dnc_tenant_phone ON do_not_call_entries(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_consent_tenant_phone ON consent_records(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_caller_memory_tenant_phone ON caller_memories(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, is_read);
"""


def _safe_add_columns(cur: sqlite3.Cursor, table: str, columns: dict[str, str]):
    cur.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    if not cur.fetchone():
        return
    cur.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cur.fetchall()}
    for col_name, col_def in columns.items():
        if col_name not in existing:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")


def migrate_existing_database(conn: sqlite3.Connection):
    """Safely migrate existing database columns to integer paise, hashed API keys, and extended schema."""
    cur = conn.cursor()

    # 1. Check tenants table legacy migration
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

    _safe_add_columns(cur, "tenants", {
        "status": "TEXT NOT NULL DEFAULT 'active'",
        "gstin": "TEXT",
        "billing_email": "TEXT",
        "low_balance_threshold_paise": "INTEGER NOT NULL DEFAULT 50000",
        "is_demo": "INTEGER NOT NULL DEFAULT 0",
    })

    _safe_add_columns(cur, "users", {
        "email_verified": "INTEGER NOT NULL DEFAULT 1",
        "is_super_admin": "INTEGER NOT NULL DEFAULT 0",
        "avatar_url": "TEXT",
        "last_login_at": "TEXT",
    })

    _safe_add_columns(cur, "agents", {
        "slug": "TEXT",
        "intake_secret_hash": "TEXT",
        "business_name": "TEXT",
        "designation": "TEXT DEFAULT 'AI Voice Specialist'",
        "objective": "TEXT",
        "calling_purpose": "TEXT DEFAULT 'lead_qualification'",
        "call_direction": "TEXT NOT NULL DEFAULT 'outbound'",
        "voice_id": "TEXT DEFAULT 'meera'",
        "voice_gender": "TEXT DEFAULT 'female'",
        "provider": "TEXT DEFAULT 'sarvam'",
        "speaking_style": "TEXT DEFAULT 'warm_professional'",
        "personality": "TEXT DEFAULT 'courteous, concise, helpful'",
        "greeting_message": "TEXT",
        "conversation_instructions": "TEXT",
        "questions_json": "TEXT DEFAULT '[]'",
        "extraction_schema_json": "TEXT DEFAULT '[]'",
        "qualification_criteria": "TEXT",
        "appointment_requirements": "TEXT",
        "call_ending_conditions": "TEXT",
        "escalation_conditions": "TEXT",
        "never_say_json": "TEXT DEFAULT '[]'",
        "never_do_json": "TEXT DEFAULT '[]'",
        "structured_config_json": "TEXT DEFAULT '{}'",
        "calling_hours_json": "TEXT DEFAULT '{\"start\":\"10:00\",\"end\":\"18:00\",\"timezone\":\"Asia/Kolkata\"}'",
        "caller_memory_enabled": "INTEGER NOT NULL DEFAULT 0",
        "recording_disclosure_enabled": "INTEGER NOT NULL DEFAULT 1",
        "transfer_number": "TEXT",
        "post_call_webhook_url": "TEXT",
        "speech_rate": "REAL DEFAULT 1.0",
        "stability": "REAL NOT NULL DEFAULT 0.6",
        "current_version": "INTEGER NOT NULL DEFAULT 1",
        "updated_at": "TEXT",
    })

    _safe_add_columns(cur, "leads", {
        "email": "TEXT",
        "lead_status": "TEXT NOT NULL DEFAULT 'new'",
        "consent_status": "TEXT DEFAULT 'opted_in'",
        "call_category": "TEXT NOT NULL DEFAULT 'service'",
        "opt_out": "INTEGER DEFAULT 0",
        "tags_json": "TEXT NOT NULL DEFAULT '[]'",
        "custom_fields_json": "TEXT NOT NULL DEFAULT '{}'",
        "follow_up_at": "TEXT",
        "callback_at": "TEXT",
        "updated_at": "TEXT",
    })

    _safe_add_columns(cur, "campaigns", {
        "agent_id": "TEXT",
        "list_id": "TEXT",
        "suppression_list_id": "TEXT",
        "campaign_type": "TEXT NOT NULL DEFAULT 'bulk'",
        "calling_hours_json": "TEXT DEFAULT '{\"start\":\"10:00\",\"end\":\"18:00\",\"timezone\":\"Asia/Kolkata\"}'",
        "calling_days_json": "TEXT DEFAULT '[\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\",\"Sat\"]'",
        "retry_attempts": "INTEGER NOT NULL DEFAULT 2",
        "retry_delay_minutes": "INTEGER NOT NULL DEFAULT 30",
        "scheduled_at": "TEXT",
        "started_at": "TEXT",
        "completed_at": "TEXT",
        "failed": "INTEGER DEFAULT 0",
        "interested_count": "INTEGER NOT NULL DEFAULT 0",
        "not_interested_count": "INTEGER NOT NULL DEFAULT 0",
        "callback_count": "INTEGER NOT NULL DEFAULT 0",
        "no_answer_count": "INTEGER NOT NULL DEFAULT 0",
        "is_sandbox": "INTEGER NOT NULL DEFAULT 0",
    })

    _safe_add_columns(cur, "contact_lists", {
        "list_type": "TEXT NOT NULL DEFAULT 'reusable'",
    })

    _safe_add_columns(cur, "users", {
        "staff_role": "TEXT",
        "status": "TEXT NOT NULL DEFAULT 'active'",
        "token_version": "INTEGER NOT NULL DEFAULT 1",
    })

    _safe_add_columns(cur, "webhooks", {
        "include_transcripts": "INTEGER NOT NULL DEFAULT 1",
    })

    _safe_add_columns(cur, "campaign_jobs", {
        "contact_name": "TEXT",
        "phone": "TEXT",
        "custom_fields_json": "TEXT DEFAULT '{}'",
        "max_retries": "INTEGER NOT NULL DEFAULT 2",
        "next_retry_at": "TEXT",
        "last_error": "TEXT",
    })

    _safe_add_columns(cur, "calls", {
        "campaign_id": "TEXT",
        "agent_id": "TEXT",
        "lead_id": "TEXT",
        "call_category": "TEXT NOT NULL DEFAULT 'service'",
        "provider": "TEXT DEFAULT 'mock'",
        "provider_call_id": "TEXT",
        "duration_seconds": "INTEGER DEFAULT 0",
        "billable_duration_seconds": "INTEGER DEFAULT 0",
        "cost_paise": "INTEGER DEFAULT 0",
        "summary": "TEXT",
        "sentiment": "TEXT DEFAULT 'neutral'",
        "extracted_data_json": "TEXT DEFAULT '{}'",
        "is_sandbox": "INTEGER NOT NULL DEFAULT 0",
        "latency_ms": "INTEGER",
        "recording_disclosure_played": "INTEGER NOT NULL DEFAULT 1",
        "ended_at": "TEXT",
    })

    _safe_add_columns(cur, "phone_numbers", {
        "caller_id": "TEXT",
        "kyc_status": "TEXT NOT NULL DEFAULT 'verified'",
        "compliance_category": "TEXT NOT NULL DEFAULT 'service_140_160'",
        "inbound_agent_id": "TEXT",
        "after_hours_mode": "TEXT NOT NULL DEFAULT 'voicemail_callback'",
        "business_hours_json": "TEXT DEFAULT '{\"start\":\"09:00\",\"end\":\"20:00\",\"timezone\":\"Asia/Kolkata\"}'",
        "channel_count": "INTEGER NOT NULL DEFAULT 2",
        "config_error": "TEXT",
    })

    # Legacy transactions column check & table rebuild when v1 NOT NULL float columns remain
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'")
    if cur.fetchone():
        cur.execute("PRAGMA table_info(transactions)")
        tx_info = cur.fetchall()
        cols = {row[1] for row in tx_info}
        has_legacy_notnull = any(row[1] in ("amount_inr", "running_balance") and row[3] == 1 for row in tx_info)
        if "running_balance_paise" not in cols:
            cur.execute("ALTER TABLE transactions ADD COLUMN running_balance_paise INTEGER DEFAULT 0")
            if "running_balance" in cols:
                cur.execute("UPDATE transactions SET running_balance_paise = CAST(ROUND(running_balance * 100) AS INTEGER)")
        if "idempotency_key" not in cols:
            cur.execute("ALTER TABLE transactions ADD COLUMN idempotency_key TEXT")
        if has_legacy_notnull or "amount_inr" in cols or "running_balance" in cols:
            cur.execute("PRAGMA foreign_keys=OFF;")
            cur.execute("""
            CREATE TABLE IF NOT EXISTS transactions_migrated (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                type TEXT NOT NULL,
                amount_paise INTEGER NOT NULL,
                description TEXT NOT NULL,
                invoice_id TEXT,
                running_balance_paise INTEGER NOT NULL,
                idempotency_key TEXT UNIQUE,
                created_at TEXT NOT NULL,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );
            """)
            amt_expr = "COALESCE(amount_paise, CAST(ROUND(COALESCE(amount_inr, 0) * 100) AS INTEGER))" if "amount_inr" in cols else "COALESCE(amount_paise, 0)"
            bal_expr = "COALESCE(running_balance_paise, CAST(ROUND(COALESCE(running_balance, 0) * 100) AS INTEGER))" if "running_balance" in cols else "COALESCE(running_balance_paise, 0)"
            cur.execute(f"""
            INSERT OR REPLACE INTO transactions_migrated (
                id, tenant_id, type, amount_paise, description, invoice_id, running_balance_paise, idempotency_key, created_at
            )
            SELECT id, tenant_id, type, {amt_expr}, description, invoice_id, {bal_expr}, idempotency_key, created_at
            FROM transactions
            """)
            cur.execute("DROP TABLE transactions")
            cur.execute("ALTER TABLE transactions_migrated RENAME TO transactions")
            cur.execute("PRAGMA foreign_keys=ON;")

    # Legacy tenant_id unification ('tenant_enterprise_demo' -> 'tenant_demo_enterprise')
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'")
    if cur.fetchone():
        cur.execute("SELECT 1 FROM tenants WHERE id = 'tenant_demo_enterprise'")
        if cur.fetchone():
            legacy_tables = (
                "agents",
                "leads",
                "campaigns",
                "calls",
                "knowledge_sources",
                "knowledge_documents",
                "knowledge_chunks",
                "do_not_call_entries",
            )
            for tbl in legacy_tables:
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tbl,))
                if cur.fetchone():
                    cur.execute(
                        f"UPDATE {tbl} SET tenant_id = 'tenant_demo_enterprise' WHERE tenant_id = 'tenant_enterprise_demo'"
                    )
            cur.execute("DELETE FROM tenants WHERE id = 'tenant_enterprise_demo'")

    conn.commit()


def create_tables(conn: sqlite3.Connection):
    """Execute migration and DDL creation for all tables and indexes."""
    if getattr(conn, "engine_name", "sqlite") == "postgresql":
        from pathlib import Path
        pg_ddl_path = Path(__file__).resolve().parent / "postgres_pgvector_schema.sql"
        if pg_ddl_path.is_file():
            ddl = pg_ddl_path.read_text(encoding="utf-8")
            for stmt in ddl.split(";"):
                cleaned = "\n".join(
                    line for line in stmt.splitlines() if not line.strip().startswith("--")
                ).strip()
                if cleaned:
                    try:
                        conn.execute(cleaned)
                    except Exception:
                        conn.rollback()
            conn.commit()
        return

    migrate_existing_database(conn)
    conn.executescript(SCHEMA_SQL)
    migrate_existing_database(conn)
    conn.commit()
