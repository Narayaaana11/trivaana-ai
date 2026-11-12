import React, { Suspense, lazy, useState, useEffect } from 'react';
import { AppSidebar, DashboardTab } from './AppSidebar';
import { OverviewPanel } from './OverviewPanel';
import { LeadManagementPanel } from './LeadManagementPanel';
import { CampaignManagerPanel } from './CampaignManagerPanel';
import { InstantLeadsPanel } from './InstantLeadsPanel';
import { IncomingCallsPanel } from './IncomingCallsPanel';
import { AgentStudioPanel } from './AgentStudioPanel';
import { VoiceStudioPanel } from './VoiceStudioPanel';
import { CallIntelligencePanel } from './CallIntelligencePanel';
import { VoiceBroadcastPanel } from './VoiceBroadcastPanel';
import { KnowledgeBasePanel } from './KnowledgeBasePanel';
import { IntegrationsPanel } from './IntegrationsPanel';
import { PhoneNumbersPanel } from './PhoneNumbersPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { FinancialLedgerPanel } from './FinancialLedgerPanel';
import { SettingsPanel } from './SettingsPanel';
import { DevelopersPanel } from './DevelopersPanel';
import { AppointmentsPanel } from './AppointmentsPanel';
import { WorkflowsPanel } from './WorkflowsPanel';
import { SupportTicketsPanel } from './SupportTicketsPanel';

const AdminPortal = lazy(() =>
  import('@/apps/admin/AdminPortal').then((m) => ({ default: m.AdminPortal }))
);
const StaffPortal = lazy(() =>
  import('@/apps/staff/StaffPortal').then((m) => ({ default: m.StaffPortal }))
);
import { LiveCallSimulatorModal } from './LiveCallSimulatorModal';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Tenant, AnalyticsStats, CallLog } from '@/types/trivaana';
import {
  BellToggle,
  CallChip,
  Dock,
  Stepper,
  SpringCheck,
  ReactBitsShowcaseModal,
} from '@/components/reactbits';
import {
  LogOut,
  Menu,
  Search,
  Activity,
  ChevronUp,
  ChevronDown,
  Sparkles,
  X,
  Compass,
  HelpCircle,
  Sun,
  Moon,
  ArrowRight,
  LifeBuoy,
  Bot,
  Code2,
  PhoneCall,
} from 'lucide-react';

interface MissionControlProps {
  onExitDashboard: () => void;
  initialTab?: DashboardTab;
  initialPreset?: string;
}

const TAB_TO_HASH: Record<DashboardTab, string> = {
  overview: '#/home',
  agents: '#/employees',
  voices: '#/voices',
  leads: '#/leads',
  appointments: '#/appointments',
  workflows: '#/workflows',
  intelligence: '#/conversations',
  analytics: '#/performance',
  campaigns: '#/campaigns',
  'instant-leads': '#/instant',
  inbound: '#/inbound',
  broadcast: '#/broadcast',
  knowledge: '#/knowledge',
  integrations: '#/integrations',
  'phone-numbers': '#/numbers',
  billing: '#/billing',
  settings: '#/settings',
  developers: '#/developers',
  support: '#/support',
  'staff-portal': '#/staff',
  'super-admin': '#/admin',
};

interface ResolvedHashRoute {
  tab: DashboardTab;
  sub?: string;
}

