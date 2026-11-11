import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Agent } from '@/types/trivaana';
import { DecryptedText } from '@/components/reactbits';
import {
  Code2,
  KeyRound,
  Webhook,
  Activity,
  Plus,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
} from 'lucide-react';

const WEBHOOK_EVENTS = [
  { id: 'call.completed', label: 'call.completed', desc: 'Fired when a call completes with duration, summary, and outcome' },
  { id: 'call.not_connected', label: 'call.not_connected', desc: 'Fired when a call ends unanswered, busy, or failed' },
  { id: 'lead.created', label: 'lead.created', desc: 'Fired when a new lead enters via intake API or CRM' },
  { id: 'call.inbound_answered', label: 'call.inbound_answered', desc: 'Fired when an AI employee answers an incoming call' },
  { id: 'call.inbound_missed', label: 'call.inbound_missed', desc: 'Fired when an inbound caller hangs up or requests callback' },
  { id: 'campaign.status_changed', label: 'campaign.status_changed', desc: 'Fired when a campaign starts, pauses, completes, or halts' },
];

interface DevelopersPanelProps {
  initialSubTab?: 'overview' | 'keys' | 'webhooks' | 'logs';
}

export const DevelopersPanel: React.FC<DevelopersPanelProps> = ({ initialSubTab = 'overview' }) => {
  const [subTab, setSubTab] = useState<'overview' | 'keys' | 'webhooks' | 'logs'>(initialSubTab);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [integrationLogs, setIntegrationLogs] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [includeTranscripts, setIncludeTranscripts] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['call.completed', 'lead.created']);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAll = async () => {
    try {
      const [aRes, kRes, wRes, dRes, lRes] = await Promise.all([
        trivaanaApi.getAgents().catch(() => ({ agents: [] })),
        trivaanaApi.getApiKeys().catch(() => ({ api_keys: [] })),
        trivaanaApi.getWebhooks().catch(() => ({ webhooks: [] })),
        trivaanaApi.getWebhookDeliveries().catch(() => ({ deliveries: [] })),
        trivaanaApi.getIntegrationLogs().catch(() => ({ logs: [] })),
      ]);
      setAgents(aRes.agents || []);
      setApiKeys(kRes.api_keys || []);
      setWebhooks(wRes.webhooks || []);
      setDeliveries(dRes.deliveries || []);
      setIntegrationLogs(lRes.logs || []);
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

  const sampleSlug = agents[0]?.slug || 'your-agent-slug';

  const toggleEvent = (ev: string) => {
    setSelectedEvents((prev) => (prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]));
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await trivaanaApi.createWebhook({
        name: whName || 'Production Webhook',
        url: whUrl,
        events: selectedEvents,
        include_transcripts: includeTranscripts,
      });
      setCreatedSecret(res.signing_secret);
      setShowWebhookModal(false);
      setWhName('');
      setWhUrl('');
      setFeedback({ type: 'success', message: 'Webhook endpoint added with HMAC-SHA256 signing secret.' });
      loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
            <Code2 className="w-3.5 h-3.5 text-orange-600" />
            <span>Developers Hub</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">API Keys, Lead Intake & Webhooks</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Trigger sub-30s AI calls from any form or CRM, manage workspace API keys, and subscribe to HMAC-signed webhooks.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
          {[
            { id: 'overview', label: 'Overview', icon: Code2 },
            { id: 'keys', label: 'API Keys', icon: KeyRound },
            { id: 'webhooks', label: 'Webhooks', icon: Webhook },
            { id: 'logs', label: 'API Activity', icon: Activity },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  subTab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {subTab === 'overview' && (
        <div className="bg-slate-950 text-slate-100 rounded-3xl p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-orange-400">Instant Lead Intake Quickstart</div>
              <div className="text-slate-400 mt-0.5">Send leads from any website or CRM → 202 / call initiated in under 30s</div>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(`POST /api/public/lead-intake/${sampleSlug}`)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Endpoint
            </button>
          </div>
          <pre className="p-4 rounded-2xl bg-slate-900 border border-slate-800 font-mono text-[11px] overflow-x-auto leading-relaxed">
{`curl -X POST "https://your-domain/api/public/lead-intake/${sampleSlug}" \\
  -H "Content-Type: application/json" \\
  -H "X-Intake-Secret: trv_lead_your_agent_secret" \\
  -d '{
    "name": "Rahul Sharma",
    "phone": "+919848012345",
    "property": "3BHK Villa",
    "budget": "1.5 Cr",
    "consent_confirmed": true
  }'`}
          </pre>
        </div>
      )}

      {subTab === 'keys' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4 text-xs">
          <div className="flex gap-2">
            <input
              placeholder="Key name (e.g. Production CRM Sync)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200"
            />
            <button
              onClick={async () => {
                if (!newKeyName.trim()) return;
                const res = await trivaanaApi.createApiKey(newKeyName);
                setCreatedKey(res.api_key);
                setNewKeyName('');
                loadAll();
              }}
              className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Create API Key
            </button>
          </div>
          {createdKey && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 font-mono text-emerald-900 break-all">
              New API Key (copy once): {createdKey}
            </div>
          )}
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div key={k.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{k.name}</div>
                  <div className="font-mono text-[11px] text-slate-500">
                    <DecryptedText text={`${k.key_prefix}***`} /> • Created {k.created_at?.slice(0, 10)}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${k.revoked_at ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {k.revoked_at ? 'Revoked' : 'Active'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'webhooks' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-900">Webhook Endpoints</div>
              <div className="text-slate-500">Payloads signed with HMAC-SHA256 (`X-Trivaana-Signature`)</div>
            </div>
            <button
              onClick={() => setShowWebhookModal(true)}
              className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add endpoint
            </button>
          </div>

          {createdSecret && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 font-mono text-emerald-900 break-all">
              Signing Secret: {createdSecret}
            </div>
          )}

          {webhooks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl">No webhook endpoints registered yet.</div>
          ) : (
            webhooks.map((wh) => (
              <div key={wh.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900">{wh.name}</div>
                  <div className="font-mono text-[11px] text-slate-600">{wh.url}</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(wh.events || []).map((ev: string) => (
                      <span key={ev} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono">{ev}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const r = await trivaanaApi.rotateWebhookSecret(wh.id);
                      setCreatedSecret(r.signing_secret);
                      setFeedback({ type: 'success', message: 'Rotated webhook signing secret.' });
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Rotate Secret
                  </button>
                  <button
                    onClick={async () => {
                      await trivaanaApi.deleteWebhook(wh.id);
                      loadAll();
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3">
            <div className="font-bold text-slate-900">Webhook Deliveries ({deliveries.length})</div>
            {deliveries.length === 0 ? (
              <div className="py-6 text-center text-slate-400">No webhook deliveries yet.</div>
            ) : (
              deliveries.map((d) => (
                <div key={d.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                  <div>
                    <div className="font-mono font-bold">{d.event_type}</div>
                    <div className="text-[11px] text-slate-500">{d.created_at}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {d.status} ({d.response_status || '—'})
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3">
            <div className="font-bold text-slate-900">Integration Activity Logs ({integrationLogs.length})</div>
            {integrationLogs.length === 0 ? (
              <div className="py-6 text-center text-slate-400">No integration test/sync events yet.</div>
            ) : (
              integrationLogs.map((l) => (
                <div key={l.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold">{l.provider_key} • {l.event_name}</div>
                    <div className="text-[11px] text-slate-500">{l.status} (retries: {l.retry_count})</div>
                  </div>
                  <button
                    onClick={async () => {
                      await trivaanaApi.retryIntegrationLog(l.id);
                      loadAll();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showWebhookModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateWebhook} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Add Webhook Endpoint</h3>
              <button type="button" onClick={() => setShowWebhookModal(false)} className="text-slate-500 cursor-pointer">Close</button>
            </div>
            <input required placeholder="Endpoint Label (e.g. CRM Webhook)" value={whName} onChange={(e) => setWhName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            <input required type="url" placeholder="https://api.yourcrm.com/webhooks/trivaana" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <span className="font-bold text-slate-800">Include call transcripts in payload</span>
              <input type="checkbox" checked={includeTranscripts} onChange={(e) => setIncludeTranscripts(e.target.checked)} />
            </label>
            <div className="space-y-1.5">
              <div className="font-bold text-slate-700">Subscribed Events</div>
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev.id} className="flex items-start gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selectedEvents.includes(ev.id)} onChange={() => toggleEvent(ev.id)} className="mt-0.5" />
                  <div>
                    <div className="font-mono font-bold text-slate-900">{ev.label}</div>
                    <div className="text-[11px] text-slate-500">{ev.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">
              Save Endpoint
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

