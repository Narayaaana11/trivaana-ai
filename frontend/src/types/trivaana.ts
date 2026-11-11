export interface Tenant {
  id: string;
  name: string;
  api_key?: string;
  api_key_masked?: string;
  wallet_balance: number;
  wallet_balance_paise?: number;
  currency: string;
  rate_per_min: number;
  rate_standard_paise?: number;
  rate_premium_paise?: number;
  plan: string;
  concurrency_limit: number;
  status?: string;
  gstin?: string;
  created_at: string;
}

export interface AnalyticsStats {
  wallet_balance_inr: number;
  wallet_balance_paise?: number;
  total_ai_employees?: number;
  active_ai_employees?: number;
  total_leads: number;
  total_calls_placed: number;
  connected_calls?: number;
  connection_rate_pct?: number;
  total_duration_minutes: number;
  total_duration_seconds?: number;
  average_call_duration_seconds?: number;
  interested_leads?: number;
  demos_booked: number;
  appointments_booked?: number;
  demo_conversion_rate: string;
  total_usage_inr?: number;
  turn_taking_latency_ms: number | null;
  active_concurrency: number;
  voice_engine: string;
  has_live_telephony?: boolean;
  daily_series?: Array<{ date: string; total: number; connected: number; unanswered: number; spend_inr: number }>;
  outcome_distribution?: Array<{ outcome: string; count: number }>;
  language_distribution?: Array<{ language: string; count: number }>;
  agent_performance?: Array<{ agent_id: string; agent_name: string; language: string; status: string; total_calls: number; connected_calls: number; total_duration_seconds: number }>;
  campaign_performance?: Array<{ campaign_id: string; name: string; status: string; total_contacts: number; placed: number; connected: number; interested_count: number; callback_count: number; failed: number }>;
}

export interface Lead {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  vertical: string;
  status: 'pending' | 'qualified' | 'contacted' | 'converted';
  lead_status?: 'new' | 'contacted' | 'interested' | 'not_interested' | 'callback_required' | 'converted' | 'do_not_call';
  source: string;
  consent_status?: string;
  call_category?: string;
  opt_out?: number;
  tags?: string[];
  custom_fields?: Record<string, any>;
  follow_up_at?: string;
  callback_at?: string;
  notes?: string;
  created_at: string;
}

export interface CallLog {
  id: string;
  tenant_id: string;
  campaign_id?: string;
  agent_id?: string;
  contact_name: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  call_category?: string;
  provider?: string;
  provider_call_id?: string;
  duration: number;
  duration_seconds?: number;
  billable_duration_seconds?: number;
  cost: number;
  cost_paise?: number;
  status: 'completed' | 'failed' | 'in_progress' | 'initiated' | 'ringing' | 'connected' | 'cancelled';
  language: string;
  outcome: string;
  summary?: string;
  sentiment?: string;
  extracted_data?: Record<string, any>;
  transcript: string;
  transcript_messages?: Array<{ id: string; speaker: string; message: string; timestamp_ms: number }>;
  actions_performed?: Array<{ id: string; action_type: string; action_name: string; status: string; arguments: any; result: any }>;
  recording_url?: string;
  is_sandbox?: boolean;
  latency_ms?: number;
  created_at: string;
  ended_at?: string;
}

export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  slug?: string;
  vertical: string;
  business_name?: string;
  designation?: string;
  objective?: string;
  calling_purpose?: string;
  call_direction?: 'outbound' | 'inbound' | 'both';
  language: string;
  voice_model: string;
  voice_id?: string;
  voice_gender?: string;
  provider?: string;
  speaking_style?: string;
  personality?: string;
  greeting_message?: string;
  system_prompt: string;
  conversation_instructions?: string;
  questions?: string[];
  extraction_schema?: Array<{ key: string; label: string; type: string; required: boolean }>;
  qualification_criteria?: string;
  appointment_requirements?: string;
  call_ending_conditions?: string;
  escalation_conditions?: string;
  never_say?: string[];
  never_do?: string[];
  structured_config?: Record<string, any>;
  calling_hours?: { start: string; end: string; timezone: string };
  caller_memory_enabled?: boolean;
  recording_disclosure_enabled?: boolean;
  transfer_number?: string;
  post_call_webhook_url?: string;
  speech_rate?: number;
  stability?: number;
  status: 'draft' | 'testing' | 'published' | 'active' | 'paused' | 'archived' | 'inactive';
  current_version?: number;
  created_at: string;
  updated_at?: string;
}

export interface VoiceProfile {
  id: string;
  provider: string;
  provider_voice_id: string;
  name: string;
  language: string;
  gender: string;
  quality_tier: string;
  description?: string;
  default_speed: number;
  default_stability: number;
  verified_status: string;
  provider_configured: boolean;
}

export interface KnowledgeDocument {
  id: string;
  source_id: string;
  agent_id?: string;
  title: string;
  source_type: string;
  source_url?: string;
  status: string;
  chunk_count: number;
  created_at: string;
}

export interface ContactListItem {
  id: string;
  tenant_id: string;
  name: string;
  list_type: 'reusable' | 'suppression' | string;
  description?: string;
  contact_count: number;
  created_at: string;
  updated_at?: string;
}

export interface CampaignItem {
  id: string;
  name: string;
  agent_id?: string;
  agent_name?: string;
  status: string;
  concurrency: number;
  retry_attempts: number;
  retry_delay_minutes: number;
  total_contacts: number;
  placed: number;
  connected: number;
  failed: number;
  interested_count: number;
  not_interested_count: number;
  callback_count: number;
  no_answer_count: number;
  remaining_contacts: number;
  estimated_remaining_seconds: number;
  is_sandbox: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  tenant_id: string;
  type: 'credit' | 'debit';
  amount_paise: number;
  amount_inr: number;
  description: string;
  invoice_id: string;
  running_balance: number;
  running_balance_paise?: number;
  idempotency_key?: string;
  created_at: string;
}

export interface PricingCatalog {
  currency: string;
  tariffs: {
    standard_ai_call_paise_per_min: number;
    standard_ai_call_inr_per_min: number;
    premium_ai_call_paise_per_min: number;
    premium_ai_call_inr_per_min: number;
    broadcast_paise_per_call?: number;
    broadcast_inr_per_call?: number;
    number_rental_paise_per_month: number;
    number_rental_inr_per_month: number;
    channel_rental_paise_per_month: number;
    channel_rental_inr_per_month: number;
  };
  billing_rules: {
    rounding_increment_seconds: number;
    charge_unconnected_calls: boolean;
    gst_percentage: number;
    sac_code: string;
  };
  wallet_packages_inr: number[];
}

export interface ReadinessStatus {
  status: string;
  database: { healthy: boolean; engine: string; registered_tenants: number };
  ai?: { openai_configured: boolean; openai_model: string; livekit_configured: boolean; livekit_sip_configured: boolean };
  telephony: { active_provider: string; is_mock_sandbox: boolean; exotel_configured: boolean; twilio_configured: boolean };
  voice: { active_tts: string; sarvam_configured: boolean; elevenlabs_configured: boolean; openai_tts_configured?: boolean; indicf5_configured?: boolean };
  billing: { active_gateway: string; razorpay_configured: boolean; sac_code: string; currency: string };
  whatsapp: { configured: boolean; mode: string };
  infrastructure?: { redis_configured: boolean; s3_storage_configured: boolean; google_oauth_configured: boolean };
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}
