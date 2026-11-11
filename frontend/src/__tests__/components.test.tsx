import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthModal } from '@/components/auth/AuthModal';
import { AppSidebar } from '@/components/dashboard/AppSidebar';
import { OverviewPanel } from '@/components/dashboard/OverviewPanel';
import { LeadManagementPanel } from '@/components/dashboard/LeadManagementPanel';
import { FinancialLedgerPanel } from '@/components/dashboard/FinancialLedgerPanel';
import { LandingPage } from '@/components/landing/LandingPage';
import { DocsPortalPage } from '@/components/landing/DocsPortalPage';
import { MissionControl } from '@/components/dashboard/MissionControl';
import {
  GradientText,
  RotatingText,
  DecryptedText,
  VoicePill,
  SquishSwitch,
  Stepper,
  PillNav,
  LogoLoop,
  StatusMark,
  ReactBitsShowcaseModal,
} from '@/components/reactbits';
import { Tenant, AnalyticsStats } from '@/types/trivaana';

const mockTenant: Tenant = {
  id: 'ten_demo',
  name: 'Trivaana Demo Enterprise',
  wallet_balance: 520,
  wallet_balance_paise: 52000,
  currency: 'INR',
  rate_per_min: 6.5,
  plan: 'Growth',
  concurrency_limit: 10,
  created_at: '2026-01-01T00:00:00Z',
};

const mockStats: AnalyticsStats = {
  wallet_balance_inr: 520,
  total_ai_employees: 2,
  active_ai_employees: 2,
  total_leads: 14,
  total_calls_placed: 8,
  connected_calls: 6,
  connection_rate_pct: 75,
  total_duration_minutes: 12.5,
  demos_booked: 3,
  demo_conversion_rate: '37.5%',
  turn_taking_latency_ms: 420,
  active_concurrency: 1,
  voice_engine: 'sarvam',
  daily_series: [
    { date: '2026-11-09', total: 4, connected: 3, unanswered: 1, spend_inr: 24 },
    { date: '2026-11-10', total: 4, connected: 3, unanswered: 1, spend_inr: 26 },
  ],
};

