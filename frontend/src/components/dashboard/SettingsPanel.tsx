import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { PillNav } from '@/components/reactbits';
import {
  Settings,
  ShieldCheck,
  Users,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Plus,
  Brain,
  Trash2,
  Ban,
  FileLock2,
  UserCheck,
} from 'lucide-react';

type SettingsTab = 'general' | 'account' | 'callers' | 'dnc' | 'credentials' | 'privacy';

interface SettingsPanelProps {
  initialTab?: SettingsTab;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ initialTab = 'general' }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [workspace, setWorkspace] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [fullNameInput, setFullNameInput] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [dncList, setDncList] = useState<any[]>([]);
  const [callerMemories, setCallerMemories] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operator');
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [dncPhone, setDncPhone] = useState('');
  const [dltList, setDltList] = useState<any[]>([]);
  const [ncprJobs, setNcprJobs] = useState<any[]>([]);
  const [dltForm, setDltForm] = useState({ entity_name: '', pe_id: '', tm_id: '', header_id: '', template_id: '', template_name: '', call_category: 'promotional' });
  const [ncprPhonesInput, setNcprPhonesInput] = useState('');
  const [lastNcprResult, setLastNcprResult] = useState<any>(null);
  const [dispositions, setDispositions] = useState<Record<string, string>>({});
  const [alertPrefs, setAlertPrefs] = useState({
    liveCallBanner: true,
    failedWebhookAlerts: true,
    lowBalanceThresholdInr: 250,
  });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAll = async () => {
    try {
      const [w, me, m, k, p, d, mem, con, aud, disp, dltRes, ncprRes] = await Promise.all([
        trivaanaApi.getWorkspace(),
        trivaanaApi.getMe().catch(() => null),
        trivaanaApi.getWorkspaceMembers(),
        trivaanaApi.getApiKeys(),
        trivaanaApi.getCompliancePolicy(),
        trivaanaApi.getDncEntries(),
        trivaanaApi.getCallerMemories().catch(() => ({ memories: [] })),
        trivaanaApi.getConsents().catch(() => ({ consents: [] })),
        trivaanaApi.getAuditLogs().catch(() => ({ audit_logs: [] })),
        trivaanaApi.getDispositions().catch(() => ({ mapping: {} })),
        trivaanaApi.listDltRegistrations().catch(() => ({ registrations: [] })),
        trivaanaApi.listNcprJobs().catch(() => ({ jobs: [] })),
      ]);
      setWorkspace(w);
      if (me) {
        setUserProfile(me);
        setFullNameInput(me.full_name || '');
      }
      setMembers(m.members || []);
      setApiKeys(k.api_keys || []);
      setPolicy(p.policy);
      setDncList(d.entries || []);
      setCallerMemories(mem.memories || []);
      setConsents(con.consents || []);
      setAuditLogs(aud.audit_logs || []);
      setDispositions(disp.mapping || {});
      setDltList(dltRes.registrations || []);
      setNcprJobs(ncprRes.jobs || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'account', label: 'Account & Security', icon: UserCheck },
    { id: 'callers', label: `Remembered Callers (${callerMemories.length})`, icon: Brain },
    { id: 'dnc', label: `Do-Not-Call List (${dncList.length})`, icon: Ban },
    { id: 'credentials', label: 'Credentials Vault', icon: KeyRound },
    { id: 'privacy', label: 'Privacy & Data', icon: FileLock2 },
  ];

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
            <Settings className="w-3.5 h-3.5 text-orange-600" />
            <span>Workspace, Security, Caller Memory & TRAI Compliance</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Workspace Settings & Compliance</h1>
        </div>

        <div className="pt-2 border-t border-slate-100 overflow-x-auto">
          <PillNav
            layoutGroupId="settingsSubTabs"
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as SettingsTab)}
            items={TABS.map(({ id, label, icon }) => ({ id, label, icon }))}
          />
        </div>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {workspace && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Workspace Profile & GST Details</h2>
              <input value={workspace.name || ''} onChange={(e) => setWorkspace({ ...workspace, name: e.target.value })} placeholder="Workspace Name" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
              <input value={workspace.gstin || ''} onChange={(e) => setWorkspace({ ...workspace, gstin: e.target.value })} placeholder="GSTIN (optional)" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
              <input value={workspace.billing_email || ''} onChange={(e) => setWorkspace({ ...workspace, billing_email: e.target.value })} placeholder="Billing Email" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Low Balance Alert Threshold (INR)</label>
                <input
                  type="number"
                  min={0}
                  value={Math.round((workspace.low_balance_threshold_paise ?? 50000) / 100)}
                  onChange={(e) =>
                    setWorkspace({
                      ...workspace,
                      low_balance_threshold_paise: Math.max(0, Math.round(Number(e.target.value || 0) * 100)),
                    })
                  }
                  placeholder="Low balance alert threshold (INR)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <button
                onClick={async () => {
                  await trivaanaApi.updateWorkspace({
                    name: workspace.name,
                    gstin: workspace.gstin,
                    billing_email: workspace.billing_email,
                    low_balance_threshold_paise: workspace.low_balance_threshold_paise,
                  });
                  setFeedback({ type: 'success', message: 'Workspace settings saved.' });
                }}
                className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold cursor-pointer"
              >
                Save Workspace
              </button>
            </div>
          )}

          {policy && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> TRAI TCCCPR Compliance Policy & Alerts
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Calling Start (IST)</label>
                  <input value={policy.calling_window_start} onChange={(e) => setPolicy({ ...policy, calling_window_start: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Calling End (IST)</label>
                  <input value={policy.calling_window_end} onChange={(e) => setPolicy({ ...policy, calling_window_end: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(policy.enforce_dnd_scrubbing)} onChange={(e) => setPolicy({ ...policy, enforce_dnd_scrubbing: e.target.checked })} />
                <span>Enforce DND & Opt-Out Scrubbing</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(policy.allow_promotional_calls)} onChange={(e) => setPolicy({ ...policy, allow_promotional_calls: e.target.checked })} />
                <span>Allow Promotional Calling (requires 140-series registration)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(policy.require_dlt_for_promotional)} onChange={(e) => setPolicy({ ...policy, require_dlt_for_promotional: e.target.checked })} />
                <span>Require Approved DLT PE/Header for Promotional Calls</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={alertPrefs.liveCallBanner} onChange={(e) => setAlertPrefs({ ...alertPrefs, liveCallBanner: e.target.checked })} />
                <span>Show Live-Call Activity Popover Notifications</span>
              </label>
              <button
                onClick={async () => {
                  await trivaanaApi.updateCompliancePolicy({
                    calling_window_start: policy.calling_window_start,
                    calling_window_end: policy.calling_window_end,
                    enforce_dnd_scrubbing: Boolean(policy.enforce_dnd_scrubbing),
                    allow_promotional_calls: Boolean(policy.allow_promotional_calls),
                    require_dlt_for_promotional: Boolean(policy.require_dlt_for_promotional),
                  });
                  setFeedback({ type: 'success', message: 'Compliance & alert policy updated.' });
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
              >
                Save Compliance Policy
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Your Profile & Email Verification</h2>
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-500">Full Name</label>
              <div className="flex gap-2">
                <input value={fullNameInput} onChange={(e) => setFullNameInput(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-slate-200" />
                <button
                  onClick={async () => {
                    await trivaanaApi.updateProfile({ full_name: fullNameInput });
                    setFeedback({ type: 'success', message: 'User profile updated.' });
                    loadAll();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Email: {userProfile?.email || '—'}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${userProfile?.email_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                  {userProfile?.email_verified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    const res = await trivaanaApi.requestEmailVerification();
                    const tok = res?.dev_verification_token || res?.verification_token;
                    if (tok) setVerifyToken(tok);
                    setFeedback({ type: 'success', message: res?.message || 'Verification token generated.' });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-orange-600 text-white font-bold cursor-pointer"
                >
                  Request Verification Token
                </button>
                {verifyToken && (
                  <button
                    onClick={async () => {
                      await trivaanaApi.confirmEmailVerification(verifyToken);
                      setVerifyToken('');
                      setFeedback({ type: 'success', message: 'Email address verified!' });
                      loadAll();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                  >
                    Confirm Verification
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-orange-600" /> Team Members & RBAC ({members.length})
            </h2>
            <div className="flex gap-2">
              <input placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-slate-200" />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="px-2.5 py-2 rounded-xl border border-slate-200">
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={async () => {
                  if (!inviteEmail) return;
                  await trivaanaApi.inviteMember({ email: inviteEmail, role: inviteRole });
                  setInviteEmail('');
                  setFeedback({ type: 'success', message: 'Team invitation recorded.' });
                  loadAll();
                }}
                className="px-3 py-2 rounded-xl bg-orange-600 text-white font-bold cursor-pointer"
              >
                Invite
              </button>
            </div>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">{m.full_name || m.email}</div>
                    <div className="text-[11px] text-slate-500">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-bold uppercase">{m.role} • {m.status}</span>
                    {m.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await trivaanaApi.removeMember(m.id);
                          setFeedback({ type: 'success', message: `Removed member ${m.email}.` });
                          loadAll();
                        }}
                        className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'callers' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-orange-600" /> Remembered Caller Memory Profiles ({callerMemories.length})
          </h2>
          <p className="text-slate-500">Persistent context captured across repeat conversations so AI employees personalize callbacks.</p>
          {callerMemories.length === 0 ? (
            <div className="py-10 text-center text-slate-400">No caller memory records stored yet.</div>
          ) : (
            <div className="space-y-2">
              {callerMemories.map((mem) => (
                <div key={mem.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900 font-mono">
                      {mem.caller_name ? `${mem.caller_name} (${mem.phone})` : mem.phone}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{mem.summary || mem.preferences_json}</div>
                  </div>
                  <button
                    onClick={async () => {
                      await trivaanaApi.deleteCallerMemory(mem.id);
                      setFeedback({ type: 'success', message: 'Caller memory forgotten.' });
                      loadAll();
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'dnc' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-slate-900">Do-Not-Call (DNC) Suppression List ({dncList.length})</h2>
          <div className="flex gap-2 max-w-md">
            <input placeholder="+9198XXXXXXXX" value={dncPhone} onChange={(e) => setDncPhone(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-slate-200" />
            <button
              onClick={async () => {
                if (!dncPhone) return;
                await trivaanaApi.addDncEntry(dncPhone, 'Manual suppression');
                setDncPhone('');
                loadAll();
              }}
              className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold cursor-pointer"
            >
              Add DNC
            </button>
          </div>
          <div className="space-y-2">
            {dncList.map((entry, idx) => (
              <div key={entry.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="font-mono font-bold text-slate-900">{entry.phone || entry.phone_number}</span>
                <span className="text-slate-500">{entry.reason || 'Suppressed'}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">TRAI DLT PE/TM &amp; Template Registry ({dltList.length})</h3>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Entity Name" value={dltForm.entity_name} onChange={(e) => setDltForm({ ...dltForm, entity_name: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200" />
                <input placeholder="Principal Entity ID (PE ID)" value={dltForm.pe_id} onChange={(e) => setDltForm({ ...dltForm, pe_id: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200" />
                <input placeholder="Header ID (e.g. ACMERL)" value={dltForm.header_id} onChange={(e) => setDltForm({ ...dltForm, header_id: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200" />
                <input placeholder="Template ID (optional)" value={dltForm.template_id} onChange={(e) => setDltForm({ ...dltForm, template_id: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200" />
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!dltForm.entity_name || !dltForm.pe_id || !dltForm.header_id) return;
                  await trivaanaApi.registerDltEntity(dltForm);
                  setDltForm({ entity_name: '', pe_id: '', tm_id: '', header_id: '', template_id: '', template_name: '', call_category: 'promotional' });
                  setFeedback({ type: 'success', message: 'DLT registration submitted for staff verification.' });
                  loadAll();
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
              >
                Submit DLT Registration
              </button>
              <div className="space-y-1.5">
                {dltList.map((d: any) => (
                  <div key={d.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-900">{d.header_id}</span> · <span>{d.entity_name}</span>
                      <span className="text-slate-500 ml-1">(PE: {d.pe_id})</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-bold text-[10px] uppercase">{d.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">NCPR / DND Scrubbing ({ncprJobs.length} runs)</h3>
              <textarea
                rows={2}
                placeholder="Optional comma-separated phones to scrub (+9198..., +9199...) or leave blank to scrub all workspace leads"
                value={ncprPhonesInput}
                onChange={(e) => setNcprPhonesInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
              <button
                type="button"
                onClick={async () => {
                  const list = ncprPhonesInput
                    .split(/[\s,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const res = await trivaanaApi.runNcprScrub(list);
                  setLastNcprResult(res);
                  loadAll();
                }}
                className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold cursor-pointer"
              >
                Run NCPR Scrub
              </button>
              {lastNcprResult && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold">
                  Eligible: {lastNcprResult.eligible_count} / {lastNcprResult.total_checked} · Blocked: {lastNcprResult.blocked_count} ({lastNcprResult.provider_mode})
                </div>
              )}
              <div className="space-y-1.5">
                {ncprJobs.slice(0, 5).map((j: any) => (
                  <div key={j.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                    <span>{j.id} · {j.provider_mode}</span>
                    <span className="font-bold">{j.eligible_count}/{j.total_checked} eligible</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">CRM Outcome Disposition Mapping</h3>
                <p className="text-[11px] text-slate-500">Map AI outcomes into your CRM or dialer disposition codes before webhook delivery.</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await trivaanaApi.updateDispositions(dispositions);
                  setDispositions(res.mapping);
                  setFeedback({ type: 'success', message: 'CRM disposition mapping saved.' });
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
              >
                Save Dispositions
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.entries(dispositions).map(([outcomeKey, crmCode]) => (
                <div key={outcomeKey} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-mono font-bold text-slate-700 w-36 truncate">{outcomeKey}</span>
                  <input
                    value={crmCode}
                    onChange={(e) => setDispositions((prev) => ({ ...prev, [outcomeKey]: e.target.value }))}
                    className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'credentials' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-orange-600" /> Workspace API Keys & Credentials Vault
          </h2>
          <div className="flex gap-2 max-w-md">
            <input placeholder="Key Label (e.g. CRM Production)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-slate-200" />
            <button
              onClick={async () => {
                if (!newKeyName) return;
                const res = await trivaanaApi.createApiKey(newKeyName);
                setCreatedKey(res.api_key);
                setNewKeyName('');
                loadAll();
              }}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Create
            </button>
          </div>
          {createdKey && <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 font-mono text-[11px] break-all">New API Key: {createdKey}</div>}
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div key={k.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="font-bold">{k.name}</span>
                <span className="font-mono text-slate-500">{k.key_prefix}***</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Verified Consent Ledger ({consents.length})</h2>
            {consents.length === 0 ? (
              <div className="py-8 text-center text-slate-400">No consent records captured yet.</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {consents.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                    <div>
                      <div className="font-mono font-bold text-slate-900">{c.phone || c.phone_number}</div>
                      <div className="text-[11px] text-slate-500">{c.consent_purpose} • {c.consent_source}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase h-fit">{c.consent_status || c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Workspace Security Audit Trail ({auditLogs.length})</h2>
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400">No workspace audit events recorded yet.</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {auditLogs.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{a.action}</div>
                      <div className="text-[11px] text-slate-500">{a.resource_type} • {a.resource_id}</div>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">{a.created_at}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
