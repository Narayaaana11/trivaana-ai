import { getAuthToken } from '@/lib/trivaana-api';

async function authJsonFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export const platformService = {
  // Appointments
  listAppointments: (statusFilter?: string) =>
    authJsonFetch<{ appointments: any[] }>(
      `/api/appointments${statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : ''}`
    ),
  createAppointment: (payload: {
    contact_name: string;
    phone: string;
    email?: string;
    title: string;
    scheduled_start: string;
    scheduled_end: string;
    notes?: string;
  }) => authJsonFetch('/api/appointments', { method: 'POST', body: JSON.stringify(payload) }),
  updateAppointment: (id: string, payload: { status?: string; notes?: string }) =>
    authJsonFetch(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Workflows (React Flow + Temporal)
  listWorkflows: () => authJsonFetch<{ workflows: any[]; count: number }>('/api/workflows'),
  createWorkflow: (payload: { name: string; trigger_type: string; is_active?: boolean; graph: any }) =>
    authJsonFetch('/api/workflows', { method: 'POST', body: JSON.stringify(payload) }),
  updateWorkflow: (id: string, payload: { name: string; trigger_type: string; is_active?: boolean; graph: any }) =>
    authJsonFetch(`/api/workflows/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  executeWorkflow: (id: string, payload: { trigger_event: string; context?: Record<string, any> }) =>
    authJsonFetch(`/api/workflows/${id}/execute`, { method: 'POST', body: JSON.stringify(payload) }),
  listWorkflowExecutions: (id: string) =>
    authJsonFetch<{ executions: any[] }>(`/api/workflows/${id}/executions`),

  // Customer Support & Staff Portal
  listMyTickets: () => authJsonFetch<{ tickets: any[] }>('/api/support/tickets'),
  createSupportTicket: (payload: { subject: string; description: string; category: string; priority: string }) =>
    authJsonFetch('/api/support/tickets', { method: 'POST', body: JSON.stringify(payload) }),

  staffListTickets: (statusFilter?: string) =>
    authJsonFetch<{ tickets: any[] }>(
      `/api/staff/tickets${statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : ''}`
    ),
  staffUpdateTicket: (id: string, payload: { status?: string; resolution_notes?: string }) =>
    authJsonFetch(`/api/staff/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  staffListKycQueue: () => authJsonFetch<{ kyc_items: any[] }>('/api/staff/kyc-queue'),
  staffReviewKyc: (numberId: string, payload: { kyc_status: string; notes?: string }) =>
    authJsonFetch(`/api/staff/kyc-queue/${numberId}/review`, { method: 'POST', body: JSON.stringify(payload) }),

  // Super Admin Finance, Providers & Kill Switch
  adminFinanceSummary: () => authJsonFetch('/api/admin/finance/summary'),
  adminProvidersHealth: () => authJsonFetch('/api/admin/providers/health'),
  adminEmergencyKillSwitch: (outboundPaused: boolean, reason: string) =>
    authJsonFetch('/api/admin/emergency/kill-switch', {
      method: 'POST',
      body: JSON.stringify({ outbound_paused: outboundPaused, reason }),
    }),
};

