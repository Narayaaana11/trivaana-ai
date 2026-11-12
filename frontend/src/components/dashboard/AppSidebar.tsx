import React, { useState } from 'react';
import { TrivaanaLogo } from '@/components/brand/TrivaanaLogo';
import { StatusMark, WarmTooltip } from '@/components/reactbits';
import {
  LayoutDashboard,
  Users,
  PhoneForwarded,
  Bot,
  MessageSquareText,
  Wallet,
  ShieldCheck,
  PhoneCall,
  ArrowUpRight,
  LogOut,
  Megaphone,
  BookOpen,
  Plug,
  Hash,
  BarChart3,
  Settings,
  ShieldAlert,
  Zap,
  PhoneIncoming,
  Code2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarClock,
  Workflow,
  LifeBuoy,
  Headphones,
} from 'lucide-react';
import { Tenant, AnalyticsStats } from '@/types/trivaana';

export type DashboardTab =
  | 'overview'
  | 'agents'
  | 'campaigns'
  | 'instant-leads'
  | 'inbound'
  | 'leads'
  | 'appointments'
  | 'workflows'
  | 'intelligence'
  | 'broadcast'
  | 'knowledge'
  | 'integrations'
  | 'phone-numbers'
  | 'analytics'
  | 'billing'
  | 'settings'
  | 'developers'
  | 'support'
  | 'staff-portal'
  | 'super-admin';

interface AppSidebarProps {
  currentTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  tenant: Tenant | null;
  stats: AnalyticsStats | null;
  isSuperAdmin?: boolean;
  hasStaffAccess?: boolean;
  onOpenSimulator: () => void;
  onExitDashboard: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  theme?: 'light' | 'dark';
}

interface NavGroup {
  title?: string;
  items: { id: DashboardTab; label: string; icon: any; badge?: string }[];
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  tenant,
  isSuperAdmin = false,
  hasStaffAccess = false,
  onOpenSimulator,
  onExitDashboard,
  mobileOpen = false,
  onCloseMobile,
  theme = 'light',
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const isDark = theme === 'dark';

