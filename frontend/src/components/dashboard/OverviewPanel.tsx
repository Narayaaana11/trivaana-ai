import React, { useState } from 'react';
import {
  CountUp,
  AuroraBackground,
  GlareHover,
  SquishSwitch,
  BorderGlow,
  AnimatedList,
} from '@/components/reactbits';
import { trivaanaApi } from '@/lib/trivaana-api';
import BRAND from '@/lib/brand';
import { INDUSTRY_TEMPLATE_CATEGORIES } from '@/lib/templates';
import { padDailySeries } from '@/lib/charts';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Wallet,
  Users,
  PhoneCall,
  Clock,
  CalendarCheck,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
  Bot,
  Activity,
  FileJson,
  LayoutTemplate,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { AnalyticsStats, Tenant, CallLog } from '@/types/trivaana';
import { DashboardTab } from './AppSidebar';

interface OverviewPanelProps {
  stats: AnalyticsStats | null;
  tenant: Tenant | null;
  calls: CallLog[];
  onNavigateTab: (tab: DashboardTab) => void;
  onOpenSimulator: () => void;
  onAgentCreated?: () => void;
}

const QUICK_SUGGESTIONS = [
  'Call new 2BHK/3BHK villa buyers in Telugu within 30s and book Saturday site visits',
  'Follow up on missed clinic appointments in Hindi and confirm rescheduled slot via WhatsApp',
  'Remind registered parents in Telugu about Sunday NEET scholarship webinar',
];

