import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminPortal } from '@/apps/admin/AdminPortal';
import { StaffPortal } from '@/apps/staff/StaffPortal';
import { SupportTicketsPanel } from '@/components/dashboard/SupportTicketsPanel';
import { AppointmentsPanel } from '@/components/dashboard/AppointmentsPanel';

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('Trivaana AI Portals & New Domain Modules', () => {
  it('blocks non-super-admins from AdminPortal', () => {
    renderWithQuery(<AdminPortal isSuperAdmin={false} onExitToCustomer={vi.fn()} />);
    expect(screen.getByText('Super Admin Access Required')).toBeInTheDocument();
  });

  it('blocks non-staff users from StaffPortal', () => {
    renderWithQuery(<StaffPortal hasStaffAccess={false} onExitToCustomer={vi.fn()} />);
    expect(screen.getByText('Internal Staff Access Required')).toBeInTheDocument();
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
});

