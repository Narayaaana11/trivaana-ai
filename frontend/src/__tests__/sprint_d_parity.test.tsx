import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InstantLeadsPanel } from '@/components/dashboard/InstantLeadsPanel';
import { IncomingCallsPanel } from '@/components/dashboard/IncomingCallsPanel';
import { FinancialLedgerPanel } from '@/components/dashboard/FinancialLedgerPanel';
import { SettingsPanel } from '@/components/dashboard/SettingsPanel';
import { DevelopersPanel } from '@/components/dashboard/DevelopersPanel';
import { PhoneNumbersPanel } from '@/components/dashboard/PhoneNumbersPanel';
import { LeadManagementPanel } from '@/components/dashboard/LeadManagementPanel';
import { CallIntelligencePanel } from '@/components/dashboard/CallIntelligencePanel';
import { PublicContactPage } from '@/components/landing/PublicPages';
import { AdminPortal } from '@/apps/admin/AdminPortal';
import { SuperAdminPanel } from '@/components/dashboard/SuperAdminPanel';
import { App } from '@/App';

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('Sprint D End-to-End Parity (RED -> GREEN)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  it('syncs sub-tab state when initialSubTab / initialTab prop changes across panels', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        agents: [],
        calls: [],
        integrations: [],
        phone_numbers: [],
        transactions: [],
        invoices: [],
        pricing_catalog: null,
        tariffs: {
          standard_ai_call_inr_per_min: 6.5,
          premium_ai_call_inr_per_min: 8.5,
          number_rental_inr_per_month: 799,
          channel_rental_inr_per_month: 649,
        },
        billing_rules: { gst_percentage: 18, sac_code: '998313', rounding_increment_seconds: 30, charge_unconnected_calls: false },
        members: [],
        api_keys: [],
        webhooks: [],
        deliveries: [],
        logs: [],
        entries: [],
        memories: [],
        consents: [],
        audit_logs: [],
        subscription: null,
        plan: 'growth',
        concurrency_limit: 15,
      }),
    } as any);

    const inst = renderWithQuery(<InstantLeadsPanel initialSubTab="activity" />);
    inst.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <InstantLeadsPanel initialSubTab="queue" />
      </QueryClientProvider>
    );
    expect(await screen.findByText(/Active Queue \(/i)).toBeInTheDocument();
    inst.unmount();

    const inc = renderWithQuery(<IncomingCallsPanel initialSubTab="overview" />);
    inc.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <IncomingCallsPanel initialSubTab="missed" />
      </QueryClientProvider>
    );
    expect(await screen.findByText(/Missed \/ Callback Queue/i)).toBeInTheDocument();
    inc.unmount();

    const dev = renderWithQuery(<DevelopersPanel initialSubTab="overview" />);
    dev.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <DevelopersPanel initialSubTab="webhooks" />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Webhook Endpoints')).toBeInTheDocument();
    dev.unmount();

    const set = renderWithQuery(<SettingsPanel initialTab="general" />);
    set.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SettingsPanel initialTab="dnc" />
      </QueryClientProvider>
    );
    expect(await screen.findByText(/Do-Not-Call \(DNC\) Suppression List/i)).toBeInTheDocument();
    set.unmount();

    const bil = renderWithQuery(<FinancialLedgerPanel tenant={null} initialSubTab="ledger" />);
    bil.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FinancialLedgerPanel tenant={null} initialSubTab="invoices" />
      </QueryClientProvider>
    );
    expect(await screen.findByText(/No GST invoices generated yet/i)).toBeInTheDocument();
    bil.unmount();
  });

  it('submits PublicContactPage form to POST /api/public/contact', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'received',
        inquiry_id: 'inq_abc12345',
        message: 'Inquiry logged',
      }),
    } as any);

    render(<PublicContactPage onEnterDashboard={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Your Name/i), { target: { value: 'Rohan Sharma' } });
    fireEvent.change(screen.getByPlaceholderText(/Work Email/i), { target: { value: 'rohan@acme.in' } });
    fireEvent.change(screen.getByPlaceholderText(/Tell us about your use case/i), {
      target: { value: 'Need 20 channels in Hyderabad.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Message/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/public/contact',
        expect.objectContaining({ method: 'POST' })
      );
      expect(screen.getByText(/inq_abc12345/i)).toBeInTheDocument();
    });
  });

  it('renders live pricing catalog in PhoneNumbersPanel and subscription selector + GST-inclusive breakdown in FinancialLedgerPanel', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/billing/pricing')) {
        return {
          ok: true,
          json: async () => ({
            currency: 'INR',
            tariffs: {
              standard_ai_call_paise_per_min: 650,
              standard_ai_call_inr_per_min: 6.5,
              premium_ai_call_paise_per_min: 850,
              premium_ai_call_inr_per_min: 8.5,
              number_rental_paise_per_month: 84900,
              number_rental_inr_per_month: 849,
              channel_rental_paise_per_month: 69900,
              channel_rental_inr_per_month: 699,
            },
            billing_rules: { gst_percentage: 18, sac_code: '998313', rounding_increment_seconds: 30, charge_unconnected_calls: false },
            wallet_packages_inr: [500, 1000, 2500],
          }),
        } as any;
      }
      if (url.includes('/api/billing/subscription') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ status: 'updated', plan: 'starter', concurrency_limit: 5 }),
        } as any;
      }
      if (url.includes('/api/billing/subscription')) {
        return {
          ok: true,
          json: async () => ({ plan: 'payg', concurrency_limit: 2, subscription: null }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          phone_numbers: [],
          channels: [],
          agents: [],
          transactions: [],
          invoices: [],
          name: 'Acme',
        }),
      } as any;
    });

    const pn = renderWithQuery(<PhoneNumbersPanel />);
    expect(await screen.findByText(/₹849\/mo/i)).toBeInTheDocument();
    expect(screen.getByText(/₹699\/mo/i)).toBeInTheDocument();
    pn.unmount();

    const fl = renderWithQuery(
      <FinancialLedgerPanel
        tenant={{ id: 't1', name: 'Acme', wallet_balance: 5000, currency: 'INR', rate_per_min: 6.5, plan: 'payg', concurrency_limit: 2, created_at: '' }}
      />
    );
    // GST-inclusive ₹1,000 shows total payable ₹1000.00 (not ₹1180.00)
    expect(await screen.findByText(/₹1000\.00/)).toBeInTheDocument();
    const starterBtn = await screen.findByRole('button', { name: /Activate Starter/i });
    fireEvent.click(starterBtn);
    await waitFor(() => {
      expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes('/api/billing/subscription') && c[1]?.method === 'POST')).toBe(true);
    });
    fl.unmount();
  });

  it('displays lead_score + unified customer timeline in LeadManagementPanel and QA extraction in CallIntelligencePanel', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/leads/lead_hot_1/timeline')) {
        return {
          ok: true,
          json: async () => ({
            lead: { id: 'lead_hot_1', name: 'Ananya Rao', phone: '+919848012345', lead_status: 'interested', lead_score: 88, qualification_tier: 'hot', city: 'Hyderabad', vertical: 'Real Estate', tags: [] },
            timeline: [
              { id: 'ev1', event_type: 'call', title: 'Outbound AI Call (95s)', detail: 'Booked Saturday site visit', status: 'positive', timestamp: '2026-11-12T05:00:00Z' },
            ],
          }),
        } as any;
      }
      if (url.includes('/api/leads/lead_hot_1')) {
        return {
          ok: true,
          json: async () => ({
            id: 'lead_hot_1',
            name: 'Ananya Rao',
            phone: '+919848012345',
            lead_status: 'interested',
            city: 'Hyderabad',
            vertical: 'Real Estate',
            tags: [],
            call_history: [],
            consent_history: [],
          }),
        } as any;
      }
      if (url.includes('/api/leads')) {
        return {
          ok: true,
          json: async () => ({
            leads: [
              { id: 'lead_hot_1', tenant_id: 't1', name: 'Ananya Rao', phone: '+919848012345', city: 'Hyderabad', vertical: 'Real Estate', status: 'qualified', lead_status: 'interested', source: 'CSV', opt_out: 0, lead_score: 88, qualification_tier: 'hot', created_at: '2026-11-11T00:00:00Z' },
            ],
          }),
        } as any;
      }
      if (url.includes('/api/calls/call_qa_1')) {
        return {
          ok: true,
          json: async () => ({
            id: 'call_qa_1',
            contact_name: 'Kiran Reddy',
            phone: '+919989012345',
            direction: 'outbound',
            status: 'completed',
            language: 'en-IN',
            duration: 95,
            cost: 13,
            outcome: 'Interested',
            sentiment: 'positive',
            summary: 'Interested in villa',
            transcript: 'USER: Compare with Bolna please, price is high.',
            transcript_messages: [{ id: 'm1', speaker: 'user', message: 'Compare with Bolna, price is high.', timestamp_ms: 1000 }],
            qa_extraction: {
              qualification_score: 84,
              sentiment: 'positive',
              summary: 'Strong buyer',
              next_action: 'Schedule Site Visit',
              objections: ['Pricing / budget concern'],
              competitors_mentioned: ['Bolna'],
            },
            created_at: '2026-11-12T00:00:00Z',
          }),
        } as any;
      }
      if (url.includes('/api/calls')) {
        return {
          ok: true,
          json: async () => ({
            calls: [{ id: 'call_qa_1', contact_name: 'Kiran Reddy', phone: '+919989012345', direction: 'outbound', status: 'completed', language: 'en-IN', duration: 95, cost: 13, outcome: 'Interested', created_at: '2026-11-12T00:00:00Z' }],
          }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    const lm = renderWithQuery(<LeadManagementPanel />);
    expect(await screen.findByText(/88\/100/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ananya Rao'));
    expect(await screen.findByText(/Booked Saturday site visit/i)).toBeInTheDocument();
    lm.unmount();

    const ci = renderWithQuery(<CallIntelligencePanel />);
    expect(await screen.findByText(/QA Score: 84\/100/i)).toBeInTheDocument();
    expect(screen.getByText(/Pricing \/ budget concern/i)).toBeInTheDocument();
    expect(screen.getByText('Bolna')).toBeInTheDocument();
    ci.unmount();
  });

  it('syncs kill switch status from overview in AdminPortal and shows Platform Users tab in SuperAdminPanel', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/overview')) {
        return {
          ok: true,
          json: async () => ({
            workspaces: { total: 2, active: 2, suspended: 0 },
            total_users: 4,
            calls: { total_calls: 10 },
            unresolved_errors: 0,
            emergency_outbound_paused: true,
            emergency_pause_reason: 'Scheduled DLT check',
          }),
        } as any;
      }
      if (url.includes('/api/admin/users')) {
        return {
          ok: true,
          json: async () => ({
            users: [{ id: 'u_plat_1', email: 'ops@acme.in', full_name: 'Ops Manager', role: 'admin', tenant_name: 'Acme Realty', status: 'active' }],
          }),
        } as any;
      }
      return { ok: true, json: async () => ({ workspaces: [], feature_flags: [], failed_calls: [], errors: [], audit_logs: [] }) } as any;
    });

    const ap = renderWithQuery(<AdminPortal isSuperAdmin={true} onExitToCustomer={vi.fn()} />);
    expect(await screen.findByText(/OUTBOUND PAUSED/i)).toBeInTheDocument();
    ap.unmount();

    const sa = renderWithQuery(<SuperAdminPanel />);
    const usersTab = await screen.findByRole('button', { name: /Users/i });
    fireEvent.click(usersTab);
    expect(await screen.findByText(/ops@acme\.in/i)).toBeInTheDocument();
    sa.unmount();
  });

  it('renders /accept-invite route in App and submits invitation acceptance', async () => {
    window.history.replaceState(null, '', '/accept-invite?token=inv_tok_999');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/accept-invite') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ access_token: 'tok_new', user: { id: 'u_new', full_name: 'Maya' } }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    render(<App />);
    expect(await screen.findByText(/Accept Workspace Invitation/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'Maya Verma' } });
    fireEvent.change(screen.getByPlaceholderText(/Create a strong password/i), { target: { value: 'Secret@2026' } });
    fireEvent.click(screen.getByRole('button', { name: /Join Workspace/i }));

    await waitFor(() => {
      expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes('/api/auth/accept-invite') && c[1]?.method === 'POST')).toBe(true);
    });
  });
});