const DEEP_HASH_MAP: Record<string, ResolvedHashRoute> = {
  '#/home': { tab: 'overview' },
  '#/employees': { tab: 'agents' },
  '#/employees/new': { tab: 'agents', sub: 'new' },
  '#/voices': { tab: 'voices' },
  '#/leads': { tab: 'leads' },
  '#/appointments': { tab: 'appointments' },
  '#/workflows': { tab: 'workflows' },
  '#/conversations': { tab: 'intelligence' },
  '#/performance': { tab: 'analytics' },
  '#/analytics': { tab: 'analytics' },
  '#/campaigns': { tab: 'campaigns' },
  '#/campaigns/new': { tab: 'campaigns', sub: 'new' },
  '#/instant': { tab: 'instant-leads', sub: 'activity' },
  '#/instant-leads': { tab: 'instant-leads', sub: 'activity' },
  '#/instant/analytics': { tab: 'instant-leads', sub: 'analytics' },
  '#/instant/queue': { tab: 'instant-leads', sub: 'queue' },
  '#/instant/sources': { tab: 'instant-leads', sub: 'sources' },
  '#/inbound': { tab: 'inbound', sub: 'overview' },
  '#/inbound/calls': { tab: 'inbound', sub: 'calls' },
  '#/inbound/messages': { tab: 'inbound', sub: 'messages' },
  '#/inbound/missed': { tab: 'inbound', sub: 'missed' },
  '#/broadcast': { tab: 'broadcast' },
  '#/knowledge': { tab: 'knowledge' },
  '#/integrations': { tab: 'integrations' },
  '#/numbers': { tab: 'phone-numbers' },
  '#/billing': { tab: 'billing', sub: 'ledger' },
  '#/billing/statement': { tab: 'billing', sub: 'ledger' },
  '#/billing/invoices': { tab: 'billing', sub: 'invoices' },
  '#/billing/details': { tab: 'billing', sub: 'billing_details' },
  '#/billing/add': { tab: 'billing', sub: 'ledger' },
  '#/settings': { tab: 'settings', sub: 'general' },
  '#/settings/account': { tab: 'settings', sub: 'account' },
  '#/settings/memory': { tab: 'settings', sub: 'callers' },
  '#/settings/dnc': { tab: 'settings', sub: 'dnc' },
  '#/settings/credentials': { tab: 'settings', sub: 'credentials' },
  '#/settings/privacy': { tab: 'settings', sub: 'privacy' },
  '#/developers': { tab: 'developers', sub: 'overview' },
  '#/developers/keys': { tab: 'developers', sub: 'keys' },
  '#/developers/webhooks': { tab: 'developers', sub: 'webhooks' },
  '#/developers/logs': { tab: 'developers', sub: 'logs' },
  '#/support': { tab: 'support' },
  '#/staff': { tab: 'staff-portal' },
  '#/admin': { tab: 'super-admin' },
};

function resolveHashRoute(fallback: DashboardTab): ResolvedHashRoute {
  if (fallback !== 'overview') return { tab: fallback };
  if (typeof window === 'undefined') return { tab: fallback };
  const normalized = window.location.hash.split('?')[0].toLowerCase();
  if (normalized === '#/' || normalized === '') return { tab: fallback };
  return DEEP_HASH_MAP[normalized] || { tab: fallback };
}

const QUICK_JUMP_ITEMS: { id: DashboardTab; label: string; keywords: string }[] = [
  { id: 'overview', label: 'Home & Prompt Builder', keywords: 'home overview prompt create' },
  { id: 'agents', label: 'AI Employees (Your Team)', keywords: 'agents employees bot prompts voice flow' },
  { id: 'leads', label: 'Leads & CRM Pipeline', keywords: 'leads contacts csv pipeline' },
  { id: 'appointments', label: 'Appointments & Calendar', keywords: 'appointments calendar slots booking' },
  { id: 'workflows', label: 'Automation Workflows', keywords: 'workflows temporal automation builder' },
  { id: 'intelligence', label: 'Conversations & Transcripts', keywords: 'calls transcripts recordings summaries' },
  { id: 'analytics', label: 'Performance & Analytics', keywords: 'analytics charts metrics' },
  { id: 'campaigns', label: 'Bulk Campaigns & Lists', keywords: 'campaigns bulk csv dialer' },
  { id: 'instant-leads', label: 'Instant Leads (<30s)', keywords: 'instant leads queue sources' },
  { id: 'inbound', label: 'Incoming Calls', keywords: 'inbound incoming missed' },
  { id: 'broadcast', label: 'Voice Broadcast', keywords: 'broadcast announcements tts' },
  { id: 'knowledge', label: 'Knowledge Base (RAG)', keywords: 'kb knowledge pdf faq url' },
  { id: 'integrations', label: 'Integrations Marketplace', keywords: 'integrations crm whatsapp calendar' },
  { id: 'phone-numbers', label: 'Numbers & Channels', keywords: 'phone numbers kyc channels' },
  { id: 'billing', label: 'Credits & Billing', keywords: 'billing wallet razorpay gst invoices' },
  { id: 'settings', label: 'Settings, DNC & Memory', keywords: 'settings dnc compliance memory team' },
  { id: 'developers', label: 'Developers, API Keys & Webhooks', keywords: 'developers api keys webhooks logs' },
  { id: 'support', label: 'Support Tickets', keywords: 'support helpdesk tickets' },
];