describe('Trivaana AI Core UI Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    window.location.hash = '';
  });

  it('renders AuthModal modes (Sign In, Register, Forgot Password)', () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByText('Sign In to Trivaana AI')).toBeInTheDocument();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Forgot password?'));
    expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
    expect(screen.getByText('Send Reset Token')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back to Sign In'));
    fireEvent.click(screen.getByText("Don't have an account? Create new workspace"));
    expect(screen.getByText('Create Workspace Account')).toBeInTheDocument();
  });

  it('renders AppSidebar grouped sections, credits minutes estimate, and triggers navigation', () => {
    const onSelectTab = vi.fn();
    render(
      <AppSidebar
        currentTab="overview"
        onSelectTab={onSelectTab}
        tenant={mockTenant}
        stats={mockStats}
        isSuperAdmin={true}
        onOpenSimulator={vi.fn()}
        onExitDashboard={vi.fn()}
      />
    );

    expect(screen.getByText('AI EMPLOYEES')).toBeInTheDocument();
    expect(screen.getByText('RESULTS')).toBeInTheDocument();
    expect(screen.getByText('CALLING')).toBeInTheDocument();
    expect(screen.getByText('WORKSPACE')).toBeInTheDocument();
    expect(screen.getByText('PLATFORM')).toBeInTheDocument();
    expect(screen.getByText(/~80 min of calls/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Campaigns'));
    expect(onSelectTab).toHaveBeenCalledWith('campaigns');

    fireEvent.click(screen.getByText('Super Admin'));
    expect(onSelectTab).toHaveBeenCalledWith('super-admin');
  });

  it('renders OverviewPanel prompt builder, 14-category template drawer, and live KPI metrics', () => {
    const onNavigateTab = vi.fn();
    render(
      <OverviewPanel
        stats={mockStats}
        tenant={mockTenant}
        calls={[]}
        onNavigateTab={onNavigateTab}
        onOpenSimulator={vi.fn()}
      />
    );

    expect(screen.getByText(/What should your AI employee do\?/i)).toBeInTheDocument();
    expect(screen.getByText(/75% Connected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Templates/i }));
    expect(screen.getByText(/BFSI \(10\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Real estate/i)).toBeInTheDocument();
  });

  it('renders LeadManagementPanel 4-way view switcher, More filters, and fetched contacts', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        leads: [
          {
            id: 'lead_1',
            tenant_id: 'ten_demo',
            name: 'Aarav Reddy',
            phone: '+919848011122',
            city: 'Hyderabad',
            vertical: 'Real Estate',
            status: 'pending',
            lead_status: 'interested',
            source: 'CRM',
            opt_out: 0,
            created_at: '2026-11-10T00:00:00Z',
          },
        ],
      }),
    } as any);

    render(<LeadManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Aarav Reddy')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Pipeline/i }));
    expect(screen.getByText('+919848011122')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /More filters/i }));
    expect(screen.getByPlaceholderText(/Filter by city/i)).toBeInTheDocument();
  });

  it('renders FinancialLedgerPanel 18% GST breakdown and Billing Details sub-tab', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/transactions')) {
        return { ok: true, json: async () => ({ transactions: [] }) } as any;
      }
      if (url.includes('/invoices')) {
        return { ok: true, json: async () => ({ invoices: [] }) } as any;
      }
      if (url.includes('/workspaces/current')) {
        return {
          ok: true,
          json: async () => ({ name: 'Trivaana Demo Enterprise', gstin: '29ABCDE1234F1Z5', billing_email: 'accounts@trivaana.ai' }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    render(<FinancialLedgerPanel tenant={mockTenant} />);

    expect(screen.getByText(/GST \(18% SAC 998313\):/i)).toBeInTheDocument();
    expect(screen.getByText('₹180.00')).toBeInTheDocument();
    expect(screen.getByText('₹1180.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Billing Details/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue('29ABCDE1234F1Z5')).toBeInTheDocument();
    });
  });

  it('opens CSV Column Mapper modal in LeadManagementPanel when selecting a CSV file', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [] }),
    } as any);

    const { container } = render(<LeadManagementPanel />);
    const fileInput = container.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const csvFile = new File(['FullName,Mobile,Town\nKiran,+919848055566,Vizag'], 'leads.csv', { type: 'text/csv' });
    if (!csvFile.text) {
      (csvFile as any).text = async () => 'FullName,Mobile,Town\nKiran,+919848055566,Vizag';
    }
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(screen.getByText('Map CSV Columns')).toBeInTheDocument();
      expect(screen.getAllByText('FullName').length).toBeGreaterThan(0);
    });
  });

  it('renders LandingPage Outpero-parity sections, dark prompt builder, voice auditions, and 3-mode switcher', () => {
    const onEnter = vi.fn();
    render(<LandingPage onEnterDashboard={onEnter} onOpenSimulator={vi.fn()} />);

    expect(screen.getByText(/What should your AI telecaller do\?/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Voices your customers won't hang up on\./i)).toBeInTheDocument();
    expect(screen.getByLabelText(/One AI employee\. Instant, bulk, and inbound\./i)).toBeInTheDocument();

    const bulkBtns = screen.getAllByRole('button', { name: /Bulk Campaigns/i });
    fireEvent.click(bulkBtns[bulkBtns.length - 1]);
    expect(screen.getByText(/Hand over the list → get back only the interested leads/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Build my employee/i }));
    expect(localStorage.getItem('trivaana_landing_draft')).toContain('"mode"');
    expect(onEnter).toHaveBeenCalled();
  });

  it('renders MissionControl theme toggle, interactive Take the tour modal, and account menu', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/workspaces/current') || url.includes('/tenants/me')) {
        return { ok: true, json: async () => mockTenant } as any;
      }
      if (url.includes('/stats') || url.includes('/analytics')) {
        return { ok: true, json: async () => mockStats } as any;
      }
      return { ok: true, json: async () => ({ calls: [], active_calls: [], notifications: [], unread_count: 0 }) } as any;
    });

    render(<MissionControl onExitDashboard={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Take the tour')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Toggle theme'));
    expect(localStorage.getItem('trivaana_theme')).toBe('dark');

    fireEvent.click(screen.getByText('Take the tour'));
    expect(screen.getByText(/Workspace Tour · Step 1 of 4/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Workspace Tour · Step 2 of 4/i)).toBeInTheDocument();
  });

  it('renders integrated ReactBits primitives cleanly across categories', () => {
    const onSwitch = vi.fn();
    const onTab = vi.fn();
    render(
      <div>
        <GradientText>Trivaana Grad</GradientText>
        <RotatingText texts={['Telugu', 'Hindi']} />
        <DecryptedText text="trv_live_123" />
        <StatusMark status="online" label="TRAI Active" />
        <LogoLoop items={[{ name: 'Exotel' }, { name: 'Sarvam' }]} />
        <VoicePill active={false} label="Hear audio" onClick={vi.fn()} />
        <SquishSwitch checked={true} onChange={onSwitch} label="Natural mode" />
        <Stepper steps={[{ label: 'One' }, { label: 'Two' }]} currentStep={0} />
        <PillNav
          layoutGroupId="testPill"
          activeId="a"
          onChange={onTab}
          items={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]}
        />
      </div>
    );

    expect(screen.getByText('Trivaana Grad')).toBeInTheDocument();
    expect(screen.getByText('TRAI Active')).toBeInTheDocument();
    expect(screen.getAllByText('Exotel').length).toBe(2);

    fireEvent.click(screen.getByRole('switch'));
    expect(onSwitch).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByText('Beta'));
    expect(onTab).toHaveBeenCalledWith('b');
  });

  it('renders ReactBitsShowcaseModal and filters categories interactively', () => {
    const onClose = vi.fn();
    render(<ReactBitsShowcaseModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText(/Trivaana × ReactBits UI Studio/i)).toBeInTheDocument();
    expect(screen.getByText('ElectricBorder Card')).toBeInTheDocument();
    expect(screen.getByText('WavesBackground')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Micro-Interactions' }));
    expect(screen.getByText('VoicePill Wave')).toBeInTheDocument();
    expect(screen.queryByText('WavesBackground')).not.toBeInTheDocument();
  });

  it('navigates all Outpero-parity public routes, calculators, quick pills, and HowItWorks languages', () => {
    const onEnter = vi.fn();
    render(<LandingPage onEnterDashboard={onEnter} onOpenSimulator={vi.fn()} />);

    // Hero quick prompt pill + trust line + 6-node radial diagram
    expect(screen.getByText(/Trusted by 5,000\+ businesses/i)).toBeInTheDocument();
    expect(screen.getByText(/India's best voices\. Now with hands\./i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Book test drives/i }));
    expect(screen.getByDisplayValue(/EV & SUV website inquiries/i)).toBeInTheDocument();

    // How it works 7-language switcher
    expect(screen.getByText(/How it works/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'தமிழ்' }));
    expect(screen.getAllByText(/Karthik Subramanian/i).length).toBeGreaterThan(0);

    // Navigate to /voices via header nav & filter voices
    fireEvent.click(screen.getByRole('link', { name: 'Voices' }));
    expect(screen.getByText(/We auditioned 600\+ voices/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /தமிழ் Tamil/i }));
    expect(screen.getByText('Kavya')).toBeInTheDocument();

    // Navigate to /pricing via header nav & toggle Premium voice rate + channel stepper
    fireEvent.click(screen.getByRole('link', { name: 'Pricing' }));
    expect(screen.getByText(/Pay for talk time\. Nothing else\./i)).toBeInTheDocument();
    expect(screen.getByText(/What would a month cost you\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Premium Neural/i }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText(/Business Number \+ 3 Channel\(s\)/i)).toBeInTheDocument();

    // Navigate to /product/instant-leads via Product dropdown
    fireEvent.click(screen.getByRole('button', { name: /Product/i }));
    fireEvent.click(screen.getByText(/13 lead connectors/i));
    expect(screen.getByText(/Every new lead gets a call in under 30 seconds\./i)).toBeInTheDocument();
    expect(screen.getByText('IndiaMART')).toBeInTheDocument();

    // Navigate to /product/campaigns & /product/inbound via Product dropdown
    fireEvent.click(screen.getByRole('button', { name: /Product/i }));
    fireEvent.click(screen.getByText(/Parallel CSV dialing/i));
    expect(screen.getByText(/Hand over the list\. Get back the interested ones\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Product/i }));
    fireEvent.click(screen.getByText(/AI reception, bookings/i));
    expect(screen.getByText(/Every call to your number, answered on the first ring\./i)).toBeInTheDocument();

    // Navigate to /contact via header nav & submit inquiry
    fireEvent.click(screen.getByRole('link', { name: 'Contact' }));
    expect(screen.getByText(/Let's talk about your calls\./i)).toBeInTheDocument();

    // Navigate to /docs via header nav
    fireEvent.click(screen.getByRole('link', { name: 'Docs' }));
    expect(screen.getByText(/Your AI phone employee, explained end to end\./i)).toBeInTheDocument();
  });

  it('filters and switches articles in DocsPortalPage and syncs hash in MissionControl', async () => {
    const onBack = vi.fn();
    render(
      <DocsPortalPage
        onBackToSite={onBack}
        onEnterDashboard={vi.fn()}
        onNavigateContact={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search documentation & API guides\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'DND' } });
    fireEvent.click(screen.getByRole('button', { name: /TRAI TCCCPR Calling Window & DND Scrubbing/i }));
    expect(screen.getAllByText(/TRAI TCCCPR Calling Window & DND Scrubbing/i).length).toBeGreaterThan(0);

    // Verify MissionControl hash route sync (#/billing)
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ ...mockTenant, calls: [], active_calls: [], notifications: [], unread_count: 0 }),
    }));
    render(<MissionControl onExitDashboard={vi.fn()} initialTab="billing" />);
    await waitFor(() => {
      expect(window.location.hash).toBe('#/billing');
    });
  });

  it('resolves deep Outpero-parity hash sub-routes (#/settings/memory, #/billing/details)', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        ...mockTenant,
        calls: [],
        active_calls: [],
        notifications: [],
        unread_count: 0,
        memories: [],
        transactions: [],
        invoices: [],
      }),
    }));

    window.location.hash = '#/settings/memory';
    const { unmount } = render(<MissionControl onExitDashboard={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Remembered Callers/i).length).toBeGreaterThan(0);
    });
    unmount();

    window.location.hash = '#/billing/details';
    render(<MissionControl onExitDashboard={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Legal \/ Workspace Entity Name/i)).toBeInTheDocument();
    });
  });
});
