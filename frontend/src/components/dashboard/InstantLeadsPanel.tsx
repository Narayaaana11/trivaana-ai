import React, { useState, useEffect, useCallback } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Agent, CallLog } from '@/types/trivaana';
import BRAND from '@/lib/brand';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedList, RadarBackground, SplitFlapText } from '@/components/reactbits';
import { Zap, Activity, BarChart3, ListOrdered, Plug, CheckCircle2, AlertCircle } from 'lucide-react';

interface InstantLeadsPanelProps {
  onCallUpdated?: () => void;
  onNavigateIntegrations?: () => void;
  initialSubTab?: 'activity' | 'analytics' | 'queue' | 'sources';
}

export const InstantLeadsPanel: React.FC<InstantLeadsPanelProps> = ({
  onCallUpdated,
  onNavigateIntegrations,
  initialSubTab = 'activity',
}) => {
  const [subTab, setSubTab] = useState<'activity' | 'analytics' | 'queue' | 'sources'>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [agentId, setAgentId] = useState('');
  const [language, setLanguage] = useState('te-IN');
  const [isSandbox, setIsSandbox] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [aRes, cRes, iRes] = await Promise.all([
        trivaanaApi.getAgents(),
        trivaanaApi.getCalls({ direction: 'outbound' }),
        trivaanaApi.getIntegrations().catch(() => ({ integrations: [] })),
      ]);
      setAgents(aRes.agents || []);
      if (aRes.agents?.length) setAgentId((prev) => prev || aRes.agents[0].id);
      setCalls((cRes.calls || []).filter((c) => !c.campaign_id));
      setIntegrations((iRes.integrations || []).filter((i: any) => ['crm', 'automation', 'calendar'].includes(i.category)));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(id);
  }, [loadData]);

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await trivaanaApi.triggerInstantCall({
        name: leadName,
        phone: leadPhone,
        agent_id: agentId || undefined,
        language,
        is_sandbox: isSandbox,
      });
      setLeadName('');
      setLeadPhone('');
      setFeedback({ type: 'success', message: `${res.message} (Call ID: ${res.call_id})` });
      loadData();
      if (onCallUpdated) onCallUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const queuedCalls = calls.filter((c) => ['initiated', 'ringing', 'connected'].includes(c.status));
  const completedCount = calls.filter((c) => c.status === 'completed').length;

  return (
    <div className="space-y-6">
      <RadarBackground className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
              <Zap className="w-3.5 h-3.5 text-orange-600" />
              <span>Sub-30-Second Instant Lead Calling</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Instant Leads</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Automatically dial new website, Meta Lead Ad, or CRM enquiries after duplicate, consent, and DNC verification.
            </p>
          </div>
          {onNavigateIntegrations && (
            <button onClick={onNavigateIntegrations} className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold cursor-pointer shrink-0">
              Connect a source
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
          {[
            { id: 'activity', label: 'Activity', icon: Activity },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'queue', label: `Queue (${queuedCalls.length})`, icon: ListOrdered },
            { id: 'sources', label: 'Sources', icon: Plug },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  subTab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </RadarBackground>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {subTab === 'activity' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
            <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9]">
              <div className="text-[#6e6e7e]">Total Instant Calls</div>
              <div className="font-display text-2xl font-extrabold text-[#0f0f14] tabular-nums mt-1">{calls.length}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9]">
              <div className="text-[#6e6e7e]">Connected &amp; Qualified</div>
              <div className="font-display text-2xl font-extrabold text-emerald-600 tabular-nums mt-1">{completedCount}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9]">
              <div className="text-[#6e6e7e] mb-1.5">SLA Response Speed</div>
              <SplitFlapText text="< 15S" />
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9]">
              <div className="text-[#6e6e7e]">Active Queue</div>
              <div className="font-display text-2xl font-extrabold text-[#0f0f14] tabular-nums mt-1">{queuedCalls.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <form onSubmit={handleTrigger} className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#e4e4e9] space-y-3 text-xs">
              <h2 className="font-display text-sm font-bold text-[#0f0f14]">Trigger Instant Lead Call</h2>
              <input required placeholder="Lead Name" value={leadName} onChange={(e) => setLeadName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#e4e4e9]" />
              <input required placeholder="+919848022338" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#e4e4e9]" />
              <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#e4e4e9]">
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#e4e4e9]">
                {BRAND.languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
                <input type="checkbox" checked={isSandbox} onChange={(e) => setIsSandbox(e.target.checked)} />
                <span className="font-semibold text-amber-900">Sandbox Mode (₹0.00 simulation)</span>
              </label>
              <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ea580c] text-white font-bold cursor-pointer">
                {busy ? 'Dispatching...' : 'Call Lead Now'}
              </button>
            </form>

            <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-[#e4e4e9] space-y-3 text-xs">
              <div className="font-display font-bold text-sm text-[#0f0f14]">Recent Instant Calls ({calls.length})</div>
              {calls.length === 0 ? (
                <EmptyState
                  compact
                  icon={Zap}
                  title="No Instant Lead Calls Dispatched Yet"
                  description="Trigger a test callback on the left or connect Meta Lead Ads / your website webhook to call every new lead under 30 seconds."
                />
              ) : (
                <AnimatedList className="space-y-2.5">
                  {calls.slice(0, 12).map((c) => (
                    <div key={c.id} className="p-3.5 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9] flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-[#0f0f14] truncate">{c.contact_name} ({c.phone})</div>
                        <div className="text-[11px] text-[#6e6e7e]">{c.language} • {c.status} • {c.outcome}</div>
                      </div>
                      {c.is_sandbox && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold shrink-0">Sandbox</span>}
                    </div>
                  ))}
                </AnimatedList>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'analytics' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-5 rounded-3xl bg-white border border-slate-200"><div className="text-slate-500">Total Instant Calls</div><div className="text-2xl font-black mt-1">{calls.length}</div></div>
          <div className="p-5 rounded-3xl bg-white border border-slate-200"><div className="text-slate-500">Completed Calls</div><div className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</div></div>
          <div className="p-5 rounded-3xl bg-white border border-slate-200"><div className="text-slate-500">Active Queue</div><div className="text-2xl font-black text-orange-600 mt-1">{queuedCalls.length}</div></div>
        </div>
      )}

      {subTab === 'queue' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 text-xs space-y-2">
          <div className="font-bold text-sm text-slate-900">Active Queue ({queuedCalls.length})</div>
          {queuedCalls.length === 0 ? (
            <div className="py-8 text-center text-slate-400">No instant lead calls currently queued or ringing.</div>
          ) : (
            queuedCalls.map((c) => (
              <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="font-bold">{c.contact_name} ({c.phone})</span>
                <span className="font-mono uppercase text-orange-700">{c.status}</span>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'sources' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {integrations.map((item) => (
            <div key={item.provider_key} className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900">{item.display_name}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] uppercase font-bold">{item.status}</span>
              </div>
              <p className="text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

