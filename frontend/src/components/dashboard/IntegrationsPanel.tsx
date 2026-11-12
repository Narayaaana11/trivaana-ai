import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { ChromaGrid, BorderGlow } from '@/components/reactbits';
import { Plug, Webhook, CheckCircle2, AlertCircle, Plus, MessageSquare, RotateCw, Trash2, KeyRound, Activity } from 'lucide-react';

const WEBHOOK_EVENTS = [
  'call.completed',
  'call.not_connected',
  'lead.qualified',
  'call.inbound_answered',
  'call.inbound_missed',
  'campaign.status_changed',
];

export const IntegrationsPanel: React.FC = () => {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [integrationLogs, setIntegrationLogs] = useState<any[]>([]);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whEvents, setWhEvents] = useState<string[]>(['call.completed', 'lead.qualified']);
  const [whIncludeTranscripts, setWhIncludeTranscripts] = useState(true);
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState('UTILITY');
  const [tplBody, setTplBody] = useState('');
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAll = async () => {
    try {
      const [iRes, wRes, wtRes, logRes] = await Promise.all([
        trivaanaApi.getIntegrations(),
        trivaanaApi.getWebhooks(),
        trivaanaApi.getWhatsAppTemplates().catch(() => ({ templates: [] })),
        trivaanaApi.getIntegrationLogs().catch(() => ({ logs: [] })),
      ]);
      setIntegrations(iRes.integrations || []);
      setWebhooks(wRes.webhooks || []);
      setWaTemplates(wtRes.templates || []);
      setIntegrationLogs(logRes.logs || []);
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

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await trivaanaApi.createWebhook({
        name: whName,
        url: whUrl,
        events: whEvents.length ? whEvents : ['call.completed'],
        include_transcripts: whIncludeTranscripts,
      });
      setWhName('');
      setWhUrl('');
      setNewSecret(res.signing_secret);
      setFeedback({ type: 'success', message: 'Webhook endpoint registered with HMAC-SHA256 signing secret.' });
      loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
          <Plug className="w-3.5 h-3.5 text-orange-600" />
          <span>Integrations Marketplace & HMAC Webhooks</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Integrations & Event Webhooks</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Connect CRMs, calendars, WhatsApp Cloud API, telephony carriers, and HMAC-SHA256 signed outbound webhooks.
        </p>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Marketplace Grid */}
      <ChromaGrid>
        {integrations.map((intItem) => (
          <BorderGlow key={intItem.provider_key} className="shadow-2xs">
            <div className="p-5 flex flex-col justify-between gap-3 text-xs h-full">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-black text-sm text-slate-900">{intItem.display_name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    intItem.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {intItem.status}
                  </span>
                </div>
                <p className="text-slate-500">{intItem.description}</p>
              </div>
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await trivaanaApi.testIntegration(intItem.provider_key);
                        setFeedback({ type: res.configured ? 'success' : 'error', message: res.message });
                        loadAll();
                      } catch (err: any) {
                        setFeedback({ type: 'error', message: err.message });
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-800 cursor-pointer"
                  >
                    Test Connection
                  </button>
                </div>
                <details className="group">
                  <summary className="inline-block px-3 py-1.5 rounded-xl bg-orange-600 text-white font-bold cursor-pointer list-none">
                    Configure
                  </summary>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const token = (form.elements.namedItem('credential_token') as HTMLInputElement | null)?.value?.trim();
                      const targetId = (form.elements.namedItem('target_id') as HTMLInputElement | null)?.value?.trim();
                      const webhookUrl = (form.elements.namedItem('webhook_url') as HTMLInputElement | null)?.value?.trim();
                      const cfg: Record<string, any> = { enabled: true };
                      if (token) {
                        if (intItem.provider_key.startsWith('google')) {
                          cfg.access_token = token;
                        } else {
                          cfg.api_key = token;
                        }
                      }
                      if (targetId) {
                        if (intItem.provider_key === 'google_calendar') cfg.calendar_id = targetId;
                        else if (intItem.provider_key === 'google_sheets') cfg.spreadsheet_id = targetId;
                        else cfg.account_id = targetId;
                      }
                      if (webhookUrl) cfg.webhook_url = webhookUrl;
                      try {
                        await trivaanaApi.connectIntegration(intItem.provider_key, cfg);
                        setFeedback({ type: 'success', message: `${intItem.display_name} credentials encrypted & saved.` });
                        form.reset();
                        loadAll();
                      } catch (err: any) {
                        setFeedback({ type: 'error', message: err.message });
                      }
                    }}
                    className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                  >
                    <input
                      name="credential_token"
                      type="password"
                      placeholder={intItem.provider_key.startsWith('google') ? 'OAuth Access Token' : 'API Key / Access Token'}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                    />
                    <input
                      name="target_id"
                      type="text"
                      placeholder={intItem.provider_key === 'google_calendar' ? 'Calendar ID (e.g. primary)' : intItem.provider_key === 'google_sheets' ? 'Spreadsheet ID' : 'Account / Phone Number ID (optional)'}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                    />
                    <input
                      name="webhook_url"
                      type="url"
                      placeholder="Endpoint / Webhook URL (optional)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                    />
                    <button type="submit" className="w-full py-1.5 rounded-lg bg-slate-900 text-white font-bold text-[11px] cursor-pointer">
                      Save &amp; Connect
                    </button>
                  </form>
                </details>
              </div>
            </div>
          </BorderGlow>
        ))}
      </ChromaGrid>

      {/* Outbound Webhooks */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4 text-xs">
        <div className="font-bold text-base text-slate-900 flex items-center gap-2">
          <Webhook className="w-4 h-4 text-orange-600" /> Outbound HMAC-SHA256 Webhooks
        </div>
        <form onSubmit={handleCreateWebhook} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input required placeholder="Webhook Name" value={whName} onChange={(e) => setWhName(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200" />
            <input required type="url" placeholder="https://your-crm.com/webhooks/trivaana" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200" />
            <button type="submit" className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-1 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add Webhook
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => {
                const checked = whEvents.includes(ev);
                return (
                  <label key={ev} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer text-[11px] font-mono">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setWhEvents((prev) => (prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]))
                      }
                    />
                    <span>{ev}</span>
                  </label>
                );
              })}
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={whIncludeTranscripts}
                onChange={(e) => setWhIncludeTranscripts(e.target.checked)}
              />
              <span>Include call transcripts</span>
            </label>
          </div>
        </form>
        {newSecret && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 font-mono text-emerald-900">
            Signing Secret (save securely): {newSecret}
          </div>
        )}
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <div key={wh.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900">{wh.name}</div>
                <div className="font-mono text-[11px] text-slate-500">{wh.url}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                  {(wh.events || []).join(', ')}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await trivaanaApi.rotateWebhookSecret(wh.id);
                    setNewSecret(res.signing_secret);
                    setFeedback({ type: 'success', message: `Rotated signing secret for ${wh.name}.` });
                  }}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
                  title="Rotate Signing Secret"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await trivaanaApi.deleteWebhook(wh.id);
                    loadAll();
                  }}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-red-600 cursor-pointer"
                  title="Delete Webhook"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp Templates Manager */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4 text-xs">
        <div className="font-bold text-base text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp Follow-Up Templates ({waTemplates.length})
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!tplName.trim() || !tplBody.trim()) return;
            await trivaanaApi.createWhatsAppTemplate({
              name: tplName.trim(),
              category: tplCategory,
              body_text: tplBody.trim(),
            });
            setTplName('');
            setTplBody('');
            setFeedback({ type: 'success', message: 'WhatsApp template saved.' });
            loadAll();
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-2"
        >
          <input
            required
            placeholder="Template Name (e.g. Site Visit Confirm)"
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200"
          />
          <select
            value={tplCategory}
            onChange={(e) => setTplCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200"
          >
            <option value="UTILITY">Utility (Post-Call Summary)</option>
            <option value="MARKETING">Marketing / Follow-Up</option>
            <option value="AUTHENTICATION">Authentication / OTP</option>
          </select>
          <input
            required
            placeholder="Hi {{1}}, thanks for speaking with {{2}}..."
            value={tplBody}
            onChange={(e) => setTplBody(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200"
          />
          <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer">
            Save Template
          </button>
        </form>
        {waTemplates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {waTemplates.map((t) => (
              <div key={t.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">{t.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase">{t.category}</span>
                </div>
                <p className="text-[11px] text-slate-600">{t.body_text || t.body_template}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integration Delivery Logs */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs">
        <div className="font-bold text-base text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-600" /> Integration & CRM Sync Logs ({integrationLogs.length})
        </div>
        {integrationLogs.length === 0 ? (
          <div className="py-6 text-center text-slate-400">No integration sync events recorded yet.</div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {integrationLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">{log.provider_key} • {log.event_name || 'sync'}</div>
                  <div className="text-[11px] text-slate-500">{log.error_message || log.status}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    log.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {log.status}
                  </span>
                  {log.status === 'failed' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await trivaanaApi.retryIntegrationLog(log.id);
                        loadAll();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" /> Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

