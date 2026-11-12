import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPanel } from '../components/dashboard/SettingsPanel';
import { StaffPortal } from '../apps/staff/StaffPortal';
import { AdminPortal } from '../apps/admin/AdminPortal';
import { PublicLegalPage } from '../components/landing/LegalPages';

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('Sprint E DLT, NCPR, Staff Ops & Preflight (RED -> GREEN)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.setItem('trivaana_jwt_token', 'test_tok');
  });

  it('renders DLT registration and NCPR scrubbing controls in SettingsPanel dnc tab', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/compliance/policy')) {
        return { ok: true, json: async () => ({ policy: { calling_window_start: '10:00', calling_window_end: '18:00', enforce_dnd_scrubbing: 1, allow_promotional_calls: 1, require_dlt_for_promotional: 1 } }) } as any;
      }
      if (url.includes('/api/compliance/dnc')) {
        return { ok: true, json: async () => ({ entries: [] }) } as any;
      }
      if (url.includes('/api/compliance/dlt')) {
        return { ok: true, json: async () => ({ registrations: [{ id: 'dlt_1', entity_name: 'Acme Pvt Ltd', pe_id: '1101999', header_id: 'ACMERL', status: 'approved', call_category: 'promotional' }] }) } as any;
      }
      if (url.includes('/api/compliance/ncpr/scrub')) {
        return { ok: true, json: async () => ({ id: 'ncpr_99', total_checked: 2, blocked_count: 1, eligible_count: 1, provider_mode: 'local_registry' }) } as any;
      }
      if (url.includes('/api/compliance/ncpr/jobs')) {
        return { ok: true, json: async () => ({ jobs: [{ id: 'ncpr_1', total_checked: 10, blocked_count: 2, eligible_count: 8, provider_mode: 'local_registry', created_at: '2026-11-12T00:00:00Z' }] }) } as any;
      }
      if (url.includes('/api/tenant/members')) {
        return { ok: true, json: async () => ({ members: [] }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    renderWithQuery(<SettingsPanel initialTab="dnc" />);
    expect(await screen.findByText(/TRAI DLT PE\/TM & Template Registry/i)).toBeInTheDocument();
    expect(await screen.findByText(/ACMERL/i)).toBeInTheDocument();
    expect(await screen.findByText(/NCPR \/ DND Scrubbing/i)).toBeInTheDocument();
    const scrubBtn = await screen.findByRole('button', { name: /Run NCPR Scrub/i });
    fireEvent.click(scrubBtn);
    expect(await screen.findByText(/Eligible: 1 \/ 2/i)).toBeInTheDocument();
  });

  it('renders Staff DLT queue and Audited Tenant Summary inspector in StaffPortal', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/staff/tickets')) {
        return { ok: true, json: async () => ({ tickets: [{ id: 'tkt_1', tenant_id: 'tenant_1', tenant_name: 'Acme', subject: 'Caller ID issue', description: 'Check DLT', status: 'open', assigned_staff_id: 'ops_1' }] }) } as any;
      }
      if (url.includes('/api/staff/kyc-queue')) {
        return { ok: true, json: async () => ({ kyc_items: [] }) } as any;
      }
      if (url.includes('/api/staff/dlt-queue')) {
        return { ok: true, json: async () => ({ dlt_items: [{ id: 'dlt_q1', tenant_id: 'tenant_1', tenant_name: 'Acme', entity_name: 'Acme Realty', pe_id: '1101888', header_id: 'ACMERL', status: 'pending_review' }] }) } as any;
      }
      if (url.includes('/api/staff/tenants/tenant_1/summary')) {
        return { ok: true, json: async () => ({ tenant: { id: 'tenant_1', name: 'Acme', plan: 'growth', status: 'active', wallet_balance_paise: 500000, concurrency_limit: 15 }, agent_count: 3, call_stats: { calls: 42, spend_paise: 12000 } }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    renderWithQuery(<StaffPortal hasStaffAccess={true} onExitToCustomer={vi.fn()} />);
    expect(await screen.findByText(/DLT Entity & Template Review Queue/i)).toBeInTheDocument();
    expect(await screen.findByText(/ACMERL/i)).toBeInTheDocument();
    const inspectBtn = await screen.findByRole('button', { name: /Inspect Tenant/i });
    fireEvent.click(inspectBtn);
    expect(await screen.findByText(/Audited Read-Only Tenant Summary/i)).toBeInTheDocument();
    expect(await screen.findByText(/Agents: 3/i)).toBeInTheDocument();
  });

  it('renders Production Deployment Preflight card in AdminPortal', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/preflight')) {
        return {
          ok: true,
          json: async () => ({
            ready_for_production: false,
            security_baseline_ok: false,
            summary: { pass: 2, warn: 7, fail: 1 },
            checks: [
              { key: 'jwt_secret', label: 'JWT Signing Secret', status: 'fail', detail: 'Default development JWT secret in use.' },
              { key: 'database_url', label: 'PostgreSQL + pgvector', status: 'warn', detail: 'Using local SQLite WAL.' },
            ],
          }),
        } as any;
      }
      return { ok: true, json: async () => ({ workspaces: [], users: [], flags: [], failed_calls: [], errors: [], logs: [], tariffs: {} }) } as any;
    });

    renderWithQuery(<AdminPortal isSuperAdmin={true} onExitToCustomer={vi.fn()} />);
    expect(await screen.findByText(/Production Deployment Preflight/i)).toBeInTheDocument();
    expect(await screen.findByText(/JWT Signing Secret/i)).toBeInTheDocument();
  });

  it('renders Indian legal pages (Terms, DPDP Privacy, TRAI DND Policy) with Grievance Officer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        company_legal_name: 'Trivaana AI',
        entity_status: 'pre_incorporation_beta',
        gstin: null,
        jurisdiction: 'Hyderabad, Telangana, India',
        grievance_officer_name: 'Grievance Officer, Trivaana AI',
        grievance_officer_email: 'grievance@trivaana.ai',
      }),
    } as any);

    const onNav = vi.fn();
    const { rerender } = render(
      <PublicLegalPage docType="privacy" onNavigateLegal={onNav} onBackHome={vi.fn()} onNavigateContact={vi.fn()} />
    );
    expect(await screen.findByText(/Privacy & DPDP Compliance Policy/i)).toBeInTheDocument();
    expect(await screen.findByText(/grievance@trivaana\.ai/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending GST Registration/i)).toBeInTheDocument();

    rerender(
      <PublicLegalPage docType="dnd-policy" onNavigateLegal={onNav} onBackHome={vi.fn()} onNavigateContact={vi.fn()} />
    );
    expect(await screen.findByText(/TRAI DND, NCPR & DLT Policy/i)).toBeInTheDocument();
  });
});

