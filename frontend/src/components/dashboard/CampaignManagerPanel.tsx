import React, { useState, useEffect, useCallback } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Agent, CampaignItem, ContactListItem } from '@/types/trivaana';
import { EmptyState } from '@/components/ui/EmptyState';
import { ElectricBorder, SloshGauge } from '@/components/reactbits';
import BRAND from '@/lib/brand';
import {
  PhoneForwarded,
  Play,
  Pause,
  Zap,
  Plus,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  FastForward,
  ListChecks,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';

interface CampaignManagerPanelProps {
  onCampaignUpdated?: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CampaignManagerPanel: React.FC<CampaignManagerPanelProps> = ({
  onCampaignUpdated,
}) => {
  const [mode, setMode] = useState<'bulk' | 'instant'>('bulk');
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<any>(null);
  const [subTab, setSubTab] = useState<'overview' | 'contacts' | 'settings' | 'live' | 'results'>('overview');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create campaign form
  const [newName, setNewName] = useState('');
  const [newAgentId, setNewAgentId] = useState('');
  const [contactLists, setContactLists] = useState<ContactListItem[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [suppressionListId, setSuppressionListId] = useState('');
  const [callingDays, setCallingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [callingHours, setCallingHours] = useState('09:00-18:00');
  const [concurrency, setConcurrency] = useState<number>(5);
  const [maxCalls, setMaxCalls] = useState<number>(20);
  const [retryAttempts, setRetryAttempts] = useState<number>(2);
  const [retryDelay, setRetryDelay] = useState<number>(30);
  const [bypassTrai, setBypassTrai] = useState<boolean>(false);
  const [isSandbox, setIsSandbox] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);

  // Contact Lists modal state
  const [showListsModal, setShowListsModal] = useState(false);
  const [listName, setListName] = useState('');
  const [listType, setListType] = useState<'reusable' | 'suppression'>('reusable');
  const [listPhonesText, setListPhonesText] = useState('');

  // Instant Lead Calling state
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadVertical] = useState('Real Estate');
  const [leadLang, setLeadLang] = useState('te-IN');
  const [instantAgentId, setInstantAgentId] = useState('');
  const [instantSandbox, setInstantSandbox] = useState(true);
  const [instantResult, setInstantResult] = useState<any>(null);

  const loadData = useCallback(async (keepId?: string) => {
    try {
      const [cRes, aRes, lRes] = await Promise.all([
        trivaanaApi.getCampaigns(),
        trivaanaApi.getAgents(),
        trivaanaApi.getContactLists().catch(() => ({ lists: [] })),
      ]);
      setCampaigns(cRes.campaigns || []);
      setAgents(aRes.agents || []);
      setContactLists(lRes.lists || []);
      if (aRes.agents?.length) {
        setNewAgentId((prev) => prev || aRes.agents[0].id);
        setInstantAgentId((prev) => prev || aRes.agents[0].id);
      }
      if (cRes.campaigns?.length) {
        const target = (keepId && cRes.campaigns.find((c) => c.id === keepId)) || cRes.campaigns[0];
        setSelectedCampaign(target);
        const det = await trivaanaApi.getCampaignDetail(target.id).catch(() => null);
        setCampaignDetail(det);
      }
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

  const handleSelectCampaign = async (c: CampaignItem) => {
    setSelectedCampaign(c);
    const det = await trivaanaApi.getCampaignDetail(c.id).catch(() => null);
    setCampaignDetail(det);
  };

  const handleCreateAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const created = await trivaanaApi.createCampaign({
        name: newName || `Campaign ${new Date().toLocaleDateString()}`,
        agent_id: newAgentId || undefined,
        list_id: selectedListId || undefined,
        suppression_list_id: suppressionListId || undefined,
        calling_hours: callingHours,
        calling_days: callingDays,
        concurrency,
        retry_attempts: retryAttempts,
        retry_delay_minutes: retryDelay,
        is_sandbox: isSandbox,
      });
      const started = await trivaanaApi.startCampaign({
        campaign_id: created.campaign_id,
        concurrency,
        max_calls: maxCalls,
        bypass_trai: bypassTrai,
        is_sandbox: isSandbox,
      });
      setNewName('');
      setFeedback({ type: 'success', message: started.message });
      await loadData(created.campaign_id);
      if (onCampaignUpdated) onCampaignUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerInstant = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await trivaanaApi.triggerInstantCall({
        name: leadName,
        phone: leadPhone,
        vertical: leadVertical,
        language: leadLang,
        agent_id: instantAgentId || undefined,
        is_sandbox: instantSandbox,
      });
      setInstantResult(res);
      setFeedback({ type: 'success', message: res.message });
      if (onCampaignUpdated) onCampaignUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = async (campaignId: string) => {
    const token = localStorage.getItem('trivaana_token');
    const res = await fetch(`/api/campaigns/${campaignId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_${campaignId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header + Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
            <PhoneForwarded className="w-3.5 h-3.5 text-orange-600" />
            <span>Bulk Campaigns & Instant Lead Calling</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Outbound Calling Operations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Launch queued bulk calling campaigns with retries & TRAI guards, or dispatch instant lead callbacks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowListsModal(true)}
            className="px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <ListChecks className="w-3.5 h-3.5 text-orange-600" />
            <span>Contact Lists ({contactLists.length})</span>
          </button>
          <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setMode('bulk')}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                mode === 'bulk' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Bulk Campaigns
            </button>
            <button
              onClick={() => setMode('instant')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                mode === 'instant' ? 'bg-orange-600 text-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Instant Lead Call
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {mode === 'instant' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleTriggerInstant} className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900">Trigger Instant Lead Callback</h2>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Lead Name</label>
              <input required value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="e.g. Rahul Sharma" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number (E.164 or 10-digit Indian)</label>
              <input required value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="+919848022338" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">AI Employee</label>
                <select value={instantAgentId} onChange={(e) => setInstantAgentId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Language</label>
                <select value={leadLang} onChange={(e) => setLeadLang(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
                  {BRAND.languages.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
              <input type="checkbox" checked={instantSandbox} onChange={(e) => setInstantSandbox(e.target.checked)} />
              <span className="font-semibold text-amber-900">Run in Sandbox Mode (no real telecom call or debit)</span>
            </label>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">
              {busy ? 'Dispatching...' : 'Dispatch Instant AI Call'}
            </button>
          </form>

          <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs">
            <h2 className="text-base font-bold text-slate-900">Dispatch Receipt & Public Webhook API</h2>
            {instantResult ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-bold text-emerald-700">Call ID: {instantResult.call_id}</div>
                <div>Status: <span className="font-mono font-bold">{instantResult.status}</span></div>
                <div>Provider: <span className="font-mono">{instantResult.provider}</span> {instantResult.is_sandbox ? '(Simulated Sandbox)' : ''}</div>
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-50 rounded-2xl text-slate-500">
                Submit a lead on the left or integrate via <code className="font-mono">POST /api/public/lead-intake/&lt;agent_slug&gt;</code>.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Launch New Campaign + Campaign List */}
          <div className="lg:col-span-4 space-y-4">
            <ElectricBorder>
              <form onSubmit={handleCreateAndStart} className="p-5 space-y-3 text-xs">
              <div className="font-bold text-slate-900 flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5"><Plus className="w-4 h-4 text-orange-600" /> New Bulk Campaign</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">{callingDays.length}d/wk</span>
              </div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Campaign Name (e.g. Hyd Q4 Villas)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
              <select value={newAgentId} onChange={(e) => setNewAgentId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Contact List</label>
                  <select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200">
                    <option value="">All Workspace Leads</option>
                    {contactLists.filter((l) => l.list_type === 'reusable').map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.contact_count})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Suppression List</label>
                  <select value={suppressionListId} onChange={(e) => setSuppressionListId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200">
                    <option value="">None (DNC Only)</option>
                    {contactLists.filter((l) => l.list_type === 'suppression').map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.contact_count})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-500">Calling Days</label>
                  <span className="text-[10px] font-mono text-slate-400">{callingHours} IST</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((day) => {
                    const active = callingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setCallingDays((prev) =>
                            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                          )
                        }
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                          active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input
                value={callingHours}
                onChange={(e) => setCallingHours(e.target.value)}
                placeholder="Calling Window e.g. 09:00-18:00"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 font-mono text-[11px]"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Concurrency</label>
                  <input type="number" min={1} max={50} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Batch Cap</label>
                  <input type="number" min={1} max={500} value={maxCalls} onChange={(e) => setMaxCalls(Number(e.target.value))} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Retry Attempts</label>
                  <input type="number" min={0} max={5} value={retryAttempts} onChange={(e) => setRetryAttempts(Number(e.target.value))} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Retry Delay (m)</label>
                  <input type="number" min={1} max={1440} value={retryDelay} onChange={(e) => setRetryDelay(Number(e.target.value))} className="w-full px-3 py-1.5 rounded-xl border border-slate-200" />
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-0.5">
                <div className="font-bold text-slate-800">Launch Summary</div>
                <div>Agent: {agents.find((a) => a.id === newAgentId)?.name || 'Default'} • {concurrency} concurrent lines</div>
                <div>Window: {callingHours} IST on {callingDays.join(', ') || 'No days selected'}</div>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                <input type="checkbox" checked={bypassTrai} onChange={(e) => setBypassTrai(e.target.checked)} />
                <span>Service/Transactional Bypass (after 6 PM IST)</span>
              </label>
              <label className="flex items-center gap-2 text-[11px] text-amber-800 cursor-pointer">
                <input type="checkbox" checked={isSandbox} onChange={(e) => setIsSandbox(e.target.checked)} />
                <span>Sandbox Simulation Mode</span>
              </label>
              <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <Play className="w-3.5 h-3.5" /> {busy ? 'Launching...' : 'Create & Launch Campaign'}
              </button>
              </form>
            </ElectricBorder>

            <div className="bg-white rounded-3xl p-4 border border-slate-200/90 space-y-2">
              <div className="flex justify-between items-center px-1 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-600">Campaigns ({campaigns.length})</span>
                <button onClick={() => loadData()} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCampaign(c)}
                  className={`w-full text-left p-3 rounded-2xl border text-xs cursor-pointer ${
                    selectedCampaign?.id === c.id ? 'bg-orange-50 border-orange-400' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900 truncate">{c.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-bold uppercase">{c.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {c.placed}/{c.total_contacts} called • {c.connected} connected {c.is_sandbox ? '• Sandbox' : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Selected Campaign 5 Sub-Pages */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-5">
            {!selectedCampaign ? (
              <EmptyState
                icon={PhoneForwarded}
                title="No Campaign Selected Yet"
                description="Create a new bulk campaign on the left using any workspace Contact List or Suppression List, then track live dialing progress, retries, and CSV results here."
                actionLabel="Manage Contact Lists"
                onAction={() => setShowListsModal(true)}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <h2 className="text-lg font-black text-slate-900">{selectedCampaign.name}</h2>
                    <p className="text-xs text-slate-500">
                      Status: <strong className="uppercase">{selectedCampaign.status}</strong> • Remaining: {selectedCampaign.remaining_contacts}
                    </p>
                    <SloshGauge
                      percentage={Math.round(((selectedCampaign.placed || 0) / Math.max(selectedCampaign.total_contacts || 1, 1)) * 100)}
                      label={`Progress (${selectedCampaign.placed || 0}/${selectedCampaign.total_contacts || 0})`}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCampaign.status === 'running' ? (
                      <button
                        onClick={async () => {
                          await trivaanaApi.pauseCampaign(selectedCampaign.id);
                          loadData(selectedCampaign.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" /> Pause
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          await trivaanaApi.resumeCampaign(selectedCampaign.id);
                          loadData(selectedCampaign.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" /> Resume
                      </button>
                    )}
                    {selectedCampaign.is_sandbox && (
                      <button
                        onClick={async () => {
                          const r = await trivaanaApi.simulateCampaignProgress(selectedCampaign.id);
                          setFeedback({ type: 'success', message: `Simulated ${r.completed_now} campaign call completions.` });
                          loadData(selectedCampaign.id);
                          if (onCampaignUpdated) onCampaignUpdated();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <FastForward className="w-3.5 h-3.5" /> Simulate Next Batch
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const r = await trivaanaApi.processCampaignRetries(selectedCampaign.id);
                        setFeedback({ type: 'success', message: `Processed ${r.requeued_jobs} due retry job(s).` });
                        loadData(selectedCampaign.id);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Process Due Retries
                    </button>
                    <button
                      onClick={() => handleExportCsv(selectedCampaign.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                    <button
                      onClick={async () => {
                        const r = await trivaanaApi.killCampaign(selectedCampaign.id);
                        setFeedback({ type: 'success', message: r.message });
                        loadData(selectedCampaign.id);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> Kill Switch
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(['overview', 'contacts', 'settings', 'live', 'results'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSubTab(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize cursor-pointer ${
                        subTab === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t === 'live' ? 'Live Progress' : t}
                    </button>
                  ))}
                </div>

                {(subTab === 'overview' || subTab === 'live' || subTab === 'results') && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200"><div className="text-slate-500">Total Contacts</div><div className="text-lg font-black">{selectedCampaign.total_contacts}</div></div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200"><div className="text-slate-500">Placed</div><div className="text-lg font-black">{selectedCampaign.placed}</div></div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200"><div className="text-emerald-700">Connected</div><div className="text-lg font-black text-emerald-800">{selectedCampaign.connected}</div></div>
                    <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200"><div className="text-orange-700">Interested</div><div className="text-lg font-black text-orange-800">{selectedCampaign.interested_count}</div></div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200"><div className="text-slate-500">Callbacks</div><div className="text-lg font-black">{selectedCampaign.callback_count}</div></div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200"><div className="text-slate-500">Failed</div><div className="text-lg font-black">{selectedCampaign.failed}</div></div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200"><div className="text-slate-500">Remaining</div><div className="text-lg font-black">{selectedCampaign.remaining_contacts}</div></div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200"><div className="text-slate-500">Est. Remaining</div><div className="text-lg font-black">{Math.ceil(selectedCampaign.estimated_remaining_seconds / 60)}m</div></div>
                  </div>
                )}

                {subTab === 'settings' && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                    <div><strong>AI Employee:</strong> {selectedCampaign.agent_name || 'Default'}</div>
                    <div><strong>Concurrency:</strong> {selectedCampaign.concurrency} lines</div>
                    <div><strong>Retry Policy:</strong> Up to {selectedCampaign.retry_attempts} retries every {selectedCampaign.retry_delay_minutes} mins</div>
                    <div><strong>Mode:</strong> {selectedCampaign.is_sandbox ? 'Sandbox Simulation' : 'Live Carrier Dispatch'}</div>
                  </div>
                )}

                {subTab === 'contacts' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                          <th className="py-2 px-2">Contact</th>
                          <th className="py-2 px-2">Phone</th>
                          <th className="py-2 px-2">Job Status</th>
                          <th className="py-2 px-2">Outcome</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(campaignDetail?.contacts || []).map((ct: any) => (
                          <tr key={ct.id}>
                            <td className="py-2.5 px-2 font-bold text-slate-900">{ct.contact_name || ct.lead_name}</td>
                            <td className="py-2.5 px-2 font-mono">{ct.phone || ct.lead_phone}</td>
                            <td className="py-2.5 px-2"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold uppercase">{ct.status}</span></td>
                            <td className="py-2.5 px-2 text-slate-600">{ct.call_outcome || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showListsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 border border-slate-200 shadow-xl space-y-5 max-h-[88vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Contact & Suppression Lists</h2>
                <p className="text-slate-500">Create reusable audience lists or suppression/exclusion lists for campaigns.</p>
              </div>
              <button onClick={() => setShowListsModal(false)} className="p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!listName.trim()) return;
                const phones = listPhonesText
                  .split(/[\n,;]+/)
                  .map((p) => p.trim())
                  .filter(Boolean);
                await trivaanaApi.createContactList({
                  name: listName.trim(),
                  list_type: listType,
                  phones,
                });
                setListName('');
                setListPhonesText('');
                await loadData(selectedCampaign?.id);
                setFeedback({ type: 'success', message: 'Contact list created.' });
              }}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  required
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="List Name (e.g. Hyderabad VIPs)"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
                <select
                  value={listType}
                  onChange={(e) => setListType(e.target.value as 'reusable' | 'suppression')}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="reusable">Reusable Target List</option>
                  <option value="suppression">Suppression / Exclusion</option>
                </select>
              </div>
              <textarea
                rows={3}
                value={listPhonesText}
                onChange={(e) => setListPhonesText(e.target.value)}
                placeholder="Phone numbers separated by newline or comma (e.g. +919848022338, +919848022339)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-[11px]"
              />
              <button type="submit" className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">
                Save Contact List
              </button>
            </form>

            <div className="space-y-2">
              {contactLists.length === 0 ? (
                <div className="p-6 text-center text-slate-400">No contact lists yet.</div>
              ) : (
                contactLists.map((lst) => (
                  <div key={lst.id} className="p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{lst.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          lst.list_type === 'suppression' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {lst.list_type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{lst.contact_count} contact(s)</div>
                    </div>
                    <button
                      onClick={async () => {
                        await trivaanaApi.deleteContactList(lst.id);
                        await loadData(selectedCampaign?.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
