export interface Tenant {
  id: string;
  name: string;
  api_key: string;
  wallet_balance: number;
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
  cost: number;
  status: 'completed' | 'failed' | 'in_progress';
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
  system_prompt: string;
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
  created_at: string;
}