  const GROUPS: NavGroup[] = [
    {
      items: [{ id: 'overview', label: 'Home', icon: LayoutDashboard }],
    },
    {
      title: 'AI EMPLOYEES',
      items: [{ id: 'agents', label: 'Your team', icon: Bot }],
    },
    {
      title: 'RESULTS',
      items: [
        { id: 'leads', label: 'Leads', icon: Users },
        { id: 'appointments', label: 'Appointments', icon: CalendarClock },
        { id: 'intelligence', label: 'Conversations', icon: MessageSquareText },
        { id: 'analytics', label: 'Performance', icon: BarChart3 },
      ],
    },
    {
      title: 'CALLING',
      items: [
        { id: 'campaigns', label: 'Campaigns', icon: PhoneForwarded },
        { id: 'instant-leads', label: 'Instant leads', icon: Zap },
        { id: 'inbound', label: 'Incoming calls', icon: PhoneIncoming },
        { id: 'broadcast', label: 'Voice broadcast', icon: Megaphone },
        { id: 'workflows', label: 'Workflows', icon: Workflow },
      ],
    },
    {
      title: 'WORKSPACE',
      items: [
        { id: 'knowledge', label: 'Knowledge base', icon: BookOpen },
        { id: 'integrations', label: 'Integrations', icon: Plug },
        { id: 'phone-numbers', label: 'Numbers & channels', icon: Hash },
        { id: 'billing', label: 'Credits & billing', icon: Wallet },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'developers', label: 'Developers', icon: Code2 },
        { id: 'support', label: 'Support', icon: LifeBuoy },
      ],
    },
  ];

  if (isSuperAdmin || hasStaffAccess) {
    const platformItems: { id: DashboardTab; label: string; icon: any; badge?: string }[] = [
      { id: 'staff-portal', label: 'Staff Portal', icon: Headphones },
    ];
    if (isSuperAdmin) {
      platformItems.push({ id: 'super-admin', label: 'Super Admin', icon: ShieldAlert, badge: 'Admin' });
    }
    GROUPS.push({
      title: 'PLATFORM',
      items: platformItems,
    });
  }

  const handleNav = (id: DashboardTab) => {
    onSelectTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const balance = tenant?.wallet_balance ?? 0;
  const rate = tenant?.rate_per_min ?? 6.5;
  const estMins = Math.max(0, Math.floor(balance / Math.max(rate, 1)));

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/45 backdrop-blur-[1px] z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:static ${
          collapsed ? 'w-[68px]' : 'w-[240px]'
        } ${
          isDark
            ? 'bg-[#11121a] text-[#a1a1b2] border-r border-[#252838]'
            : 'bg-[#f6f6f8] text-[#525260] border-r border-[#e4e4e9]/80'
        } flex flex-col justify-between shrink-0 select-none transition-all duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex-1 overflow-y-auto">
          {/* Top Brand Header */}
          <div className="px-3.5 py-3 flex items-center justify-between">
            {!collapsed && (
              <TrivaanaLogo
                size="sm"
                showTagline={false}
                textColor={isDark ? '#f4f4f7' : '#0f0f14'}
                subtitle=""
              />
            )}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className={`hidden lg:inline-flex p-1.5 rounded-lg cursor-pointer transition-colors ${
                  isDark
                    ? 'text-[#a1a1b2] hover:text-white hover:bg-[#222536]'
                    : 'text-[#6e6e7e] hover:text-[#0f0f14] hover:bg-[#ebebf0]'
                }`}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="lg:hidden p-1.5 rounded-lg text-[#6e6e7e] hover:text-[#0f0f14]"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {!collapsed && (
            <div
              className={`mx-3 mb-2.5 px-2.5 py-2 rounded-xl border flex items-center justify-between ${
                isDark
                  ? 'bg-[#181a27] border-[#252838]'
                  : 'bg-white border-[#e4e4e9]'
              }`}
            >
              <div className="flex items-center gap-2">
                <StatusMark status="online" />
                <div className="text-[11px] leading-tight">
                  <span className={`font-semibold block ${isDark ? 'text-white' : 'text-[#0f0f14]'}`}>
                    TRAI TCCCPR Gate
                  </span>
                  <span className="text-[#8a8a98] text-[10px]">10 AM - 6 PM IST</span>
                </div>
              </div>
              <WarmTooltip tip="Active 10 AM - 6 PM IST suppression guard">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              </WarmTooltip>
            </div>
          )}

          {/* Grouped Outpero Navigation */}
          <nav className="px-2.5 space-y-3 pb-4 pt-0.5">
            {GROUPS.map((group, gIdx) => (
              <div key={gIdx} className="space-y-0.5">
                {group.title && !collapsed && (
                  <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold tracking-[0.07em] text-[#8a8a98] uppercase">
                    {group.title}
                  </div>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center ${
                        collapsed ? 'justify-center px-2' : 'justify-between px-2.5'
                      } py-2 rounded-[10px] text-[13px] transition-all cursor-pointer ${
                        isActive
                          ? isDark
                            ? 'bg-[#222536] text-white font-semibold border border-[#32364c] shadow-2xs'
                            : 'bg-[#ebebf0] text-[#0f0f14] font-semibold shadow-2xs'
                          : isDark
                          ? 'text-[#a1a1b2] hover:text-white hover:bg-[#1a1c29] font-medium'
                          : 'text-[#525260] hover:text-[#0f0f14] hover:bg-[#ebebf0]/60 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive
                              ? 'text-[#ff5500]'
                              : isDark
                              ? 'text-[#7b7c8e]'
                              : 'text-[#6e6e7e]'
                          }`}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!collapsed && item.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${
                            isDark
                              ? 'bg-[#151722] text-[#ff8547] border-[#2d3045]'
                              : 'bg-white text-[#c2410c] border-[#e4e4e9]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Credits Meter & Quick Actions */}
        <div
          className={`p-3 border-t space-y-2 ${
            isDark ? 'border-[#252838]' : 'border-[#e4e4e9]'
          }`}
        >
          {!collapsed && (
            <div
              onClick={() => handleNav('billing')}
              className={`p-3 rounded-xl border transition-colors cursor-pointer group ${
                isDark
                  ? 'bg-[#181a27] border-[#252838] hover:border-[#ff5500]/60'
                  : 'bg-white border-[#e4e4e9] hover:border-[#ff5500]/60 shadow-2xs'
              }`}
            >
              <div className="flex justify-between items-center text-[10px] text-[#8a8a98] uppercase tracking-wider mb-1 font-semibold">
                <span>Credits</span>
                <span className="text-[#ff5500] font-semibold group-hover:underline flex items-center gap-0.5 normal-case">
                  Add credits <ArrowUpRight className="w-2.5 h-2.5" />
                </span>
              </div>
              <div
                className={`text-lg font-extrabold tabular-nums flex items-baseline gap-0.5 ${
                  isDark ? 'text-white' : 'text-[#0f0f14]'
                }`}
              >
                <span className="text-[#ff5500] text-sm">₹</span>
                <span>{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="text-[11px] text-[#6e6e7e] mt-0.5 flex items-center justify-between tabular-nums">
                <span>~{estMins} min of calls</span>
                <span>₹{rate.toFixed(2)}/m</span>
              </div>
            </div>
          )}

          <button
            onClick={onOpenSimulator}
            title="AI Voice Sandbox"
            className={`w-full py-2 px-2.5 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#181a27] hover:bg-[#222536] border-[#2a2e42] text-white'
                : 'bg-white hover:bg-[#ebebf0]/70 border-[#e4e4e9] text-[#0f0f14] shadow-2xs'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 text-[#ff5500] shrink-0" />
            {!collapsed && <span>AI Voice Sandbox</span>}
          </button>

          <button
            onClick={onExitDashboard}
            title="Public Site"
            className={`w-full py-1.5 px-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isDark
                ? 'text-[#a1a1b2] hover:text-white hover:bg-[#1a1c29]'
                : 'text-[#6e6e7e] hover:text-[#0f0f14] hover:bg-[#ebebf0]'
            }`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>Public Site</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
