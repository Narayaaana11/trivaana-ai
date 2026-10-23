import React from 'react';
import { TrivaanaLogo } from '@/components/brand/TrivaanaLogo';
import {
  LayoutDashboard,
  Zap,
  Users,
  PhoneForwarded,
  Bot,
  FileSpreadsheet,
  Wallet,
  ShieldCheck,
  PhoneCall,
  Sparkles,
  ArrowUpRight,
  LogOut,
} from 'lucide-react';
import { Tenant, AnalyticsStats } from '@/types/trivaana';

export type DashboardTab =
  | 'overview'
  | 'speed-to-lead'
  | 'leads'
  | 'campaigns'
  | 'agents'
  | 'intelligence'
  | 'billing';

interface AppSidebarProps {
  currentTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  tenant: Tenant | null;
  stats: AnalyticsStats | null;
  onOpenSimulator: () => void;
  onExitDashboard: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  tenant,
  stats,
  onOpenSimulator,
  onExitDashboard,
}) => {
  const NAV_ITEMS: { id: DashboardTab; label: string; icon: any; badge?: string }[] = [
    { id: 'overview', label: 'Mission Overview', icon: LayoutDashboard },
    { id: 'speed-to-lead', label: 'Speed to Lead (<30s)', icon: Zap, badge: 'High ROI' },
    { id: 'leads', label: 'OSM Scout & Leads', icon: Users },
    { id: 'campaigns', label: 'Campaign Dialer', icon: PhoneForwarded },
    { id: 'agents', label: 'Agent Studio', icon: Bot },
    { id: 'intelligence', label: 'Call Transcripts & WA', icon: FileSpreadsheet },
    { id: 'billing', label: 'Wallet & Invoices', icon: Wallet },
  ];

  return (
    <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col justify-between border-r border-slate-800/90 shrink-0 select-none">
      {/* Top Branding */}
      <div>
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <TrivaanaLogo size="sm" showTagline={false} />
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-950 text-orange-400 border border-orange-800/80 uppercase">
            v2.1
          </span>
        </div>

        {/* Live TRAI Status */}
        <div className="mx-4 my-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <div className="text-[11px] leading-tight">
              <span className="font-semibold text-slate-200 block">TRAI Calling Gate</span>
              <span className="text-slate-500 text-[10px]">10 AM - 6 PM IST</span>
            </div>
          </div>
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>

        {/* Navigation Tabs */}
        <nav className="px-3 space-y-1 mt-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-orange-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    isActive ? 'bg-orange-700 text-white' : 'bg-orange-950 text-orange-300 border border-orange-800/60'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions & Wallet */}
      <div className="p-4 border-t border-slate-800/80 space-y-3">
        {/* Wallet Balance Chip */}
        <div
          onClick={() => onSelectTab('billing')}
          className="p-3 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-orange-500/50 transition-colors cursor-pointer group"
        >
          <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
            <span>Prepaid Balance</span>
            <span className="text-[10px] text-orange-400 font-semibold group-hover:underline flex items-center gap-0.5">
              Top Up <ArrowUpRight className="w-2.5 h-2.5" />
            </span>
          </div>
          <div className="text-lg font-black text-white font-mono flex items-baseline gap-1">
            <span className="text-orange-500 text-sm">₹</span>
            <span>{(tenant?.wallet_balance ?? 5000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Rate: ₹{tenant?.rate_per_min ?? 3.60}/min</span>
            <span className="text-emerald-400">Zero Float Drift</span>
          </div>
        </div>

        {/* Live Simulator Button */}
        <button
          onClick={onOpenSimulator}
          className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <PhoneCall className="w-3.5 h-3.5 text-orange-400" />
          <span>Live Dialpad Tester</span>
        </button>

        {/* Back to Landing */}
        <button
          onClick={onExitDashboard}
          className="w-full py-2 px-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit to Public Site</span>
        </button>
      </div>
    </aside>
  );
};