const TOUR_STEPS: { title: string; body: string; tab: DashboardTab }[] = [
  {
    title: '1. Describe your AI Employee in natural language',
    body: 'Start on Home or Your Team to turn a 2-sentence prompt in Telugu, Hindi, Tamil, or Indian English into a structured call script with extraction fields.',
    tab: 'overview',
  },
  {
    title: '2. Ground answers in your Knowledge Base',
    body: 'Upload PDFs, pricing sheets, FAQs, or website URLs so your AI Employee quotes verified prices and policies with zero hallucinations.',
    tab: 'knowledge',
  },
  {
    title: '3. Connect numbers & deploy 3 calling channels',
    body: 'Launch sub-30s Instant Leads webhooks, scheduled Bulk Campaigns with TRAI DND protection, or 24×7 Incoming Call reception.',
    tab: 'campaigns',
  },
  {
    title: '4. Inspect transcripts, outcomes & GST ledger',
    body: 'Review timestamped transcripts, extracted structured leads, and pay only for connected talk time tracked in integer paise.',
    tab: 'intelligence',
  },
];

export const MissionControl: React.FC<MissionControlProps> = ({
  onExitDashboard,
  initialTab = 'overview',
  initialPreset,
}) => {
  const [currentTab, setCurrentTab] = useState<DashboardTab>(() =>
    resolveHashRoute(initialTab).tab
  );
  const [hashSubRoute, setHashSubRoute] = useState<string | undefined>(() =>
    resolveHashRoute(initialTab).sub
  );
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [activeCalls, setActiveCalls] = useState<CallLog[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showActivityPopover, setShowActivityPopover] = useState(false);
  const [showHelpPopover, setShowHelpPopover] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [cmdSearch, setCmdSearch] = useState('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showAssistantDrawer, setShowAssistantDrawer] = useState(false);
  const [showUiStudio, setShowUiStudio] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('trivaana_theme') : null;
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('trivaana_theme', theme);
  }, [theme]);

  useEffect(() => {
    const targetHash = TAB_TO_HASH[currentTab];
    if (typeof window !== 'undefined' && targetHash) {
      const currentBase = window.location.hash.split('?')[0].toLowerCase();
      const alreadyInTab = DEEP_HASH_MAP[currentBase]?.tab === currentTab;
      if (!alreadyInTab && currentBase !== targetHash) {
        try {
          window.history.replaceState(null, '', targetHash);
        } catch {
          window.location.hash = targetHash;
        }
      }
    }
  }, [currentTab]);

  useEffect(() => {
    const onHashChange = () => {
      const normalized = window.location.hash.split('?')[0].toLowerCase();
      const mapped = DEEP_HASH_MAP[normalized];
      if (mapped) {
        setCurrentTab(mapped.tab);
        setHashSubRoute(mapped.sub);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const refreshAllData = async () => {
    try {
      const [tData, sData, cData, meData, notifData, actData, numData] = await Promise.all([
        trivaanaApi.getTenant(),
        trivaanaApi.getStats(),
        trivaanaApi.getCalls(),
        trivaanaApi.getMe().catch(() => null),
        trivaanaApi.getNotifications().catch(() => ({ notifications: [], unread_count: 0 })),
        trivaanaApi.getActiveCalls().catch(() => ({ active_calls: [] })),
        trivaanaApi.getPhoneNumbers().catch(() => ({ phone_numbers: [] })),
      ]);
      setTenant(tData);
      setStats(sData);
      setCalls(cData.calls);
      setActiveCalls(actData.active_calls || []);
      setPhoneNumbers(numData.phone_numbers || []);
      setUserProfile(meData?.user || meData);
      setNotifications(notifData.notifications || []);
      setUnreadCount(notifData.unread_count || 0);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      void refreshAllData();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const setupSteps = [
    { label: '1. Business details & compliance', done: Boolean(tenant?.name), tab: 'settings' as DashboardTab },
    { label: '2. Hire your first AI employee', done: (stats?.total_ai_employees || 0) > 0, tab: 'agents' as DashboardTab },
    { label: '3. Test call in AI sandbox', done: (stats?.total_calls_placed || 0) > 0, tab: 'agents' as DashboardTab },
    { label: '4. Fund wallet credits', done: (tenant?.wallet_balance || 0) > 0, tab: 'billing' as DashboardTab },
    { label: '5. Connect a business number', done: phoneNumbers.length > 0, tab: 'phone-numbers' as DashboardTab },
    { label: '6. Launch calling campaign', done: (stats?.total_calls_placed || 0) > 0, tab: 'campaigns' as DashboardTab },
  ];
  const completedSteps = setupSteps.filter((s) => s.done).length;
  const initials = (userProfile?.full_name || 'TR').slice(0, 2).toUpperCase();
  const isSuperAdminUser = Boolean(userProfile?.is_super_admin);
  const hasStaffAccess = Boolean(
    isSuperAdminUser ||
      (typeof userProfile?.staff_role === 'string' && userProfile.staff_role.trim().length > 0)
  );

  return (
    <div className="trivaana-workspace-shell flex h-screen bg-[#f6f6f8] text-[#0f0f14] overflow-hidden">
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        tenant={tenant}
        stats={stats}
        isSuperAdmin={isSuperAdminUser}
        hasStaffAccess={hasStaffAccess}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onExitDashboard={onExitDashboard}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        theme={theme}
      />

      {/* Outpero Inset Rounded Main Shell */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-0 lg:p-2.5 lg:pl-0">
        <div className="trivaana-workspace-card flex-1 flex flex-col min-w-0 overflow-hidden bg-white lg:rounded-[14px] border border-[#e4e4e9] shadow-2xs relative">
          {/* Single-Line Top Utility Bar */}
          <header className="h-14 bg-white border-b border-[#e4e4e9] px-3 sm:px-5 flex items-center justify-between gap-2 shrink-0 relative z-20">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9] text-[#0f0f14] shrink-0"
                aria-label="Open menu"
              >
                <Menu className="w-4 h-4" />
              </button>
              <span className="font-display text-sm font-bold text-[#0f0f14] truncate max-w-[160px] sm:max-w-[240px] md:max-w-xs">
                {tenant?.name || 'Trivaana Workspace'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase hidden sm:inline shrink-0">
                {tenant?.plan || 'Growth'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Search Command Palette ⌘K */}
              <button
                onClick={() => setShowCommandPalette(true)}
                className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#f6f6f8] hover:bg-[#ebebf0] text-xs text-[#525260] border border-[#e4e4e9] whitespace-nowrap cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Search</span>
                <kbd className="text-[10px] font-mono-code bg-white px-1.5 py-0.5 rounded border border-[#e4e4e9] text-[#6e6e7e]">
                  ⌘K
                </kbd>
              </button>

              {/* Calling Activity Popover */}
              <div className="relative">
                <button
                  onClick={async () => {
                    setShowActivityPopover(!showActivityPopover);
                    setShowNotifications(false);
                    setShowHelpPopover(false);
                    setShowUserMenu(false);
                    const act = await trivaanaApi.getActiveCalls().catch(() => ({ active_calls: [] }));
                    setActiveCalls(act.active_calls || []);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#f6f6f8] hover:bg-[#ebebf0] border border-[#e4e4e9] text-xs font-semibold text-[#0f0f14] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  aria-label="Calling activity"
                >
                  <Activity className="w-3.5 h-3.5 text-[#ff5500] shrink-0" />
                  <span className="hidden lg:inline">Calling activity</span>
                  {activeCalls.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#ff5500] text-white text-[10px] font-bold tabular-nums">
                      {activeCalls.length}
                    </span>
                  )}
                </button>
                {showActivityPopover && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-[#e4e4e9] shadow-2xl p-4 z-50 text-xs space-y-2">
                    <div className="font-bold text-[#0f0f14] border-b border-[#e4e4e9] pb-2 flex items-center justify-between">
                      <span>Live Calling Activity</span>
                      <span className="text-[10px] font-normal text-[#8a8a98]">Real-time lines</span>
                    </div>
                    {activeCalls.length === 0 ? (
                      <div className="py-4 text-center text-[#8a8a98]">No active calls in progress right now.</div>
                    ) : (
                      activeCalls.map((ac) => (
                        <CallChip key={ac.id} name={ac.contact_name} status={ac.status} />
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Take the Tour */}
              <button
                onClick={() => {
                  setTourStep(0);
                  setShowTourModal(true);
                }}
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#fff7ed] hover:bg-[#ffedd5] border border-[#fed7aa] text-[#c2410c] text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-[#ff5500] shrink-0" />
                <span>Take the tour</span>
              </button>

              {/* Help Popover */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => {
                    setShowHelpPopover(!showHelpPopover);
                    setShowActivityPopover(false);
                    setShowNotifications(false);
                    setShowUserMenu(false);
                  }}
                  className="p-2 rounded-xl bg-[#f6f6f8] hover:bg-[#ebebf0] border border-[#e4e4e9] text-[#525260] cursor-pointer"
                  aria-label="Help and documentation"
                  title="Help & Docs"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                {showHelpPopover && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-[#e4e4e9] shadow-2xl p-4 z-50 text-xs space-y-2.5">
                    <div className="font-bold text-[#0f0f14] border-b border-[#e4e4e9] pb-2">Help & Shortcuts</div>
                    <button
                      onClick={() => {
                        setCurrentTab('developers');
                        setShowHelpPopover(false);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-[#f6f6f8] font-semibold text-[#0f0f14] flex justify-between cursor-pointer"
                    >
                      <span>API Quickstart & Webhooks</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#ff5500]" />
                    </button>
                    <button
                      onClick={() => {
                        setShowTourModal(true);
                        setShowHelpPopover(false);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-[#f6f6f8] font-semibold text-[#0f0f14] flex justify-between cursor-pointer"
                    >
                      <span>Interactive Product Tour</span>
                      <Compass className="w-3.5 h-3.5 text-[#ff5500]" />
                    </button>
                    <button
                      onClick={() => {
                        setIsSimulatorOpen(true);
                        setShowHelpPopover(false);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-[#f6f6f8] font-semibold text-[#0f0f14] flex justify-between cursor-pointer"
                    >
                      <span>Launch Voice Test Sandbox</span>
                      <LifeBuoy className="w-3.5 h-3.5 text-[#ff5500]" />
                    </button>
                    <button
                      onClick={() => {
                        setShowUiStudio(true);
                        setShowHelpPopover(false);
                      }}
                      className="w-full text-left p-2 rounded-xl bg-[#fff7ed] hover:bg-[#ffedd5] border border-[#fed7aa] font-bold text-[#c2410c] flex justify-between cursor-pointer"
                    >
                      <span>ReactBits UI Studio (58+)</span>
                      <Sparkles className="w-3.5 h-3.5 text-[#ff5500]" />
                    </button>
                  </div>
                )}
              </div>

              {/* Light / Dark Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-xl bg-[#f6f6f8] hover:bg-[#ebebf0] border border-[#e4e4e9] text-[#525260] cursor-pointer"
                aria-label="Toggle theme"
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
              </button>

              {/* Notifications Bell */}
              <div className="relative">
                <BellToggle
                  unreadCount={unreadCount}
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setShowActivityPopover(false);
                    setShowHelpPopover(false);
                    setShowUserMenu(false);
                  }}
                />
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-[#e4e4e9] shadow-2xl p-4 z-50 space-y-2 text-xs">
                    <div className="flex justify-between items-center border-b border-[#e4e4e9] pb-2">
                      <span className="font-bold text-[#0f0f14]">Notifications</span>
                      <button
                        onClick={async () => {
                          await trivaanaApi.markAllNotificationsRead();
                          refreshAllData();
                        }}
                        className="text-[#ff5500] font-semibold cursor-pointer"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <div className="py-4 text-center text-[#8a8a98]">No notifications</div>
                      ) : (
                        notifications.slice(0, 8).map((n) => (
                          <div
                            key={n.id}
                            className={`p-2.5 rounded-xl border ${
                              n.is_read
                                ? 'bg-[#f6f6f8] border-[#e4e4e9]'
                                : 'bg-[#fff7ed] border-[#fed7aa]'
                            }`}
                          >
                            <div className="font-bold text-[#0f0f14]">{n.title}</div>
                            <div className="text-[11px] text-[#525260]">{n.message}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Compact Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowUserMenu(!showUserMenu);
                    setShowNotifications(false);
                    setShowActivityPopover(false);
                    setShowHelpPopover(false);
                  }}
                  className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-[#f6f6f8] hover:bg-[#ebebf0] border border-[#e4e4e9] cursor-pointer whitespace-nowrap"
                  aria-label="Account menu"
                >
                  <div className="w-7 h-7 rounded-full bg-[#ff5500] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#6e6e7e] hidden sm:inline" />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-[#e4e4e9] shadow-2xl p-3 z-50 text-xs space-y-1.5">
                    <div className="px-2 py-1.5 border-b border-[#e4e4e9]">
                      <div className="font-bold text-[#0f0f14] truncate">{userProfile?.full_name || 'Demo Admin'}</div>
                      <div className="text-[11px] text-[#6e6e7e] truncate">{userProfile?.email || 'demo@trivaana.ai'}</div>
                    </div>
                    <button
                      onClick={() => {
                        setCurrentTab('settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#f6f6f8] font-medium text-[#0f0f14] cursor-pointer"
                    >
                      Workspace Settings
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTab('billing');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#f6f6f8] font-medium text-[#0f0f14] cursor-pointer"
                    >
                      Credits & GST Billing
                    </button>
                    <button
                      onClick={() => {
                        trivaanaApi.logout();
                        onExitDashboard();
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-red-50 font-semibold text-red-600 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Scroll Container with Generous Bottom Padding for Floating Pills */}
          <main className="trivaana-workspace-main flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f6f6f8]/60 relative">
            <div className="max-w-7xl mx-auto pb-24">
              {currentTab === 'overview' && (
                <OverviewPanel
                  stats={stats}
                  tenant={tenant}
                  calls={calls}
                  onNavigateTab={setCurrentTab}
                  onOpenSimulator={() => setIsSimulatorOpen(true)}
                  onAgentCreated={refreshAllData}
                />
              )}
              {currentTab === 'agents' && (
                <AgentStudioPanel
                  initialPreset={initialPreset}
                  initialCreate={hashSubRoute === 'new'}
                />
              )}
              {currentTab === 'voices' && (
                <VoiceStudioPanel onAgentUpdated={refreshAllData} />
              )}
              {currentTab === 'campaigns' && <CampaignManagerPanel onCampaignUpdated={refreshAllData} />}
              {currentTab === 'instant-leads' && (
                <InstantLeadsPanel
                  onCallUpdated={refreshAllData}
                  onNavigateIntegrations={() => setCurrentTab('integrations')}
                  initialSubTab={
                    hashSubRoute === 'analytics' ||
                    hashSubRoute === 'queue' ||
                    hashSubRoute === 'sources'
                      ? hashSubRoute
                      : 'activity'
                  }
                />
              )}
              {currentTab === 'inbound' && (
                <IncomingCallsPanel
                  onNavigateNumbers={() => setCurrentTab('phone-numbers')}
                  initialSubTab={
                    hashSubRoute === 'calls' ||
                    hashSubRoute === 'messages' ||
                    hashSubRoute === 'missed'
                      ? hashSubRoute
                      : 'overview'
                  }
                />
              )}
              {currentTab === 'leads' && <LeadManagementPanel onLeadCallTriggered={refreshAllData} />}
              {currentTab === 'appointments' && <AppointmentsPanel />}
              {currentTab === 'workflows' && <WorkflowsPanel />}
              {currentTab === 'intelligence' && <CallIntelligencePanel />}
              {currentTab === 'broadcast' && <VoiceBroadcastPanel />}
              {currentTab === 'knowledge' && <KnowledgeBasePanel />}
              {currentTab === 'integrations' && <IntegrationsPanel />}
              {currentTab === 'phone-numbers' && <PhoneNumbersPanel />}
              {currentTab === 'analytics' && <AnalyticsPanel />}
              {currentTab === 'billing' && (
                <FinancialLedgerPanel
                  tenant={tenant}
                  onBalanceUpdated={refreshAllData}
                  initialSubTab={
                    hashSubRoute === 'invoices' || hashSubRoute === 'billing_details'
                      ? hashSubRoute
                      : 'ledger'
                  }
                />
              )}
              {currentTab === 'settings' && (
                <SettingsPanel
                  initialTab={
                    hashSubRoute === 'account' ||
                    hashSubRoute === 'callers' ||
                    hashSubRoute === 'dnc' ||
                    hashSubRoute === 'credentials' ||
                    hashSubRoute === 'privacy'
                      ? hashSubRoute
                      : 'general'
                  }
                />
              )}
              {currentTab === 'developers' && (
                <DevelopersPanel
                  initialSubTab={
                    hashSubRoute === 'keys' ||
                    hashSubRoute === 'webhooks' ||
                    hashSubRoute === 'logs'
                      ? hashSubRoute
                      : 'overview'
                  }
                />
              )}
              {currentTab === 'support' && <SupportTicketsPanel />}
              {currentTab === 'staff-portal' && (
                <Suspense fallback={<div className="p-8 text-xs text-slate-500">Loading Staff Portal...</div>}>
                  <StaffPortal
                    hasStaffAccess={hasStaffAccess}
                    onExitToCustomer={() => setCurrentTab('overview')}
                  />
                </Suspense>
              )}
              {currentTab === 'super-admin' && (
                <Suspense fallback={<div className="p-8 text-xs text-slate-500">Loading Super Admin...</div>}>
                  <AdminPortal
                    isSuperAdmin={isSuperAdminUser}
                    onExitToCustomer={() => setCurrentTab('overview')}
                  />
                </Suspense>
              )}
            </div>
          </main>

          {/* Bottom-Right Floating Dock (Ask Trivaana + Setup Guide + Support) */}
          <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-5 z-30 flex flex-col items-end gap-2 pointer-events-none">
            {showSetupGuide && (
              <div className="pointer-events-auto w-72 bg-white rounded-2xl border border-[#e4e4e9] shadow-2xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-[#e4e4e9] pb-2">
                  <span className="font-bold text-[#0f0f14]">Setup guide ({completedSteps}/{setupSteps.length})</span>
                  <button onClick={() => setShowSetupGuide(false)} className="text-[#8a8a98] hover:text-[#0f0f14] cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {setupSteps.map((st, idx) => (
                  <SpringCheck
                    key={idx}
                    checked={st.done}
                    label={st.label}
                    onClick={() => {
                      setCurrentTab(st.tab);
                      setShowSetupGuide(false);
                    }}
                    className="w-full p-1.5 rounded-lg hover:bg-[#f6f6f8]"
                  />
                ))}
              </div>
            )}

            {showAssistantDrawer && (
              <div className="pointer-events-auto w-72 bg-[#121019] text-white rounded-2xl border border-slate-800 shadow-2xl p-4 text-xs space-y-2.5">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="font-bold flex items-center gap-1.5 text-[#ff8547]">
                    <Sparkles className="w-3.5 h-3.5" /> Ask Trivaana
                  </span>
                  <button onClick={() => setShowAssistantDrawer(false)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Start on <strong>Home</strong> to generate an AI Employee from plain English, attach Knowledge Base docs, test voice quality in Sandbox, and launch Instant or Bulk calling.
                </p>
                <Dock
                  className="!bg-[#1b1824] !border-slate-800 w-full justify-center"
                  items={[
                    {
                      label: 'Team',
                      icon: Bot,
                      onClick: () => {
                        setCurrentTab('agents');
                        setShowAssistantDrawer(false);
                      },
                    },
                    {
                      label: 'API',
                      icon: Code2,
                      onClick: () => {
                        setCurrentTab('developers');
                        setShowAssistantDrawer(false);
                      },
                    },
                    {
                      label: 'Sandbox',
                      icon: PhoneCall,
                      onClick: () => {
                        setIsSimulatorOpen(true);
                        setShowAssistantDrawer(false);
                      },
                    },
                  ]}
                />
              </div>
            )}

            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  setShowAssistantDrawer(!showAssistantDrawer);
                  setShowSetupGuide(false);
                }}
                aria-label="Ask Trivaana"
                className="px-2.5 sm:px-3 py-1.5 rounded-full bg-[#121019] hover:bg-[#1b1824] text-white text-[11px] sm:text-xs font-semibold shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#ff8547]" />
                <span className="hidden sm:inline">Ask Trivaana</span>
              </button>
              <button
                onClick={() => {
                  setShowSetupGuide(!showSetupGuide);
                  setShowAssistantDrawer(false);
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-full bg-white hover:bg-[#f6f6f8] border border-[#e4e4e9] text-[#0f0f14] text-[11px] sm:text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer tabular-nums"
              >
                <span>Setup ({completedSteps}/{setupSteps.length})</span>
                {showSetupGuide ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Guided Interactive Tour Modal */}
      {showTourModal && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => setShowTourModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full border border-[#e4e4e9] shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff5500]">
                Workspace Tour · Step {tourStep + 1} of {TOUR_STEPS.length}
              </span>
              <button onClick={() => setShowTourModal(false)} className="text-[#8a8a98] hover:text-[#0f0f14] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <Stepper
              steps={TOUR_STEPS.map((s) => ({ label: s.title }))}
              currentStep={tourStep}
              onStepClick={(idx) => {
                setTourStep(idx);
                setCurrentTab(TOUR_STEPS[idx].tab);
              }}
            />
            <h3 className="font-display text-lg font-extrabold text-[#0f0f14]">
              {TOUR_STEPS[tourStep].title}
            </h3>
            <p className="text-xs text-[#525260] leading-relaxed">{TOUR_STEPS[tourStep].body}</p>
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  setCurrentTab(TOUR_STEPS[tourStep].tab);
                  setShowTourModal(false);
                }}
                className="text-xs font-bold text-[#ff5500] hover:underline cursor-pointer"
              >
                Open this section →
              </button>
              <div className="flex gap-2">
                {tourStep > 0 && (
                  <button
                    onClick={() => setTourStep((s) => s - 1)}
                    className="px-3 py-1.5 rounded-xl border border-[#e4e4e9] text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                )}
                {tourStep < TOUR_STEPS.length - 1 ? (
                  <button
                    onClick={() => {
                      const next = tourStep + 1;
                      setTourStep(next);
                      setCurrentTab(TOUR_STEPS[next].tab);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-[#ff5500] hover:bg-[#ea580c] text-white text-xs font-bold cursor-pointer"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={() => setShowTourModal(false)}
                    className="px-4 py-1.5 rounded-xl bg-[#0f0f14] text-white text-xs font-bold cursor-pointer"
                  >
                    Finish Tour
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette (⌘K) */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-start justify-center pt-24 p-4 z-50"
          onClick={() => setShowCommandPalette(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full border border-[#e4e4e9] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-[#e4e4e9] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#8a8a98]" />
              <input
                autoFocus
                value={cmdSearch}
                onChange={(e) => setCmdSearch(e.target.value)}
                placeholder="Jump to any page or module..."
                className="flex-1 text-sm focus:outline-none text-[#0f0f14]"
              />
              <button
                onClick={() => setShowCommandPalette(false)}
                className="text-xs text-[#8a8a98] font-mono-code"
              >
                ESC
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {QUICK_JUMP_ITEMS.filter((it) =>
                `${it.label} ${it.keywords}`.toLowerCase().includes(cmdSearch.toLowerCase())
              ).map((it) => (
                <button
                  key={it.id}
                  onClick={() => {
                    setCurrentTab(it.id);
                    setShowCommandPalette(false);
                    setCmdSearch('');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#fff7ed] text-xs font-semibold text-[#0f0f14] flex justify-between items-center cursor-pointer"
                >
                  <span>{it.label}</span>
                  <span className="text-[10px] text-[#8a8a98]">Jump →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <LiveCallSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />

      <ReactBitsShowcaseModal
        isOpen={showUiStudio}
        onClose={() => setShowUiStudio(false)}
      />
    </div>
  );
};
