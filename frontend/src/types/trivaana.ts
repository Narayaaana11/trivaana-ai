export interface Tenant {
  id: string;
  name: string;
  api_key?: string;
  api_key_masked?: string;
  wallet_balance: number;
  wallet_balance_paise?: number;
  currency: string;
  rate_per_min: number;
  plan: string;
  concurrency_limit: number;
  created_at: string;
}

export interface AnalyticsStats {
  wallet_balance_inr: number;
  total_leads: number;
  total_calls_placed: number;
  total_duration_minutes: number;
  demos_booked: number;
  demo_conversion_rate: string;
  turn_taking_latency_ms: number;
  active_concurrency: number;
  voice_engine: string;
}

export interface Lead {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  city: string;
  vertical: string;
  status: 'pending' | 'qualified' | 'contacted' | 'converted';
  source: string;
  consent_status?: string;
  opt_out?: number;
  notes?: string;
  created_at: string;
}

export interface CallLog {
  id: string;
  tenant_id: string;
  contact_name: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  duration_seconds?: number;
  billable_duration_seconds?: number;
  cost: number;
  cost_paise?: number;
  status: 'completed' | 'failed' | 'in_progress' | 'initiated' | 'ringing';
  language: string;
  outcome: string;
  transcript: string;
  recording_url?: string;
  created_at: string;
}

export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  vertical: string;
  language: string;
  voice_model: string;
  provider?: string;
  system_prompt: string;
  speech_rate?: number;
  status: 'active' | 'inactive';
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
  database: {
    healthy: boolean;
    engine: string;
    registered_tenants: number;
  };
  telephony: {
    active_provider: string;
    is_mock_sandbox: boolean;
    exotel_configured: boolean;
    twilio_configured: boolean;
  };
  voice: {
    active_tts: string;
    sarvam_configured: boolean;
    elevenlabs_configured: boolean;
  };
  billing: {
    active_gateway: string;
    razorpay_configured: boolean;
    sac_code: string;
    currency: string;
  };
  whatsapp: {
    configured: boolean;
    mode: string;
  };
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

