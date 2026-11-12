import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminPortal } from '@/apps/admin/AdminPortal';
import { StaffPortal } from '@/apps/staff/StaffPortal';
import { SupportTicketsPanel } from '@/components/dashboard/SupportTicketsPanel';
import { AppointmentsPanel } from '@/components/dashboard/AppointmentsPanel';
import { MissionControl } from '@/components/dashboard/MissionControl';
import { WorkflowsPanel } from '@/components/dashboard/WorkflowsPanel';
import { AgentStudioPanel } from '@/components/dashboard/AgentStudioPanel';
import { DevelopersPanel } from '@/components/dashboard/DevelopersPanel';
import { SettingsPanel } from '@/components/dashboard/SettingsPanel';
import { trivaanaApi } from '@/lib/trivaana-api';

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('Trivaana AI Portals & New Domain Modules', () => {
  beforeEach(() => {
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  it('blocks non-super-admins from AdminPortal', () => {
    renderWithQuery(<AdminPortal isSuperAdmin={false} onExitToCustomer={vi.fn()} />);
    expect(screen.getByText('Super Admin Access Required')).toBeInTheDocument();
  });

  it('blocks non-staff users from StaffPortal', () => {
    renderWithQuery(<StaffPortal hasStaffAccess={false} onExitToCustomer={vi.fn()} />);
    expect(screen.getByText('Internal Staff Access Required')).toBeInTheDocument();
  });

  it('blocks non-super-admin on #/admin in MissionControl instead of rendering SuperAdminPanel', async () => {
    window.location.hash = '#/admin';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            id: 'u1',
            email: 'user@demo.trivaana.ai',
            full_name: 'Regular User',
            role: 'owner',
            is_super_admin: 0,
            staff_role: '',
          }),
        } as any;
      }
      if (url.includes('/api/tenant')) {
        return {
          ok: true,
          json: async () => ({ id: 't1', name: 'Demo', wallet_balance: 500 }),
        } as any;
      }
      if (url.includes('/api/analytics')) {
        return { ok: true, json: async () => ({ total_calls_placed: 0, total_ai_employees: 0 }) } as any;
      }
      return { ok: true, json: async () => ({ calls: [], agents: [], campaigns: [], invoices: [], phone_numbers: [], active_calls: [], notifications: [], unread_count: 0 }) } as any;
    });

    renderWithQuery(<MissionControl onExitDashboard={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Super Admin Access Required')).toBeInTheDocument();
    });
  });

  it('allows non-super-admin staff_role user into #/staff in MissionControl', async () => {
    window.location.hash = '#/staff';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            id: 'u_staff',
            email: 'staff@demo.trivaana.ai',
            full_name: 'Support Ops',
            role: 'operator',
            is_super_admin: 0,
            staff_role: 'support',
          }),
        } as any;
      }
      if (url.includes('/api/tenant')) {
        return {
          ok: true,
          json: async () => ({ id: 't1', name: 'Demo', wallet_balance: 500 }),
        } as any;
      }
      if (url.includes('/api/analytics')) {
        return { ok: true, json: async () => ({ total_calls_placed: 0, total_ai_employees: 0 }) } as any;
      }
      return { ok: true, json: async () => ({ tickets: [], kyc_queue: [], calls: [], phone_numbers: [], active_calls: [], notifications: [], unread_count: 0 }) } as any;
    });

    renderWithQuery(<MissionControl onExitDashboard={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Staff Operations & Support Portal')).toBeInTheDocument();
    });
  });

  it('remounts AgentWorkflowCanvas when switching workflows in WorkflowsPanel', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return { ok: true, json: async () => ({ workflow: { id: 'wf_2', name: 'Flow Two', graph: {} } }) } as any;
      }
      return {
        ok: true,
        json: async () => ({
          workflows: [
            {
              id: 'wf_1',
              name: 'Flow One',
              trigger_type: 'call_completed',
              graph: {
                nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Node Alpha Unique' } }],
                edges: [],
              },
            },
            {
              id: 'wf_2',
              name: 'Flow Two',
              trigger_type: 'lead_created',
              graph: {
                nodes: [{ id: 'n2', position: { x: 0, y: 0 }, data: { label: 'Node Beta Unique' } }],
                edges: [],
              },
            },
          ],
        }),
      } as any;
    });

    renderWithQuery(<WorkflowsPanel />);
    const stepInput = (await screen.findByPlaceholderText('New step (e.g., Check DNC)')) as HTMLInputElement;
    fireEvent.change(stepInput, { target: { value: 'Unsaved Step For Flow One' } });
    expect(stepInput.value).toBe('Unsaved Step For Flow One');

    fireEvent.click(await screen.findByRole('button', { name: /Flow Two/i }));
    await waitFor(() => {
      const remountedInput = screen.getByPlaceholderText('New step (e.g., Check DNC)') as HTMLInputElement;
      expect(remountedInput.value).toBe('');
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Flow/i }));
    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find((c) => c[1]?.method === 'PUT');
      expect(putCall).toBeTruthy();
      expect(String(putCall?.[1]?.body)).toContain('Node Beta Unique');
      expect(String(putCall?.[1]?.body)).not.toContain('Node Alpha Unique');
    });
  });

  it('renders SupportTicketsPanel creation form', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ tickets: [] }),
    } as any);
    renderWithQuery(<SupportTicketsPanel />);
    expect(screen.getByText('Support Tickets')).toBeInTheDocument();
    expect(screen.getByText('Open Support Ticket')).toBeInTheDocument();
  });

  it('renders AppointmentsPanel booking form', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ appointments: [] }),
    } as any);
    renderWithQuery(<AppointmentsPanel />);
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('Reserve Slot')).toBeInTheDocument();
  });

  it('runs Eval Scorecard from AgentStudioPanel and displays readiness status', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/agents')) {
        return {
          ok: true,
          json: async () => ({
            agents: [
              {
                id: 'ag_eval_1',
                name: 'Priya Eval Agent',
                language: 'te-IN',
                status: 'draft',
                system_prompt: 'Help buyers.',
                greeting_message: 'Namaskaram!',
                questions: [],
                extraction_schema: [],
              },
            ],
          }),
        } as any;
      }
      if (url.includes('/api/voice-engine/evaluate') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            agent_id: 'ag_eval_1',
            agent_name: 'Priya Eval Agent',
            total: 4,
            passed: 4,
            pass_rate: 1.0,
            ready_for_publish: true,
            p95_latency_ms: 42,
            results: [
              { case: 'compliance_opt_out', passed: true, detected_language: 'en-IN', latency_ms: 18 },
            ],
          }),
        } as any;
      }
      return { ok: true, json: async () => ({ versions: [], voices: [], documents: [], actions: [], calls: [] }) } as any;
    });

    renderWithQuery(<AgentStudioPanel />);
    const evalBtn = await screen.findByRole('button', { name: /Run Eval Scorecard/i });
    fireEvent.click(evalBtn);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Publish/i)).toBeInTheDocument();
      expect(screen.getByText(/4\/4/)).toBeInTheDocument();
      expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes('/api/voice-engine/evaluate'))).toBe(true);
    });
  });

  it('allows revoking an active API key in DevelopersPanel and removing non-owner members in SettingsPanel', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/workspaces/api-keys/key_active_1') && init?.method === 'DELETE') {
        return { ok: true, json: async () => ({ status: 'revoked', id: 'key_active_1' }) } as any;
      }
      if (url.endsWith('/api/workspaces/api-keys')) {
        return {
          ok: true,
          json: async () => ({
            api_keys: [
              { id: 'key_active_1', name: 'Live CRM Sync', key_prefix: 'trv_live_', created_at: '2026-11-10T00:00:00Z', revoked_at: null },
            ],
          }),
        } as any;
      }
      if (url.includes('/api/workspaces/members/mem_op_1') && init?.method === 'DELETE') {
        return { ok: true, json: async () => ({ status: 'removed', id: 'mem_op_1' }) } as any;
      }
      if (url.endsWith('/api/workspaces/members')) {
        return {
          ok: true,
          json: async () => ({
            members: [
              { id: 'mem_own', email: 'owner@demo.trivaana.ai', full_name: 'Owner', role: 'owner', status: 'active' },
              { id: 'mem_op_1', email: 'op@demo.trivaana.ai', full_name: 'Operator One', role: 'operator', status: 'active' },
            ],
          }),
        } as any;
      }
      if (url.endsWith('/api/workspaces/current')) {
        return { ok: true, json: async () => ({ id: 't1', name: 'Demo', low_balance_threshold_paise: 50000 }) } as any;
      }
      return { ok: true, json: async () => ({ webhooks: [], agents: [], entries: [], audit_logs: [], logs: [], entries_count: 0, memories: [], consents: [], policy: null, mapping: {} }) } as any;
    });

    const { unmount } = renderWithQuery(<DevelopersPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /API Keys/i }));
    const revokeBtn = await screen.findByRole('button', { name: /Revoke/i });
    fireEvent.click(revokeBtn);
    await waitFor(() => {
      expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes('/api/workspaces/api-keys/key_active_1') && c[1]?.method === 'DELETE')).toBe(true);
    });
    unmount();

    renderWithQuery(<SettingsPanel initialTab="account" />);
    const removeBtn = await screen.findByRole('button', { name: /Remove/i });
    fireEvent.click(removeBtn);
    await waitFor(() => {
      expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes('/api/workspaces/members/mem_op_1') && c[1]?.method === 'DELETE')).toBe(true);
    });
  });

  it('rejects non-OK responses cleanly in centralized CSV export helper', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: 'Forbidden CSV export' }),
    } as any);
    await expect(trivaanaApi.downloadCampaignCsv('camp_denied')).rejects.toThrow('Forbidden CSV export');
  });
});

