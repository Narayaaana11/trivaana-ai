-- TRIVAANA AI: Complete Production PostgreSQL + pgvector Schema
-- Generated from migrated relational schema + pgvector chunk store
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    hashed_password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    full_name TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 1,
    is_super_admin INTEGER NOT NULL DEFAULT 0,
    avatar_url TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'operator',
    status TEXT NOT NULL DEFAULT 'active',
    invite_token TEXT,
    invited_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_type TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    scopes_json TEXT NOT NULL DEFAULT '["*"]',
    last_used_at TEXT,
    revoked_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

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
    call_direction TEXT NOT NULL DEFAULT 'outbound',
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
    speech_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    stability DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    status TEXT NOT NULL DEFAULT 'active',
    current_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

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
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_profiles (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_voice_id TEXT NOT NULL,
    name TEXT NOT NULL,
    language TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'neutral',
    quality_tier TEXT NOT NULL DEFAULT 'standard',
    description TEXT,
    default_speed DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    default_stability DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    supports_ssml INTEGER NOT NULL DEFAULT 0,
    verified_status TEXT NOT NULL DEFAULT 'untested',
    last_tested_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    city TEXT NOT NULL DEFAULT 'Hyderabad',
    vertical TEXT NOT NULL DEFAULT 'Real Estate',
    status TEXT NOT NULL DEFAULT 'pending',
    lead_status TEXT NOT NULL DEFAULT 'new',
    source TEXT NOT NULL DEFAULT 'Manual Entry',
    consent_status TEXT NOT NULL DEFAULT 'opted_in',
    call_category TEXT NOT NULL DEFAULT 'service',
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

CREATE TABLE IF NOT EXISTS contact_lists (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    list_type TEXT NOT NULL DEFAULT 'reusable',
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
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    agent_id TEXT,
    list_id TEXT,
    campaign_type TEXT NOT NULL DEFAULT 'bulk',
    status TEXT NOT NULL DEFAULT 'draft',
    concurrency INTEGER NOT NULL DEFAULT 5,
    calling_hours_json TEXT DEFAULT '{"start":"10:00","end":"18:00","timezone":"Asia/Kolkata"}',
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

CREATE TABLE IF NOT EXISTS campaign_jobs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    custom_fields_json TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 2,
    next_retry_at TEXT,
    last_error TEXT,
    call_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    campaign_id TEXT,
    agent_id TEXT,
    lead_id TEXT,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'outbound',
    call_category TEXT NOT NULL DEFAULT 'service',
    provider TEXT NOT NULL DEFAULT 'mock',
    provider_call_id TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    billable_duration_seconds INTEGER NOT NULL DEFAULT 0,
    cost_paise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'initiated',
    language TEXT NOT NULL DEFAULT 'te-IN',
    outcome TEXT DEFAULT 'pending',
    summary TEXT,
    sentiment TEXT DEFAULT 'neutral',
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

CREATE TABLE IF NOT EXISTS call_events (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS call_transcripts (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    speaker TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL DEFAULT 0,
    language TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
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
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
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
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    description TEXT NOT NULL,
    invoice_id TEXT,
    running_balance_paise INTEGER NOT NULL,
    idempotency_key TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    subtotal_paise INTEGER NOT NULL,
    gst_paise INTEGER NOT NULL,
    total_paise INTEGER NOT NULL,
    gst_percentage DOUBLE PRECISION NOT NULL DEFAULT 18.0,
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

CREATE TABLE IF NOT EXISTS phone_numbers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    caller_id TEXT,
    provider TEXT NOT NULL DEFAULT 'exotel',
    status TEXT NOT NULL DEFAULT 'pending_kyc',
    kyc_status TEXT NOT NULL DEFAULT 'verified',
    compliance_category TEXT NOT NULL DEFAULT 'service_140_160',
    monthly_rental_paise INTEGER NOT NULL DEFAULT 79900,
    assigned_agent_id TEXT,
    inbound_agent_id TEXT,
    after_hours_mode TEXT NOT NULL DEFAULT 'voicemail_callback',
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

CREATE TABLE IF NOT EXISTS knowledge_sources (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    agent_id TEXT,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
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
    status TEXT NOT NULL DEFAULT 'ready',
    error_message TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES knowledge_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    agent_id TEXT,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding_json TEXT,
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_actions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    parameters_schema_json TEXT NOT NULL DEFAULT '{}',
    execution_conditions TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
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
    status TEXT NOT NULL DEFAULT 'executed',
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    provider_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
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
    status TEXT NOT NULL,
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
    idempotency_key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'UTILITY',
    language TEXT NOT NULL DEFAULT 'en',
    body_text TEXT NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'pending_meta_approval',
    meta_template_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_broadcasts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    message_text TEXT,
    audio_url TEXT,
    language TEXT NOT NULL DEFAULT 'te-IN',
    voice_provider TEXT NOT NULL DEFAULT 'sarvam',
    voice_id TEXT DEFAULT 'meera',
    status TEXT NOT NULL DEFAULT 'draft',
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
    status TEXT NOT NULL DEFAULT 'pending',
    provider_call_id TEXT,
    cost_paise INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (broadcast_id) REFERENCES voice_broadcasts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    lead_id TEXT,
    phone TEXT NOT NULL,
    consent_status TEXT NOT NULL DEFAULT 'opted_in',
    consent_source TEXT NOT NULL,
    consent_purpose TEXT NOT NULL DEFAULT 'service_callback',
    call_category TEXT NOT NULL DEFAULT 'service',
    evidence_url_or_ref TEXT,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS do_not_call_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    reason TEXT DEFAULT 'Customer opt-out',
    source TEXT DEFAULT 'manual',
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS compliance_policies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    category TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
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

CREATE INDEX idx_leads_tenant_phone ON leads(tenant_id, phone);
CREATE INDEX idx_leads_tenant_status ON leads(tenant_id, lead_status);
CREATE INDEX idx_calls_tenant_date ON calls(tenant_id, created_at);
CREATE INDEX idx_calls_tenant_agent ON calls(tenant_id, agent_id);
CREATE INDEX idx_campaigns_tenant_status ON campaigns(tenant_id, status);
CREATE INDEX idx_campaign_jobs_lookup ON campaign_jobs(campaign_id, status);
CREATE INDEX idx_tx_tenant_date ON transactions(tenant_id, created_at);
CREATE INDEX idx_agents_tenant ON agents(tenant_id);
CREATE INDEX idx_agents_slug ON agents(slug);
CREATE INDEX idx_orders_tenant ON payment_orders(tenant_id);
CREATE INDEX idx_kb_chunks_agent ON knowledge_chunks(tenant_id, agent_id);
CREATE INDEX idx_dnc_tenant_phone ON do_not_call_entries(tenant_id, phone);
CREATE INDEX idx_consent_tenant_phone ON consent_records(tenant_id, phone);
CREATE INDEX idx_audit_tenant_date ON audit_logs(tenant_id, created_at);
CREATE INDEX idx_caller_memory_tenant_phone ON caller_memories(tenant_id, phone);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id, is_read);

-- Vector RAG Knowledge Chunks (PostgreSQL + pgvector)
CREATE TABLE IF NOT EXISTS knowledge_chunks_pg (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    agent_id TEXT,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_pg_tenant_agent ON knowledge_chunks_pg(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_pg_embedding ON knowledge_chunks_pg USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
