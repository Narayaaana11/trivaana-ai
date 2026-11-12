import {
  Tenant,
  AnalyticsStats,
  Lead,
  CallLog,
  Agent,
  Transaction,
  PricingCatalog,
  ReadinessStatus,
  VoiceProfile,
  KnowledgeDocument,
  CampaignItem
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

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    setAuthToken(null);
  }
  return res;
}

async function parseJsonOrThrow(res: Response, fallbackMsg: string): Promise<any> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || fallbackMsg);
  }
  return res.json();
}

async function downloadAuthenticatedCsv(url: string, filename: string, fallbackMsg: string): Promise<void> {
  const res = await authFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || fallbackMsg);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

export const trivaanaApi = {
  // Authentication
  async login(credentials: { email: string; password: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const data = await parseJsonOrThrow(res, 'Invalid email or password');
    setAuthToken(data.access_token);
    return data;
  },

  async register(details: { email: string; password: string; full_name: string; organization_name?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details)
    });
    const data = await parseJsonOrThrow(res, 'Registration failed');
    setAuthToken(data.access_token);
    return data;
  },

  async getMe(): Promise<any> {
    const res = await authFetch(`${API_BASE}/auth/me`);
    return parseJsonOrThrow(res, 'Failed to fetch user profile');
  },

  async requestPasswordReset(email: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return parseJsonOrThrow(res, 'Failed to request password reset');
  },

  async confirmPasswordReset(token: string, newPassword: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    return parseJsonOrThrow(res, 'Failed to reset password');
  },

  async requestEmailVerification(): Promise<any> {
    const res = await authFetch(`${API_BASE}/auth/email-verification/request`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to request email verification');
  },

  async confirmEmailVerification(token: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/email-verification/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return parseJsonOrThrow(res, 'Failed to verify email');
  },

  async updateProfile(payload: { full_name?: string; avatar_url?: string }): Promise<any> {
    const res = await authFetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to update profile');
  },

  logout(): void {
    setAuthToken(null);
  },

  isAuthenticated(): boolean {
    return Boolean(getAuthToken());
  },

  // Tenant & Analytics
  async getTenant(): Promise<Tenant> {
    const res = await authFetch(`${API_BASE}/tenant`);
    return parseJsonOrThrow(res, 'Failed to fetch tenant workspace');
  },

  async getAnalytics(filters?: { days?: number; agent_id?: string; campaign_id?: string; direction?: string; outcome?: string }): Promise<AnalyticsStats> {
    const qs = new URLSearchParams();
    if (filters?.days) qs.set('days', String(filters.days));
    if (filters?.agent_id) qs.set('agent_id', filters.agent_id);
    if (filters?.campaign_id) qs.set('campaign_id', filters.campaign_id);
    if (filters?.direction) qs.set('direction', filters.direction);
    if (filters?.outcome) qs.set('outcome', filters.outcome);
    const res = await authFetch(`${API_BASE}/analytics?${qs.toString()}`);
    return parseJsonOrThrow(res, 'Failed to fetch analytics');
  },

  async getStats(): Promise<AnalyticsStats> {
    return this.getAnalytics();
  },

  // AI Employees (Agents)
  async getAgents(): Promise<{ agents: Agent[]; count: number }> {
    const res = await authFetch(`${API_BASE}/agents`);
    return parseJsonOrThrow(res, 'Failed to fetch AI employees');
  },

  async getAgent(agentId: string): Promise<Agent> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}`);
    return parseJsonOrThrow(res, 'Failed to fetch AI employee');
  },

  async createAgent(agent: Partial<Agent>): Promise<any> {
    const res = await authFetch(`${API_BASE}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    });
    return parseJsonOrThrow(res, 'Failed to create AI employee');
  },

  async updateAgent(agentId: string, updates: Partial<Agent> & { change_note?: string }): Promise<Agent> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return parseJsonOrThrow(res, 'Failed to update AI employee');
  },

  async updateAgentLifecycle(agentId: string, status: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}/lifecycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return parseJsonOrThrow(res, 'Failed to update lifecycle status');
  },

  async generateAgentPrompt(payload: {
    description: string;
    employee_name?: string;
    business_name?: string;
    industry?: string;
    designation?: string;
    language?: string;
    call_direction?: string;
    speaking_style?: string;
  }): Promise<any> {
    const res = await authFetch(`${API_BASE}/agents/generate-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to generate AI prompt');
  },

  async getPromptVersions(agentId: string): Promise<{ versions: any[] }> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}/prompt/versions`);
    return parseJsonOrThrow(res, 'Failed to fetch prompt versions');
  },

  async restorePromptVersion(agentId: string, versionId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}/prompt/restore/${versionId}`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to restore prompt version');
  },

  async testAgentTurn(agentId: string, message: string, history: Array<{ sender: string; text: string }> = []): Promise<any> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}/test-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    return parseJsonOrThrow(res, 'Failed to test AI employee');
  },

  async rotateIntakeSecret(agentId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}/intake-secret/rotate`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to rotate intake secret');
  },

  // Voices & ElevenLabs Ecosystem
  async getVoices(filters?: {
    language?: string;
    gender?: string;
    provider?: string;
    category?: string;
    accent?: string;
    model_id?: string;
    search?: string;
    favorites_only?: boolean;
    available_only?: boolean;
  }): Promise<{ voices: VoiceProfile[]; count?: number; providers: Record<string, boolean> }> {
    const qs = new URLSearchParams();
    if (filters?.language) qs.set('language', filters.language);
    if (filters?.gender) qs.set('gender', filters.gender);
    if (filters?.provider) qs.set('provider', filters.provider);
    if (filters?.category) qs.set('category', filters.category);
    if (filters?.accent) qs.set('accent', filters.accent);
    if (filters?.model_id) qs.set('model_id', filters.model_id);
    if (filters?.search) qs.set('search', filters.search);
    if (filters?.favorites_only) qs.set('favorites_only', 'true');
    if (filters?.available_only) qs.set('available_only', 'true');
    const res = await authFetch(`${API_BASE}/voices?${qs.toString()}`);
    return parseJsonOrThrow(res, 'Failed to fetch voices');
  },

  async getVoiceLanguages(): Promise<{ languages: any[]; count: number }> {
    const res = await authFetch(`${API_BASE}/voices/languages`);
    return parseJsonOrThrow(res, 'Failed to fetch supported Indian languages');
  },

  async getVoiceModels(provider?: string): Promise<{ models: any[]; profiles: Record<string, string> }> {
    const qs = provider ? `?provider=${encodeURIComponent(provider)}` : '';
    const res = await authFetch(`${API_BASE}/voices/models${qs}`);
    return parseJsonOrThrow(res, 'Failed to fetch voice models');
  },

  async getVoicePersonalities(): Promise<{ personalities: any[] }> {
    const res = await authFetch(`${API_BASE}/voices/personalities`);
    return parseJsonOrThrow(res, 'Failed to fetch voice personalities');
  },

  async verifyElevenLabs(provider?: string): Promise<{
    connected: boolean;
    provider?: string;
    tts_models_count?: number;
    reason?: string;
    subscription?: any;
    elevenlabs?: any;
    sarvam?: any;
  }> {
    const qs = provider ? `?provider=${encodeURIComponent(provider)}` : '';
    const res = await authFetch(`${API_BASE}/voices/verify${qs}`);
    return parseJsonOrThrow(res, 'Failed to verify voice provider connection');
  },

  async verifyVoiceProviders(provider?: string): Promise<{
    connected: boolean;
    provider?: string;
    providers?: Record<string, any>;
  }> {
    const qs = provider ? `?provider=${encodeURIComponent(provider)}` : '';
    const res = await authFetch(`${API_BASE}/voices/verify${qs}`);
    return parseJsonOrThrow(res, 'Failed to verify voice providers');
  },

  async syncVoiceCatalog(): Promise<{ synced: boolean; models_synced: number; voices_synced: number; reason?: string }> {
    const res = await authFetch(`${API_BASE}/voices/sync`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to sync voice catalog');
  },

  async toggleFavoriteVoice(voiceProfileId: string, favorite: boolean): Promise<any> {
    const res = await authFetch(`${API_BASE}/voices/${voiceProfileId}/favorite`, {
      method: favorite ? 'POST' : 'DELETE',
    });
    return parseJsonOrThrow(res, 'Failed to update favorite voice');
  },

  async getVoiceUsage(days = 30): Promise<any> {
    const res = await authFetch(`${API_BASE}/voices/usage?days=${days}`);
    return parseJsonOrThrow(res, 'Failed to fetch voice usage report');
  },

  async previewVoice(payload: {
    voice_id: string;
    provider: string;
    language: string;
    text: string;
    quality_profile?: string;
    personality?: string;
    model_id?: string;
    speed?: number;
    stability?: number;
    similarity_boost?: number;
    style?: number;
    agent_id?: string;
  }): Promise<any> {
    const res = await authFetch(`${API_BASE}/voices/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to preview voice');
  },

  async testVoiceProfile(voiceProfileId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/voices/${voiceProfileId}/test`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to test voice profile');
  },

  async getVoiceEngineStatus(): Promise<any> {
    const res = await authFetch(`${API_BASE}/voice-engine/status`);
    return parseJsonOrThrow(res, 'Failed to fetch voice engine status');
  },

  async runPipelineTurn(payload: { agent_id: string; message: string; history?: any[]; barge_in?: boolean; synthesize_audio?: boolean }): Promise<any> {
    const res = await authFetch(`${API_BASE}/voice-engine/pipeline-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to execute voice pipeline turn');
  },

  async benchmarkVoicePipeline(agentId?: string): Promise<any> {
    const url = agentId ? `${API_BASE}/voice-engine/benchmark?agent_id=${encodeURIComponent(agentId)}` : `${API_BASE}/voice-engine/benchmark`;
    const res = await authFetch(url, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to benchmark voice pipeline');
  },

  // Leads & Contacts
  async getLeads(search?: string, leadStatus?: string): Promise<{ leads: Lead[]; count: number; total?: number }> {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (leadStatus && leadStatus !== 'all') qs.set('lead_status', leadStatus);
    const res = await authFetch(`${API_BASE}/leads?${qs.toString()}`);
    return parseJsonOrThrow(res, 'Failed to fetch leads');
  },

  async createLead(lead: Partial<Lead>): Promise<any> {
    const res = await authFetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    return parseJsonOrThrow(res, 'Failed to create lead');
  },

  async updateLead(leadId: string, updates: Partial<Lead>): Promise<any> {
    const res = await authFetch(`${API_BASE}/leads/${leadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return parseJsonOrThrow(res, 'Failed to update lead');
  },

  async bulkPasteLeads(contacts: any[], listName?: string, consentConfirmed: boolean = false): Promise<any> {
    const res = await authFetch(`${API_BASE}/leads/bulk-paste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts, list_name: listName, consent_confirmed: consentConfirmed }),
    });
    return parseJsonOrThrow(res, 'Failed to import pasted contacts');
  },

  async discoverLeads(city: string, vertical: string, limit: number = 15): Promise<any> {
    const res = await authFetch(`${API_BASE}/leads/discover?city=${encodeURIComponent(city)}&vertical=${encodeURIComponent(vertical)}&limit=${limit}`);
    return parseJsonOrThrow(res, 'Failed to query Lead Scout');
  },

  async uploadLeadsCsv(file: File, columnMapping?: Record<string, string>, consentConfirmed: boolean = false): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (columnMapping) {
      formData.append('column_mapping', JSON.stringify(columnMapping));
    }
    formData.append('consent_confirmed', String(consentConfirmed));
    const res = await authFetch(`${API_BASE}/leads/upload`, { method: 'POST', body: formData });
    return parseJsonOrThrow(res, 'Failed to upload leads CSV');
  },

  async toggleLeadOptOut(leadId: string, optOut: boolean = true): Promise<any> {
    const res = await authFetch(`${API_BASE}/leads/${leadId}/opt-out?opt_out=${optOut}`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to update opt-out status');
  },

  async getLeadDetail(leadId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/leads/${leadId}`);
    return parseJsonOrThrow(res, 'Failed to load lead details');
  },

  async getContactLists(listType?: string): Promise<{ lists: any[] }> {
    const url = listType ? `${API_BASE}/contact-lists?list_type=${encodeURIComponent(listType)}` : `${API_BASE}/contact-lists`;
    const res = await authFetch(url);
    return parseJsonOrThrow(res, 'Failed to fetch contact lists');
  },

  async createContactList(payload: { name: string; list_type?: string; description?: string; phones?: string[]; lead_ids?: string[] }): Promise<any> {
    const res = await authFetch(`${API_BASE}/contact-lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to create contact list');
  },

  async deleteContactList(listId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/contact-lists/${listId}`, { method: 'DELETE' });
    return parseJsonOrThrow(res, 'Failed to delete contact list');
  },

  // Calls & Transcripts
  async getCalls(filters?: { direction?: string; agent_id?: string; search?: string; outcome?: string }): Promise<{ calls: CallLog[]; count: number }> {
    const qs = new URLSearchParams();
    if (filters?.direction) qs.set('direction', filters.direction);
    if (filters?.agent_id) qs.set('agent_id', filters.agent_id);
    if (filters?.search) qs.set('search', filters.search);
    if (filters?.outcome) qs.set('outcome', filters.outcome);
    const res = await authFetch(`${API_BASE}/calls?${qs.toString()}`);
    return parseJsonOrThrow(res, 'Failed to fetch calls');
  },

  async getActiveCalls(): Promise<{ active_calls: CallLog[]; count: number }> {
    const res = await authFetch(`${API_BASE}/calls/active`);
    return parseJsonOrThrow(res, 'Failed to fetch active calls');
  },

  async getCallDetail(callId: string): Promise<CallLog> {
    const res = await authFetch(`${API_BASE}/calls/${callId}`);
    return parseJsonOrThrow(res, 'Failed to fetch call detail');
  },

  async analyzeCall(callId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/calls/${callId}/analyze`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to analyze call');
  },

  async triggerInstantCall(
    nameOrPayload: string | { name: string; phone: string; vertical?: string; language?: string; agent_id?: string; is_sandbox?: boolean; call_category?: string },
    phone?: string,
    vertical: string = 'Real Estate',
    language: string = 'te-IN',
    agentId?: string
  ): Promise<any> {
    const payload = typeof nameOrPayload === 'object'
      ? nameOrPayload
      : { name: nameOrPayload, phone, vertical, language, agent_id: agentId, is_sandbox: false };

    const res = await authFetch(`${API_BASE}/calls/instant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to dispatch instant call');
  },

  async simulateInboundCall(payload: { to_number: string; from_number: string; caller_name?: string; initial_query?: string }): Promise<any> {
    const res = await authFetch(`${API_BASE}/inbound/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to simulate inbound call');
  },

  async retriggerWhatsApp(callId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/calls/${callId}/whatsapp`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to trigger WhatsApp follow-up');
  },

  // Campaigns
  async getCampaigns(): Promise<{ campaigns: CampaignItem[]; count: number }> {
    const res = await authFetch(`${API_BASE}/campaigns`);
    return parseJsonOrThrow(res, 'Failed to fetch campaigns');
  },

  async getCampaignDetail(campaignId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/campaigns/${campaignId}`);
    return parseJsonOrThrow(res, 'Failed to fetch campaign details');
  },

  async createCampaign(payload: { name: string; agent_id?: string; list_id?: string; suppression_list_id?: string; concurrency?: number; retry_attempts?: number; retry_delay_minutes?: number; calling_hours?: any; calling_days?: string[]; scheduled_at?: string; is_sandbox?: boolean }): Promise<any> {
    const res = await authFetch(`${API_BASE}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to create campaign');
  },

  async processCampaignRetries(campaignId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/campaigns/${campaignId}/process-retries`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to process campaign retries');
  },

  async startCampaign(
    concurrencyOrPayload?: number | { campaign_id?: string; concurrency?: number; max_calls?: number; bypass_trai?: boolean; is_sandbox?: boolean },
    maxCalls: number = 20,
    bypassTrai: boolean = false
  ): Promise<any> {
    const payload = typeof concurrencyOrPayload === 'object'
      ? concurrencyOrPayload
      : { concurrency: concurrencyOrPayload || 5, max_calls: maxCalls, bypass_trai: bypassTrai };

    const res = await authFetch(`${API_BASE}/campaigns/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to start campaign');
  },

  async simulateCampaignProgress(campaignId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/campaigns/${campaignId}/simulate-progress`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to simulate campaign progress');
  },

  async pauseCampaign(campaignId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/campaigns/${campaignId}/pause`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to pause campaign');
  },

  async resumeCampaign(campaignId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/campaigns/${campaignId}/resume`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to resume campaign');
  },

  async killCampaign(campaignId?: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/campaigns/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId || null }),
    });
    return parseJsonOrThrow(res, 'Emergency kill switch failed');
  },

  // Voice Broadcasts
  async getBroadcasts(): Promise<{ broadcasts: any[]; count: number }> {
    const res = await authFetch(`${API_BASE}/broadcasts`);
    return parseJsonOrThrow(res, 'Failed to fetch broadcasts');
  },

  async createBroadcast(payload: any): Promise<any> {
    const res = await authFetch(`${API_BASE}/broadcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to create voice broadcast');
  },

  async startBroadcast(broadcastId: string, isSandbox: boolean = true): Promise<any> {
    const res = await authFetch(`${API_BASE}/broadcasts/${broadcastId}/start?is_sandbox=${isSandbox}`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to start broadcast');
  },

  async pauseBroadcast(broadcastId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/broadcasts/${broadcastId}/pause`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to pause broadcast');
  },

  async uploadBroadcastAudio(file: File): Promise<any> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await authFetch(`${API_BASE}/broadcasts/upload-audio`, { method: 'POST', body: fd });
    return parseJsonOrThrow(res, 'Failed to upload broadcast audio');
  },

  async uploadBroadcastCsv(broadcastId: string, file: File): Promise<any> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await authFetch(`${API_BASE}/broadcasts/${broadcastId}/recipients/csv`, { method: 'POST', body: fd });
    return parseJsonOrThrow(res, 'Failed to upload broadcast recipients CSV');
  },

  // Knowledge Base
  async getKnowledgeDocuments(agentId?: string): Promise<{ documents: KnowledgeDocument[] }> {
    const url = agentId ? `${API_BASE}/knowledge/documents?agent_id=${encodeURIComponent(agentId)}` : `${API_BASE}/knowledge/documents`;
    const res = await authFetch(url);
    return parseJsonOrThrow(res, 'Failed to fetch knowledge documents');
  },

  async addKnowledgeText(payload: { title: string; content: string; source_type: string; agent_id?: string }): Promise<any> {
    const res = await authFetch(`${API_BASE}/knowledge/documents/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to ingest knowledge text');
  },

  async addKnowledgeUrl(payload: { title?: string; url: string; agent_id?: string }): Promise<any> {
    const res = await authFetch(`${API_BASE}/knowledge/documents/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to ingest URL');
  },

  async uploadKnowledgeFile(file: File, agentId?: string): Promise<any> {
    const fd = new FormData();
    fd.append('file', file);
    if (agentId) fd.append('agent_id', agentId);
    const res = await authFetch(`${API_BASE}/knowledge/documents/upload`, { method: 'POST', body: fd });
    return parseJsonOrThrow(res, 'Failed to upload knowledge document');
  },

  async deleteKnowledgeDocument(docId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/knowledge/documents/${docId}`, { method: 'DELETE' });
    return parseJsonOrThrow(res, 'Failed to delete knowledge document');
  },

  async searchKnowledge(query: string, agentId?: string): Promise<{ results: any[] }> {
    const res = await authFetch(`${API_BASE}/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, agent_id: agentId, top_k: 4 }),
    });
    return parseJsonOrThrow(res, 'Knowledge retrieval search failed');
  },

  // Actions
  async getAgentActions(agentId: string): Promise<{ actions: any[] }> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}/actions`);
    return parseJsonOrThrow(res, 'Failed to load agent actions');
  },

  async createAgentAction(agentId: string, payload: any): Promise<any> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to create agent action');
  },

  async deleteAgentAction(agentId: string, actionId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/agents/${agentId}/actions/${actionId}`, { method: 'DELETE' });
    return parseJsonOrThrow(res, 'Failed to delete agent action');
  },

  // Integrations & Webhooks
  async getIntegrations(): Promise<{ integrations: any[] }> {
    const res = await authFetch(`${API_BASE}/integrations`);
    return parseJsonOrThrow(res, 'Failed to fetch integrations');
  },

  async connectIntegration(providerKey: string, config: Record<string, any>): Promise<any> {
    const res = await authFetch(`${API_BASE}/integrations/${providerKey}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    return parseJsonOrThrow(res, 'Failed to connect integration');
  },

  async testIntegration(providerKey: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/integrations/${providerKey}/test`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to test integration');
  },

  async getWebhooks(): Promise<{ webhooks: any[] }> {
    const res = await authFetch(`${API_BASE}/webhooks`);
    return parseJsonOrThrow(res, 'Failed to fetch webhooks');
  },

  async createWebhook(payload: { name: string; url: string; events: string[]; include_transcripts?: boolean }): Promise<any> {
    const res = await authFetch(`${API_BASE}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to create webhook');
  },

  async rotateWebhookSecret(webhookId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/webhooks/${webhookId}/rotate-secret`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to rotate webhook secret');
  },

  async deleteWebhook(webhookId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/webhooks/${webhookId}`, { method: 'DELETE' });
    return parseJsonOrThrow(res, 'Failed to delete webhook');
  },

  async getWebhookDeliveries(): Promise<{ deliveries: any[] }> {
    const res = await authFetch(`${API_BASE}/webhooks/deliveries`);
    return parseJsonOrThrow(res, 'Failed to fetch webhook deliveries');
  },

  async getIntegrationLogs(): Promise<{ logs: any[] }> {
    const res = await authFetch(`${API_BASE}/integrations/logs`);
    return parseJsonOrThrow(res, 'Failed to fetch integration logs');
  },

  async retryIntegrationLog(logId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/integrations/logs/${logId}/retry`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to retry integration log');
  },

  async getWhatsAppTemplates(): Promise<{ templates: any[] }> {
    const res = await authFetch(`${API_BASE}/whatsapp/templates`);
    return parseJsonOrThrow(res, 'Failed to fetch WhatsApp templates');
  },

  async createWhatsAppTemplate(payload: any): Promise<any> {
    const res = await authFetch(`${API_BASE}/whatsapp/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to create WhatsApp template');
  },

  async getCallerMemories(): Promise<{ memories: any[] }> {
    const res = await authFetch(`${API_BASE}/caller-memory`);
    return parseJsonOrThrow(res, 'Failed to fetch caller memories');
  },

  async deleteCallerMemory(memoryId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/caller-memory/${memoryId}`, { method: 'DELETE' });
    return parseJsonOrThrow(res, 'Failed to delete caller memory');
  },

  async getConsents(): Promise<{ consents: any[] }> {
    const res = await authFetch(`${API_BASE}/compliance/consents`);
    return parseJsonOrThrow(res, 'Failed to fetch consent records');
  },

  async getAuditLogs(): Promise<{ audit_logs: any[] }> {
    const res = await authFetch(`${API_BASE}/audit-logs`);
    return parseJsonOrThrow(res, 'Failed to fetch audit logs');
  },

  async getAdminFailedCalls(): Promise<{ failed_calls: any[] }> {
    const res = await authFetch(`${API_BASE}/admin/failed-calls`);
    return parseJsonOrThrow(res, 'Failed to fetch failed calls');
  },

  async getAdminSystemErrors(): Promise<{ errors: any[] }> {
    const res = await authFetch(`${API_BASE}/admin/system-errors`);
    return parseJsonOrThrow(res, 'Failed to fetch system errors');
  },

  async getAdminAuditLogs(): Promise<{ audit_logs: any[] }> {
    const res = await authFetch(`${API_BASE}/admin/audit-logs`);
    return parseJsonOrThrow(res, 'Failed to fetch platform audit logs');
  },

  // Phone Numbers & Channels
  async getPhoneNumbers(): Promise<{ phone_numbers: any[]; channels: any[]; provider_status: any }> {
    const res = await authFetch(`${API_BASE}/phone-numbers`);
    return parseJsonOrThrow(res, 'Failed to fetch phone numbers');
  },

  async requestPhoneNumber(payload: any): Promise<any> {
    const res = await authFetch(`${API_BASE}/phone-numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to provision phone number');
  },

  async updatePhoneNumber(numberId: string, updates: any): Promise<any> {
    const res = await authFetch(`${API_BASE}/phone-numbers/${numberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return parseJsonOrThrow(res, 'Failed to update phone number');
  },

  async addCallingChannel(payload: { provider: string; channel_capacity: number; phone_number_id?: string }): Promise<any> {
    const res = await authFetch(`${API_BASE}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to add channels');
  },

  // Billing & Invoices
  async getPricing(): Promise<PricingCatalog> {
    const res = await authFetch(`${API_BASE}/billing/pricing`);
    return parseJsonOrThrow(res, 'Failed to fetch pricing catalog');
  },

  async getTransactions(): Promise<{ transactions: Transaction[] }> {
    const res = await authFetch(`${API_BASE}/billing/transactions`);
    return parseJsonOrThrow(res, 'Failed to fetch transactions');
  },

  async getInvoices(): Promise<{ invoices: any[] }> {
    const res = await authFetch(`${API_BASE}/billing/invoices`);
    return parseJsonOrThrow(res, 'Failed to fetch invoices');
  },

  async createRazorpayOrder(amountInr: number): Promise<any> {
    const res = await authFetch(`${API_BASE}/billing/razorpay-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_inr: amountInr }),
    });
    return parseJsonOrThrow(res, 'Failed to create Razorpay order');
  },

  async verifyRazorpayPayment(payload: { order_id: string; payment_id: string; signature: string }): Promise<any> {
    const res = await authFetch(`${API_BASE}/billing/razorpay-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to verify Razorpay payment');
  },

  async submitRazorpayWebhook(payload: { order_id: string; payment_id: string; signature: string; amount_inr?: number }): Promise<any> {
    return this.verifyRazorpayPayment(payload);
  },

  async sandboxTopup(amountInr: number): Promise<any> {
    const res = await authFetch(`${API_BASE}/billing/sandbox-topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_inr: amountInr }),
    });
    return parseJsonOrThrow(res, 'Failed to perform sandbox top-up');
  },

  // Compliance, Workspaces, Notifications, Super Admin
  async getCompliancePolicy(): Promise<any> {
    const res = await authFetch(`${API_BASE}/compliance/policy`);
    return parseJsonOrThrow(res, 'Failed to fetch compliance policy');
  },

  async updateCompliancePolicy(updates: any): Promise<any> {
    const res = await authFetch(`${API_BASE}/compliance/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return parseJsonOrThrow(res, 'Failed to update compliance policy');
  },

  async getDncEntries(): Promise<{ entries: any[] }> {
    const res = await authFetch(`${API_BASE}/compliance/dnc`);
    return parseJsonOrThrow(res, 'Failed to fetch DNC registry');
  },

  async addDncEntry(phone: string, reason: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/compliance/dnc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, reason }),
    });
    return parseJsonOrThrow(res, 'Failed to add DNC entry');
  },

  async listDltRegistrations(): Promise<{ registrations: any[]; count: number }> {
    const res = await authFetch(`${API_BASE}/compliance/dlt`);
    return parseJsonOrThrow(res, 'Failed to fetch DLT registrations');
  },

  async registerDltEntity(payload: {
    entity_name: string;
    pe_id: string;
    tm_id?: string;
    header_id: string;
    template_id?: string;
    template_name?: string;
    template_content?: string;
    call_category?: string;
  }): Promise<any> {
    const res = await authFetch(`${API_BASE}/compliance/dlt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to register DLT entity');
  },

  async runNcprScrub(phones?: string[]): Promise<any> {
    const res = await authFetch(`${API_BASE}/compliance/ncpr/scrub`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones: phones && phones.length > 0 ? phones : undefined }),
    });
    return parseJsonOrThrow(res, 'Failed to run NCPR scrub');
  },

  async listNcprJobs(): Promise<{ jobs: any[]; count: number }> {
    const res = await authFetch(`${API_BASE}/compliance/ncpr/jobs`);
    return parseJsonOrThrow(res, 'Failed to fetch NCPR scrub jobs');
  },

  async getWorkspace(): Promise<any> {
    const res = await authFetch(`${API_BASE}/workspaces/current`);
    return parseJsonOrThrow(res, 'Failed to load workspace settings');
  },

  async updateWorkspace(updates: any): Promise<any> {
    const res = await authFetch(`${API_BASE}/workspaces/current`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return parseJsonOrThrow(res, 'Failed to update workspace');
  },

  async getWorkspaceMembers(): Promise<{ members: any[] }> {
    const res = await authFetch(`${API_BASE}/workspaces/members`);
    return parseJsonOrThrow(res, 'Failed to fetch workspace members');
  },

  async inviteMember(payload: { email: string; full_name?: string; role: string }): Promise<any> {
    const res = await authFetch(`${API_BASE}/workspaces/members/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to invite member');
  },

  async getApiKeys(): Promise<{ api_keys: any[] }> {
    const res = await authFetch(`${API_BASE}/workspaces/api-keys`);
    return parseJsonOrThrow(res, 'Failed to fetch API keys');
  },

  async createApiKey(name: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/workspaces/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseJsonOrThrow(res, 'Failed to create API key');
  },

  async getNotifications(): Promise<{ notifications: any[]; unread_count: number }> {
    const res = await authFetch(`${API_BASE}/notifications`);
    return parseJsonOrThrow(res, 'Failed to fetch notifications');
  },

  async markAllNotificationsRead(): Promise<any> {
    const res = await authFetch(`${API_BASE}/notifications/read-all`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to mark notifications read');
  },

  async getAdminOverview(): Promise<any> {
    const res = await authFetch(`${API_BASE}/admin/overview`);
    return parseJsonOrThrow(res, 'Failed to load Super Admin overview');
  },

  async getAdminWorkspaces(): Promise<{ workspaces: any[] }> {
    const res = await authFetch(`${API_BASE}/admin/workspaces`);
    return parseJsonOrThrow(res, 'Failed to load workspaces');
  },

  async toggleWorkspaceSuspension(tenantId: string, suspend: boolean): Promise<any> {
    const action = suspend ? 'suspend' : 'activate';
    const res = await authFetch(`${API_BASE}/admin/workspaces/${tenantId}/${action}`, { method: 'POST' });
    return parseJsonOrThrow(res, `Failed to ${action} workspace`);
  },

  async updateAdminTariffs(tariffs: any): Promise<any> {
    const res = await authFetch(`${API_BASE}/admin/settings/tariffs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tariffs),
    });
    return parseJsonOrThrow(res, 'Failed to update tariffs');
  },

  async getAdminFeatureFlags(): Promise<{ feature_flags: any[] }> {
    const res = await authFetch(`${API_BASE}/admin/feature-flags`);
    return parseJsonOrThrow(res, 'Failed to load feature flags');
  },

  async toggleFeatureFlag(key: string, enabled: boolean): Promise<any> {
    const res = await authFetch(`${API_BASE}/admin/feature-flags/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    return parseJsonOrThrow(res, 'Failed to update feature flag');
  },

  async getReadiness(): Promise<ReadinessStatus> {
    const res = await fetch(`${API_BASE}/readiness`);
    return parseJsonOrThrow(res, 'Failed to fetch readiness status');
  },

  async verifyPhoneNumbers(provider: string = 'exotel'): Promise<{ provider: string; verified: boolean; numbers: string[]; error?: string }> {
    const res = await authFetch(`${API_BASE}/phone-numbers/verify?provider=${encodeURIComponent(provider)}`, { method: 'POST' });
    return parseJsonOrThrow(res, 'Failed to verify carrier numbers');
  },

  async getDispositions(): Promise<{ tenant_id: string; mapping: Record<string, string> }> {
    const res = await authFetch(`${API_BASE}/compliance/dispositions`);
    return parseJsonOrThrow(res, 'Failed to load disposition mapping');
  },

  async updateDispositions(mapping: Record<string, string>): Promise<{ status: string; mapping: Record<string, string> }> {
    const res = await authFetch(`${API_BASE}/compliance/dispositions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapping }),
    });
    return parseJsonOrThrow(res, 'Failed to save disposition mapping');
  },

  async transferCall(callId: string, targetPhone: string, reason?: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/calls/${callId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_phone: targetPhone, reason }),
    });
    return parseJsonOrThrow(res, 'Failed to initiate warm call transfer');
  },

  async downloadCallsCsv(): Promise<void> {
    return downloadAuthenticatedCsv(`${API_BASE}/calls/export`, 'trivaana_call_history.csv', 'Failed to export call history CSV');
  },

  async downloadCampaignCsv(campaignId: string): Promise<void> {
    return downloadAuthenticatedCsv(
      `${API_BASE}/campaigns/${encodeURIComponent(campaignId)}/export`,
      `campaign_${campaignId}.csv`,
      'Failed to export campaign CSV'
    );
  },

  async evaluateAgent(agentId: string, minPassRate = 0.75): Promise<any> {
    const res = await authFetch(`${API_BASE}/voice-engine/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, min_pass_rate: minPassRate }),
    });
    return parseJsonOrThrow(res, 'Failed to run agent evaluation scorecard');
  },

  async revokeApiKey(keyId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/workspaces/api-keys/${encodeURIComponent(keyId)}`, {
      method: 'DELETE',
    });
    return parseJsonOrThrow(res, 'Failed to revoke API key');
  },

  async removeMember(memberId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/workspaces/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    });
    return parseJsonOrThrow(res, 'Failed to remove team member');
  },

  async acceptWorkspaceInvite(payload: { invite_token: string; full_name: string; password: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonOrThrow(res, 'Failed to accept workspace invitation');
    if (data?.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  },

  async submitPublicContact(payload: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    plan_interest?: string;
    message: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/public/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'Failed to submit contact inquiry');
  },

  async getLeadTimeline(leadId: string): Promise<{ lead: any; timeline: any[] }> {
    const res = await authFetch(`${API_BASE}/leads/${encodeURIComponent(leadId)}/timeline`);
    return parseJsonOrThrow(res, 'Failed to fetch lead timeline');
  },

  async getSubscription(): Promise<{ plan: string; concurrency_limit: number; subscription: any }> {
    const res = await authFetch(`${API_BASE}/billing/subscription`);
    return parseJsonOrThrow(res, 'Failed to load subscription');
  },

  async updateSubscription(planId: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/billing/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId }),
    });
    return parseJsonOrThrow(res, 'Failed to update subscription plan');
  },

  async getAdminUsers(): Promise<{ users: any[] }> {
    const res = await authFetch(`${API_BASE}/admin/users`);
    return parseJsonOrThrow(res, 'Failed to load platform users');
  },
};
