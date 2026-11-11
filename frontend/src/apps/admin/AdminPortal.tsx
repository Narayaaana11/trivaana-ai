import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Power, ArrowLeft, Activity, Wallet } from 'lucide-react';
import { SuperAdminPanel } from '@/components/dashboard/SuperAdminPanel';
import { platformService } from '@/services/platformService';

interface AdminPortalProps {
  isSuperAdmin: boolean;
  onExitToCustomer: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ isSuperAdmin, onExitToCustomer }) => {
  const qc = useQueryClient();
  const [killReason, setKillReason] = useState('Scheduled maintenance');
  const [killBanner, setKillBanner] = useState<string | null>(null);

  const { data: finance } = useQuery({
    queryKey: ['admin-finance-summary'],
    queryFn: () => platformService.adminFinanceSummary(),
    enabled: isSuperAdmin,
  });

  const { data: health } = useQuery({
    queryKey: ['admin-providers-health'],
    queryFn: () => platformService.adminProvidersHealth(),
    enabled: isSuperAdmin,
  });

  const killMut = useMutation({
    mutationFn: (paused: boolean) => platformService.adminEmergencyKillSwitch(paused, killReason),
    onSuccess: (res: any) => {
      setKillBanner(`Global outbound kill switch set to: ${res.outbound_paused ? 'PAUSED' : 'ACTIVE'}`);
      qc.invalidateQueries({ queryKey: ['admin-providers-health'] });
    },
  });

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
          <h1 className="font-display text-xl font-extrabold text-slate-900">Super Admin Access Required</h1>
          <p className="text-xs text-slate-600">
            This portal is restricted to authorized platform owners and super administrators.
          </p>
          <button
            type="button"
            onClick={onExitToCustomer}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Customer Workspace
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Platform Control Plane</span>
            <h1 className="font-display text-2xl font-extrabold text-slate-900">Super Admin Console</h1>
          </div>
          <button
            type="button"
            onClick={onExitToCustomer}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Customer App
          </button>
        </div>

        {/* Finance Liabilities vs Revenue vs COGS + Emergency Kill Switch */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Wallet className="w-4 h-4 text-orange-600" /> Financial Liabilities &amp; Margin
            </div>
            <div className="flex justify-between"><span>Wallet Liabilities:</span><strong>₹{((finance?.wallet_liabilities_paise || 0) / 100).toFixed(2)}</strong></div>
            <div className="flex justify-between"><span>Earned Usage Revenue:</span><strong>₹{((finance?.earned_usage_revenue_paise || 0) / 100).toFixed(2)}</strong></div>
            <div className="flex justify-between"><span>Promo Credits:</span><strong>₹{((finance?.promotional_credits_paise || 0) / 100).toFixed(2)}</strong></div>
            <div className="flex justify-between"><span>Provider COGS:</span><strong>₹{((finance?.provider_cogs_paise || 0) / 100).toFixed(2)}</strong></div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Activity className="w-4 h-4 text-emerald-600" /> Provider &amp; Infra Health
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <span>Gemini: {health?.ai_llm?.gemini ? 'Ready' : 'Unconfigured'}</span>
              <span>OpenAI: {health?.ai_llm?.openai ? 'Ready' : 'Unconfigured'}</span>
              <span>Sarvam: {health?.voice?.sarvam ? 'Ready' : 'Unconfigured'}</span>
              <span>LiveKit: {health?.voice?.livekit ? 'Ready' : 'Unconfigured'}</span>
              <span>Exotel: {health?.telephony?.exotel ? 'Ready' : 'Unconfigured'}</span>
              <span>Razorpay: {health?.payments?.razorpay ? 'Ready' : 'Sandbox'}</span>
              <span>Postgres: {health?.infra?.postgres ? 'Connected' : 'SQLite Dev'}</span>
              <span>Temporal: {health?.infra?.temporal ? 'Connected' : 'Local Outbox'}</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-700">
              <Power className="w-4 h-4" /> Emergency Outbound Kill Switch
            </div>
            <input
              value={killReason}
              onChange={(e) => setKillReason(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200"
              placeholder="Audit reason..."
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => killMut.mutate(true)}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold cursor-pointer"
              >
                Pause All Outbound
              </button>
              <button
                type="button"
                onClick={() => killMut.mutate(false)}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
              >
                Resume Outbound
              </button>
            </div>
            {killBanner && <p className="text-[11px] font-semibold text-slate-700">{killBanner}</p>}
          </div>
        </div>

        <SuperAdminPanel />
      </div>
    </div>
  );
};

