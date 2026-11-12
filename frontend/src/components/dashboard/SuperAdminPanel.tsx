import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { AuroraBackground, FuzzyText, HoloCard } from '@/components/reactbits';
import { ShieldAlert, CheckCircle2, AlertCircle, PhoneOff, Bug, ClipboardList, Layers, Users } from 'lucide-react';

export const SuperAdminPanel: React.FC = () => {
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'failed_calls' | 'errors' | 'audit_logs'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [platformUsers, setPlatformUsers] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any>(null);
  const [failedCalls, setFailedCalls] = useState<any[]>([]);
  const [systemErrors, setSystemErrors] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAdmin = async () => {
    try {
      const [ov, ws, fl, fc, se, al, pu] = await Promise.all([
        trivaanaApi.getAdminOverview(),
        trivaanaApi.getAdminWorkspaces(),
        trivaanaApi.getAdminFeatureFlags(),
        trivaanaApi.getAdminFailedCalls().catch(() => ({ failed_calls: [] })),
        trivaanaApi.getAdminSystemErrors().catch(() => ({ errors: [] })),
        trivaanaApi.getAdminAuditLogs().catch(() => ({ audit_logs: [] })),
        trivaanaApi.getAdminUsers().catch(() => ({ users: [] })),
      ]);
      setOverview(ov);
      setWorkspaces(ws.workspaces || []);
      setPlatformUsers(pu.users || []);
      setFlags(fl.feature_flags || []);
      setFailedCalls(fc.failed_calls || []);
      setSystemErrors(se.errors || []);
      setAuditLogs(al.audit_logs || []);
      if (ov?.pricing_catalog?.tariffs) {
        setTariffs({
          standard_ai_call_paise_per_min: ov.pricing_catalog.tariffs.standard_ai_call_paise_per_min,
          premium_ai_call_paise_per_min: ov.pricing_catalog.tariffs.premium_ai_call_paise_per_min,
          broadcast_paise_per_call: ov.pricing_catalog.tariffs.broadcast_paise_per_call || 120,
          number_rental_paise_per_month: ov.pricing_catalog.tariffs.number_rental_paise_per_month,
          channel_rental_paise_per_month: ov.pricing_catalog.tariffs.channel_rental_paise_per_month,
          rounding_increment_seconds: ov.pricing_catalog.billing_rules.rounding_increment_seconds,
          gst_percentage: ov.pricing_catalog.billing_rules.gst_percentage,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      void loadAdmin();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="space-y-6">
      <AuroraBackground className="p-6 rounded-3xl bg-outpero-dark-card text-white border border-white/10 shadow-md">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-950 text-orange-400 text-xs font-semibold w-fit mb-2 border border-orange-800">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Platform Super Admin Console</span>
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Global Workspaces, Tariffs &amp; Feature Flags</h1>
        <p className="text-xs text-slate-300 mt-1">
          Privacy-preserving platform operations: manage tenant status, configurable commercial rates, and system feature flags.
        </p>
      </AuroraBackground>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-white border border-slate-200"><div className="text-slate-500">Total Workspaces</div><div className="text-2xl font-black mt-1 tabular-nums">{overview.workspaces?.total}</div></div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200"><div className="text-slate-500">Total Users</div><div className="text-2xl font-black mt-1 tabular-nums">{overview.total_users}</div></div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200"><div className="text-slate-500">Platform Calls</div><div className="text-2xl font-black mt-1 tabular-nums">{overview.calls?.total_calls}</div></div>
          <HoloCard className="!p-4">
            <div className="text-slate-300">Unresolved Errors</div>
            <div className="text-2xl font-black text-red-400 mt-1 tabular-nums">
              <FuzzyText>{overview.unresolved_errors}</FuzzyText>
            </div>
          </HoloCard>
        </div>
      )}

      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 w-fit text-xs">
        {(
          [
            { id: 'overview', label: 'Workspaces & Controls', icon: Layers },
            { id: 'users', label: `Platform Users (${platformUsers.length})`, icon: Users },
            { id: 'failed_calls', label: `Failed Calls (${failedCalls.length})`, icon: PhoneOff },
            { id: 'errors', label: `System Errors (${systemErrors.length})`, icon: Bug },
            { id: 'audit_logs', label: `Audit Logs (${auditLogs.length})`, icon: ClipboardList },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAdminTab(id)}
            className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer ${
              adminTab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {adminTab === 'overview' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Workspaces ({workspaces.length})</h2>
          {workspaces.map((w) => (
            <div key={w.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">{w.name}</div>
                <div className="text-[11px] text-slate-500">
                  {w.plan} • ₹{(w.wallet_balance_paise / 100).toFixed(2)} • {w.user_count} users • {w.call_count} calls
                </div>
              </div>
              <button
                onClick={async () => {
                  const suspend = w.status !== 'suspended';
                  await trivaanaApi.toggleWorkspaceSuspension(w.id, suspend);
                  setFeedback({ type: 'success', message: `Workspace ${suspend ? 'suspended' : 'activated'}.` });
                  loadAdmin();
                }}
                className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
                  w.status === 'suspended' ? 'bg-emerald-600 text-white' : 'bg-red-100 text-red-700'
                }`}
              >
                {w.status === 'suspended' ? 'Activate' : 'Suspend'}
              </button>
            </div>
          ))}
        </div>

        <div className="lg:col-span-5 space-y-6">
          {tariffs && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Commercial Tariffs (Integer Paise)</h2>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Standard Call (paise/min)</label>
                  <input type="number" value={tariffs.standard_ai_call_paise_per_min} onChange={(e) => setTariffs({ ...tariffs, standard_ai_call_paise_per_min: Number(e.target.value) })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Premium Call (paise/min)</label>
                  <input type="number" value={tariffs.premium_ai_call_paise_per_min} onChange={(e) => setTariffs({ ...tariffs, premium_ai_call_paise_per_min: Number(e.target.value) })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Number Rent (paise/mo)</label>
                  <input type="number" value={tariffs.number_rental_paise_per_month} onChange={(e) => setTariffs({ ...tariffs, number_rental_paise_per_month: Number(e.target.value) })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Broadcast (paise/call)</label>
                  <input type="number" value={tariffs.broadcast_paise_per_call ?? 0} onChange={(e) => setTariffs({ ...tariffs, broadcast_paise_per_call: Number(e.target.value) })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Channel Rent (paise/mo)</label>
                  <input type="number" value={tariffs.channel_rental_paise_per_month ?? 0} onChange={(e) => setTariffs({ ...tariffs, channel_rental_paise_per_month: Number(e.target.value) })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">GST (%)</label>
                  <input type="number" value={tariffs.gst_percentage ?? 18} onChange={(e) => setTariffs({ ...tariffs, gst_percentage: Number(e.target.value) })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Rounding (sec)</label>
                  <input type="number" value={tariffs.rounding_increment_seconds} onChange={(e) => setTariffs({ ...tariffs, rounding_increment_seconds: Number(e.target.value) })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
              </div>
              <button
                onClick={async () => {
                  await trivaanaApi.updateAdminTariffs(tariffs);
                  setFeedback({ type: 'success', message: 'Platform tariffs updated.' });
                }}
                className="w-full py-2 rounded-xl bg-orange-600 text-white font-bold cursor-pointer"
              >
                Save Tariffs
              </button>
            </div>
          )}

          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-2.5">
            <h2 className="text-sm font-bold text-slate-900">Feature Flags</h2>
            {flags.map((f) => (
              <label key={f.key} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <div className="font-mono font-bold text-slate-900">{f.key}</div>
                  <div className="text-[11px] text-slate-500">{f.description}</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(f.enabled)}
                  onChange={async (e) => {
                    await trivaanaApi.toggleFeatureFlag(f.key, e.target.checked);
                    loadAdmin();
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
      )}

      {adminTab === 'users' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900">Platform Users Directory ({platformUsers.length})</h2>
          {platformUsers.length === 0 ? (
            <div className="py-10 text-center text-slate-400">No platform users found.</div>
          ) : (
            <div className="space-y-2">
              {platformUsers.map((u) => (
                <div key={u.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{u.full_name || u.email}</div>
                    <div className="text-[11px] text-slate-500">
                      {u.email} • {u.tenant_name || u.tenant_id} • Role: {u.role}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold uppercase">
                    {u.status || 'active'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adminTab === 'failed_calls' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900">Failed / Disconnected Calls Monitor</h2>
          {failedCalls.length === 0 ? (
            <div className="py-10 text-center text-slate-400">No failed calls recorded across platform tenants.</div>
          ) : (
            <div className="space-y-2">
              {failedCalls.map((c) => (
                <div key={c.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{c.id} • {c.tenant_id || 'tenant'} • {c.provider || 'mock'} • {c.language || 'te-IN'}</div>
                    <div className="text-[11px] text-slate-500">Status: {c.status} • Outcome: {c.outcome}</div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">{c.created_at}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adminTab === 'errors' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900">System Errors & Exception Telemetry</h2>
          {systemErrors.length === 0 ? (
            <div className="py-10 text-center text-slate-400">No system errors logged.</div>
          ) : (
            <div className="space-y-2">
              {systemErrors.map((err) => (
                <div key={err.id} className="p-3 rounded-2xl bg-red-50/70 border border-red-200">
                  <div className="font-bold text-red-900">{err.module || err.component || 'backend'} • {err.severity || 'error'}</div>
                  <div className="text-[11px] text-red-700 font-mono mt-0.5">{err.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adminTab === 'audit_logs' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900">Platform-Wide Security Audit Logs</h2>
          {auditLogs.length === 0 ? (
            <div className="py-10 text-center text-slate-400">No audit logs found.</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{log.action}</div>
                    <div className="text-[11px] text-slate-500">{log.resource_type} • {log.resource_id}</div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">{log.created_at}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

