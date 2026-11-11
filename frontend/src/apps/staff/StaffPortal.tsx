import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Headphones, ShieldAlert } from 'lucide-react';
import { platformService } from '@/services/platformService';

interface StaffPortalProps {
  hasStaffAccess: boolean;
  onExitToCustomer: () => void;
}

export const StaffPortal: React.FC<StaffPortalProps> = ({ hasStaffAccess, onExitToCustomer }) => {
  const qc = useQueryClient();
  const [resolutionMap, setResolutionMap] = useState<Record<string, string>>({});

  const { data: ticketsData } = useQuery({
    queryKey: ['staff-tickets'],
    queryFn: () => platformService.staffListTickets(),
    enabled: hasStaffAccess,
  });

  const { data: kycData } = useQuery({
    queryKey: ['staff-kyc-queue'],
    queryFn: () => platformService.staffListKycQueue(),
    enabled: hasStaffAccess,
  });

  const updateTicketMut = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      platformService.staffUpdateTicket(id, { status, resolution_notes: notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-tickets'] }),
  });

  const reviewKycMut = useMutation({
    mutationFn: ({ id, kyc_status }: { id: string; kyc_status: string }) =>
      platformService.staffReviewKyc(id, { kyc_status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-kyc-queue'] }),
  });

  if (!hasStaffAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="font-display text-xl font-extrabold text-slate-900">Internal Staff Access Required</h1>
          <p className="text-xs text-slate-600">
            This operations portal is restricted to Trivaana support, compliance, and operations staff.
          </p>
          <button
            type="button"
            onClick={onExitToCustomer}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white rounded-3xl p-5 border border-slate-200">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Internal Operations</span>
            <h1 className="font-display text-2xl font-extrabold text-slate-900">Staff Operations &amp; Support Portal</h1>
          </div>
          <button
            type="button"
            onClick={onExitToCustomer}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Customer App
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Headphones className="w-4 h-4 text-orange-600" /> Global Support Ticket Queue
            </div>
            {(ticketsData?.tickets || []).length === 0 ? (
              <div className="py-8 text-center text-slate-400">No active customer tickets.</div>
            ) : (
              (ticketsData?.tickets || []).map((t: any) => (
                <div key={t.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{t.subject} — {t.tenant_name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-bold text-[10px]">{t.status}</span>
                  </div>
                  <p className="text-slate-600">{t.description}</p>
                  <div className="flex gap-2">
                    <input
                      value={resolutionMap[t.id] || ''}
                      onChange={(e) => setResolutionMap((m) => ({ ...m, [t.id]: e.target.value }))}
                      placeholder="Resolution note..."
                      className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => updateTicketMut.mutate({ id: t.id, status: 'resolved', notes: resolutionMap[t.id] })}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ClipboardCheck className="w-4 h-4 text-emerald-600" /> Telephony &amp; DLT KYC Review Queue
            </div>
            {(kycData?.kyc_items || []).length === 0 ? (
              <div className="py-8 text-center text-slate-400">No phone numbers in KYC queue.</div>
            ) : (
              (kycData?.kyc_items || []).map((item: any) => (
                <div key={item.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">{item.phone_number} ({item.provider})</div>
                    <div className="text-[11px] text-slate-500">{item.tenant_name} · KYC: {item.kyc_status}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => reviewKycMut.mutate({ id: item.id, kyc_status: 'verified' })}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewKycMut.mutate({ id: item.id, kyc_status: 'rejected' })}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

