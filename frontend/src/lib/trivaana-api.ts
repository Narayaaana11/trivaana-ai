import {
  Tenant,
  AnalyticsStats,
  Lead,
  CallLog,
  Agent,
  Transaction,
  PricingCatalog,
  ReadinessStatus
} from '../types/trivaana';

const API_BASE = '/api';

let cachedToken: string | null = null;

export function getAuthToken(): string | null {
  if (cachedToken) return cachedToken;
  if (typeof window !== 'undefined') {
    cachedToken = localStorage.getItem('trivaana_token');
  }
  return cachedToken;
}

export function setAuthToken(token: string | null) {
  cachedToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('trivaana_token', token);
    } else {
      localStorage.removeItem('trivaana_token');
    }
  }
}

async function ensureAuthenticated(): Promise<string> {
  const existing = getAuthToken();
  if (existing) return existing;

  // Auto-login with isolated seeded enterprise demo credentials
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo@trivaana.ai',
        password: 'Trivaana@2026'
      })
    });
    if (res.ok) {
      const data = await res.json();
      setAuthToken(data.access_token);
      return data.access_token;
    }
  } catch (err) {
    console.warn('Auto-auth bootstrap notice:', err);
  }
  return '';
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = await ensureAuthenticated();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(url, { ...options, headers });

  // If 401, refresh token once and retry
  if (res.status === 401) {
    setAuthToken(null);
    token = await ensureAuthenticated();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      res = await fetch(url, { ...options, headers });
    }
  }

  return res;
}

export const trivaanaApi = {
  async getTenant(): Promise<Tenant> {
    const res = await authFetch(`${API_BASE}/tenant`);
    if (!res.ok) throw new Error('Failed to fetch tenant');
    return res.json();
  },

  async getStats(): Promise<AnalyticsStats> {
    const res = await authFetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getLeads(search?: string, status?: string): Promise<{ leads: Lead[]; count: number }> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const res = await authFetch(`${API_BASE}/leads?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch leads');
    return res.json();
  },

  async createLead(name: string, phone: string, city: string, vertical: string, notes?: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, city, vertical, notes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create lead');
    }
    return res.json();
  },

  async discoverLeads(city: string, vertical: string, limit: number = 15): Promise<any> {
    const res = await authFetch(`${API_BASE}/leads/discover?city=${encodeURIComponent(city)}&vertical=${encodeURIComponent(vertical)}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to run OSM Scout');
    return res.json();
  },

  async uploadLeadsCsv(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await authFetch(`${API_BASE}/leads/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload leads CSV');
    return res.json();
  },

  async toggleLeadOptOut(leadId: string, optOut: boolean = true): Promise<any> {
    const res = await authFetch(`${API_BASE}/leads/${leadId}/opt-out?opt_out=${optOut}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to update lead opt-out status');
    return res.json();
  },

  async getCalls(): Promise<{ calls: CallLog[]; count: number }> {
    const res = await authFetch(`${API_BASE}/calls`);
    if (!res.ok) throw new Error('Failed to fetch calls');
    return res.json();
  },

  async triggerInstantCall(
    name: string,
    phone: string,
    vertical: string = 'Real Estate',
    language: string = 'te-IN',
    agentId?: string
  ): Promise<any> {
    const res = await authFetch(`${API_BASE}/calls/instant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        vertical,
        language,
        agent_id: agentId,
        is_sandbox: false
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to trigger instant call');
    }
    return res.json();
  },

  async retriggerWhatsApp(callId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/calls/${callId}/whatsapp`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to trigger WhatsApp follow-up');
    return res.json();
  },

  async getAgents(): Promise<{ agents: Agent[] }> {
    const res = await authFetch(`${API_BASE}/agents`);
    if (!res.ok) throw new Error('Failed to fetch agents');
    return res.json();
  },

  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update agent configuration');
    }
    return res.json();
  },

  async createAgent(agent: {
    name: string;
    vertical: string;
    language: string;
    voice_model?: string;
    provider?: string;
    system_prompt: string;
    speech_rate?: number;
  }): Promise<Agent> {
    const res = await authFetch(`${API_BASE}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create agent');
    }
    return res.json();
  },

  async startCampaign(concurrency: number, maxCalls: number, bypassTrai: boolean = false): Promise<any> {
    const res = await authFetch(`${API_BASE}/campaigns/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concurrency, max_calls: maxCalls, bypass_trai: bypassTrai }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to start campaign');
    }
    return res.json();
  },

  async killCampaign(): Promise<any> {
    const res = await authFetch(`${API_BASE}/campaigns/kill`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to activate emergency kill switch');
    return res.json();
  },

  async getPricing(): Promise<PricingCatalog> {
    const res = await authFetch(`${API_BASE}/billing/pricing`);
    if (!res.ok) throw new Error('Failed to fetch pricing catalog');
    return res.json();
  },

  async getTransactions(): Promise<{ transactions: Transaction[] }> {
    const res = await authFetch(`${API_BASE}/billing/transactions`);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  async createRazorpayOrder(amountInr: number): Promise<any> {
    const res = await authFetch(`${API_BASE}/billing/razorpay-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_inr: amountInr }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create Razorpay order');
    }
    return res.json();
  },

  async submitRazorpayWebhook(payload: { order_id: string; payment_id: string; signature: string; amount_inr: number }): Promise<any> {
    const res = await authFetch(`${API_BASE}/billing/razorpay-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to process Razorpay payment');
    }
    return res.json();
  },

  async sandboxTopup(amountInr: number): Promise<any> {
    const res = await authFetch(`${API_BASE}/billing/sandbox-topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_inr: amountInr }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to perform sandbox top-up');
    }
    return res.json();
  },

  async getReadiness(): Promise<ReadinessStatus> {
    const res = await fetch(`${API_BASE}/readiness`);
    if (!res.ok) throw new Error('Failed to fetch readiness status');
    return res.json();
  }
};
