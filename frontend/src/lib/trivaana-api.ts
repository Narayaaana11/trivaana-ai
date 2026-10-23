import { Tenant, AnalyticsStats, Lead, CallLog, Agent, Transaction } from '../types/trivaana';

const API_BASE = '/api';

export const trivaanaApi = {
  async getTenant(): Promise<Tenant> {
    const res = await fetch(`${API_BASE}/tenant`);
    if (!res.ok) throw new Error('Failed to fetch tenant');
    return res.json();
  },

  async getStats(): Promise<AnalyticsStats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getLeads(search?: string, status?: string): Promise<{ leads: Lead[]; count: number }> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/leads?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch leads');
    return res.json();
  },

  async createLead(name: string, phone: string, city: string, vertical: string, notes?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, city, vertical, notes }),
    });
    if (!res.ok) throw new Error('Failed to create lead');
    return res.json();
  },

  async discoverLeads(city: string, vertical: string, limit: number = 15): Promise<any> {
    const res = await fetch(`${API_BASE}/leads/discover?city=${encodeURIComponent(city)}&vertical=${encodeURIComponent(vertical)}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to run OSM Scout');
    return res.json();
  },

  async uploadLeadsCsv(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/leads/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload leads CSV');
    return res.json();
  },

  async getCalls(): Promise<{ calls: CallLog[]; count: number }> {
    const res = await fetch(`${API_BASE}/calls`);
    if (!res.ok) throw new Error('Failed to fetch calls');
    return res.json();
  },

  async triggerInstantCall(name: string, phone: string, vertical: string = 'Real Estate', language: string = 'te-IN'): Promise<any> {
    const res = await fetch(`${API_BASE}/calls/instant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, vertical, language }),
    });
    if (!res.ok) throw new Error('Failed to trigger instant call');
    return res.json();
  },

  async retriggerWhatsApp(callId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/calls/${callId}/whatsapp`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to retrigger WhatsApp');
    return res.json();
  },

  async getAgents(): Promise<{ agents: Agent[] }> {
    const res = await fetch(`${API_BASE}/agents`);
    if (!res.ok) throw new Error('Failed to fetch agents');
    return res.json();
  },

  async startCampaign(concurrency: number, maxCalls: number, bypassTrai: boolean = false): Promise<any> {
    const res = await fetch(`${API_BASE}/campaigns/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concurrency, max_calls: maxCalls, bypass_trai: bypassTrai }),
    });
    if (!res.ok) throw new Error('Failed to start campaign');
    return res.json();
  },

  async killCampaign(): Promise<any> {
    const res = await fetch(`${API_BASE}/campaigns/kill`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to activate kill switch');
    return res.json();
  },

  async getTransactions(): Promise<{ transactions: Transaction[] }> {
    const res = await fetch(`${API_BASE}/billing/transactions`);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  async createRazorpayOrder(amountInr: number): Promise<any> {
    const res = await fetch(`${API_BASE}/billing/razorpay-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_inr: amountInr }),
    });
    if (!res.ok) throw new Error('Failed to create Razorpay order');
    return res.json();
  },

  async submitRazorpayWebhook(payload: { order_id: string; payment_id: string; signature: string; amount_inr: number }): Promise<any> {
    const res = await fetch(`${API_BASE}/billing/razorpay-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to process Razorpay payment');
    return res.json();
  },
};