function consumeInitialLandingDraft(): {
  language: string;
  mode: 'instant' | 'bulk' | 'inbound';
  prompt: string;
} {
  const defaults = { language: 'te-IN', mode: 'instant' as const, prompt: '' };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem('trivaana_landing_draft');
    if (!raw) return defaults;
    localStorage.removeItem('trivaana_landing_draft');
    const parsed = JSON.parse(raw);
    return {
      language: parsed.language || 'te-IN',
      mode: (parsed.mode === 'bulk' || parsed.mode === 'inbound' ? parsed.mode : 'instant'),
      prompt: parsed.prompt || '',
    };
  } catch {
    return defaults;
  }
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  stats,
  tenant,
  calls,
  onNavigateTab,
  onOpenSimulator,
  onAgentCreated,
}) => {
  const [initialDraft] = useState(consumeInitialLandingDraft);
  const [language, setLanguage] = useState(initialDraft.language);
  const [naturalSpoken, setNaturalSpoken] = useState(true);
  const [callMode, setCallMode] = useState<'instant' | 'bulk' | 'inbound'>(initialDraft.mode);
  const [promptText, setPromptText] = useState(initialDraft.prompt);
  const [building, setBuilding] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string>('bfsi');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [scriptJson, setScriptJson] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const chartData = padDailySeries(stats?.daily_series);

  const handleBuildFromPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;
    setBuilding(true);
    setFeedback(null);
    try {
      const gen = await trivaanaApi.generateAgentPrompt({
        description: `${promptText.trim()}${naturalSpoken ? ' (Use natural spoken conversational code-mixed Indian phrasing)' : ''}`,
        language,
        call_direction: callMode === 'inbound' ? 'inbound' : 'outbound',
      });
      const cfg = gen.config;
      await trivaanaApi.createAgent({
        name: `AI Employee (${callMode.toUpperCase()} - ${language})`,
        language,
        call_direction: callMode === 'inbound' ? 'inbound' : 'outbound',
        calling_purpose: callMode,
        greeting_message: cfg.greeting,
        personality: cfg.personality,
        system_prompt: cfg.system_prompt,
        questions: cfg.question_sequence,
        extraction_schema: cfg.data_extraction_schema,
        qualification_criteria: cfg.qualification_logic,
        escalation_conditions: cfg.escalation_conditions,
        call_ending_conditions: cfg.call_ending_behaviour,
        never_say: cfg.safety_restrictions,
        structured_config: cfg,
        status: 'draft',
      });
      setPromptText('');
      if (onAgentCreated) onAgentCreated();
      onNavigateTab('agents');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBuilding(false);
    }
  };

  const handleImportJsonScript = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const parsed = JSON.parse(scriptJson);
      if (!parsed.system_prompt && !parsed.name) {
        throw new Error('JSON must contain at least system_prompt or name.');
      }
      await trivaanaApi.createAgent({
        name: parsed.name || 'Imported AI Employee',
        vertical: parsed.vertical || 'General',
        language: parsed.language || language,
        greeting_message: parsed.greeting_message || parsed.greeting,
        system_prompt: parsed.system_prompt || 'Imported script',
        questions: parsed.questions || parsed.question_sequence || [],
        extraction_schema: parsed.extraction_schema || parsed.data_extraction_schema || [],
        status: 'draft',
      });
      setShowPasteModal(false);
      setScriptJson('');
      if (onAgentCreated) onAgentCreated();
      onNavigateTab('agents');
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Invalid script JSON: ${err.message}` });
    }
  };

  return (
    <div className="space-y-6">
      {/* Dark Hero Prompt Builder Card (Outpero Home Pattern + ReactBits Aurora & Glare) */}
      <GlareHover className="rounded-[24px] shadow-xl">
        <AuroraBackground className="rounded-[24px] bg-outpero-dark-card text-[#f2f1f7] border border-white/10">
          <div className="p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[#ff8547] text-[11px] font-bold mb-2">
              <Sparkles className="w-3 h-3" />
              <span>AI Employee Architect</span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              What should your AI employee do?
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-3.5 py-1.5 rounded-full bg-[#1b1824] hover:bg-[#242030] border border-white/12 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-[#ff8547]" />
              <span>Templates (14 Industries)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="px-3.5 py-1.5 rounded-full bg-[#1b1824] hover:bg-[#242030] border border-white/12 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FileJson className="w-3.5 h-3.5 text-[#ff8547]" />
              <span>Paste script JSON</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleBuildFromPrompt} className="rounded-[18px] bg-[#1b1824]/90 border border-white/12 p-4 space-y-3.5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#121019] border border-white/15 text-white font-semibold"
            >
              {BRAND.languages.map((l) => (
                <option key={l.code} value={l.code}>{l.name} ({l.nativeName})</option>
              ))}
            </select>

            <SquishSwitch
              checked={naturalSpoken}
              onChange={setNaturalSpoken}
              label="Natural spoken"
              className="text-slate-300"
            />

            <div className="flex items-center gap-1 bg-[#121019] p-1 rounded-xl border border-white/10 ml-auto">
              {(['instant', 'bulk', 'inbound'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCallMode(m)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold capitalize cursor-pointer transition-colors ${
                    callMode === m ? 'bg-[#ff5500] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={3}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="e.g., Call new property enquiries in Telugu within 30 seconds, ask about 2BHK/3BHK preference, budget, location, and book a weekend site visit..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none resize-none"
          />

          <div className="flex flex-wrap gap-1.5">
            {QUICK_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPromptText(s)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 truncate max-w-full sm:max-w-[260px] cursor-pointer transition-colors"
                title={s}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-white/10">
            <button
              type="button"
              onClick={onOpenSimulator}
              className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 text-[#ff8547]" />
              <span>Open AI Voice Sandbox</span>
            </button>
            <button
              type="submit"
              disabled={!promptText.trim() || building}
              className="px-5 py-2 rounded-full bg-white text-[#121019] hover:bg-[#fff7ed] disabled:opacity-45 text-xs font-extrabold shadow-lg cursor-pointer transition-colors"
            >
              {building ? 'Building AI Employee...' : 'Continue →'}
            </button>
          </div>
        </form>

        {/* Expandable 14-Category Template Browser */}
        {showTemplates && (
          <div className="rounded-2xl bg-[#1b1824] border border-white/10 p-4 space-y-2 max-h-80 overflow-y-auto text-xs">
            <div className="font-bold text-slate-200 mb-2">Choose an Industry Template</div>
            {INDUSTRY_TEMPLATE_CATEGORIES.map((cat) => (
              <div key={cat.id} className="border border-white/10 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedCat(expandedCat === cat.id ? '' : cat.id)}
                  className="w-full px-3.5 py-2.5 bg-[#121019] flex items-center justify-between font-bold text-left cursor-pointer"
                >
                  <span>{cat.name} ({cat.templates.length})</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedCat === cat.id ? 'rotate-180' : ''}`} />
                </button>
                {expandedCat === cat.id && (
                  <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cat.templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setPromptText(tpl.description);
                          setCallMode(tpl.mode.toLowerCase() as any);
                          setShowTemplates(false);
                        }}
                        className="p-2.5 rounded-xl bg-[#121019] hover:bg-[#221e2d] border border-white/10 text-left cursor-pointer"
                      >
                        <div className="flex justify-between items-center font-bold text-white">
                          <span>{tpl.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ff5500]/25 text-[#ff8547]">{tpl.mode}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{tpl.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
          </div>
        </AuroraBackground>
      </GlareHover>

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

      {/* 6 Database-Driven Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <BorderGlow className="shadow-2xs">
          <div className="p-4 h-full">
            <div className="flex items-center justify-between text-[#8a8a98] mb-2">
              <span className="text-[11px] font-medium">Wallet Credits</span>
              <Wallet className="w-4 h-4 text-[#ff5500]" />
            </div>
            <div className="font-display text-xl font-extrabold text-[#0f0f14] tabular-nums">
              ₹<CountUp to={stats?.wallet_balance_inr ?? tenant?.wallet_balance ?? 0} duration={0.8} separator="," />
            </div>
            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 mt-1">
              <ArrowUpRight className="w-2.5 h-2.5" /> Integer Paise Ledger
            </span>
          </div>
        </BorderGlow>

        <BorderGlow className="shadow-2xs">
          <div className="p-4 h-full">
            <div className="flex items-center justify-between text-[#8a8a98] mb-2">
              <span className="text-[11px] font-medium">AI Employees</span>
              <Bot className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="font-display text-xl font-extrabold text-[#0f0f14] tabular-nums">
              {stats?.active_ai_employees ?? 0} / {stats?.total_ai_employees ?? 0}
            </div>
            <span className="text-[10px] text-[#525260] font-medium block mt-1">Active / Total</span>
          </div>
        </BorderGlow>

        <BorderGlow className="shadow-2xs">
          <div className="p-4 h-full">
            <div className="flex items-center justify-between text-[#8a8a98] mb-2">
              <span className="text-[11px] font-medium">CRM Leads</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="font-display text-xl font-extrabold text-[#0f0f14] tabular-nums">
              {stats?.total_leads ?? 0}
            </div>
            <span className="text-[10px] text-[#525260] font-medium block mt-1">Workspace Contacts</span>
          </div>
        </BorderGlow>

        <BorderGlow className="shadow-2xs">
          <div className="p-4 h-full">
            <div className="flex items-center justify-between text-[#8a8a98] mb-2">
              <span className="text-[11px] font-medium">Total Calls</span>
              <PhoneCall className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-display text-xl font-extrabold text-[#0f0f14] tabular-nums">
              {stats?.total_calls_placed ?? 0}
            </div>
            <span className="text-[10px] text-emerald-600 font-medium block mt-1">
              {stats?.connection_rate_pct ?? 0}% Connected
            </span>
          </div>
        </BorderGlow>

        <BorderGlow className="shadow-2xs">
          <div className="p-4 h-full">
            <div className="flex items-center justify-between text-[#8a8a98] mb-2">
              <span className="text-[11px] font-medium">Talk Time</span>
              <Clock className="w-4 h-4 text-violet-600" />
            </div>
            <div className="font-display text-xl font-extrabold text-[#0f0f14] tabular-nums">
              {stats?.total_duration_minutes ?? 0}m
            </div>
            <span className="text-[10px] text-[#525260] font-medium block mt-1 tabular-nums">
              Avg {stats?.average_call_duration_seconds ?? 0}s / call
            </span>
          </div>
        </BorderGlow>

        <BorderGlow className="shadow-2xs">
          <div className="p-4 h-full">
            <div className="flex items-center justify-between text-[#8a8a98] mb-2">
              <span className="text-[11px] font-medium">Appointments</span>
              <CalendarCheck className="w-4 h-4 text-amber-600" />
            </div>
            <div className="font-display text-xl font-extrabold text-[#0f0f14] tabular-nums">
              {stats?.appointments_booked ?? stats?.demos_booked ?? 0}
            </div>
            <span className="text-[10px] text-[#ff5500] font-medium block mt-1 tabular-nums">
              Conv: {stats?.demo_conversion_rate ?? '0.0%'}
            </span>
          </div>
        </BorderGlow>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-[#e4e4e9] shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-base font-bold text-[#0f0f14]">Daily Call Volume & Connected Calls</h2>
              <p className="text-xs text-[#6e6e7e]">Computed directly from persisted workspace call records</p>
            </div>
            <button
              onClick={() => onNavigateTab('analytics')}
              className="text-xs font-bold text-[#ff5500] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Performance</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {chartData.length === 0 ? (
            <EmptyState
              compact
              icon={Activity}
              title="No Call Data Recorded Yet"
              description="Run an Instant Lead call, Bulk Campaign, or Sandbox Simulation to see live daily telemetry here."
              actionLabel="Launch Sandbox Call"
              onAction={onOpenSimulator}
            />
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF5500" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#FF5500" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorConnected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16A34A" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a8a98' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#8a8a98' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" name="Total Calls" stroke="#FF5500" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="connected" name="Connected" stroke="#16A34A" strokeWidth={2.5} fillOpacity={1} fill="url(#colorConnected)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-[#e4e4e9] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-bold text-[#0f0f14]">Recent Conversations</h2>
              <button
                onClick={() => onNavigateTab('intelligence')}
                className="text-xs font-semibold text-[#ff5500] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2.5">
              {calls.length === 0 ? (
                <EmptyState
                  compact
                  icon={PhoneCall}
                  title="No Conversations Yet"
                  description="Your live and simulated transcripts will appear here automatically after your first call."
                  actionLabel="Test Voice Sandbox"
                  onAction={onOpenSimulator}
                />
              ) : (
                <AnimatedList className="space-y-2.5">
                  {calls.slice(0, 5).map((call) => (
                    <div
                      key={call.id}
                      onClick={() => onNavigateTab('intelligence')}
                      className="p-3 rounded-xl bg-[#f6f6f8]/70 hover:bg-[#ebebf0]/80 border border-[#e4e4e9] transition-all cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[#0f0f14] truncate">{call.contact_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#e4e4e9] text-[#525260] font-semibold">
                            {call.language}
                          </span>
                          {call.is_sandbox && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase">
                              Simulated
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#6e6e7e] mt-0.5 tabular-nums">
                          {call.phone} • {call.duration}s • {call.direction}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-[#0f0f14] tabular-nums">₹{call.cost.toFixed(2)}</div>
                        <div className="text-[10px] font-medium text-emerald-700 truncate max-w-[120px]">{call.outcome}</div>
                      </div>
                    </div>
                  ))}
                </AnimatedList>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Paste JSON Script Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleImportJsonScript} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-3 text-xs shadow-2xl border border-[#e4e4e9]">
            <div className="flex justify-between items-center border-b border-[#e4e4e9] pb-3">
              <h3 className="font-display text-base font-extrabold text-[#0f0f14]">Paste a Copied Script JSON</h3>
              <button type="button" onClick={() => setShowPasteModal(false)} className="text-[#6e6e7e] hover:text-[#0f0f14] cursor-pointer">
                Cancel
              </button>
            </div>
            <p className="text-[#525260]">Nothing is created until you validate and confirm.</p>
            <textarea
              required
              rows={8}
              value={scriptJson}
              onChange={(e) => setScriptJson(e.target.value)}
              placeholder='{"name":"My Agent","language":"te-IN","system_prompt":"..."}'
              className="w-full px-3 py-2 rounded-xl border border-[#e4e4e9] font-mono-code text-[#0f0f14]"
            />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ea580c] text-white font-bold cursor-pointer">
              Check Script & Create Draft
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
