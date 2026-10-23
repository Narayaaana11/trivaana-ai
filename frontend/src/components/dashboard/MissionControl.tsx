import React, { useState, useEffect } from 'react';
import { AppSidebar, DashboardTab } from './AppSidebar';
import { OverviewPanel } from './OverviewPanel';
import { SpeedToLeadPanel } from './SpeedToLeadPanel';
import { LeadManagementPanel } from './LeadManagementPanel';
import { CampaignManagerPanel } from './CampaignManagerPanel';
import { AgentStudioPanel } from './AgentStudioPanel';
import { CallIntelligencePanel } from './CallIntelligencePanel';
import { FinancialLedgerPanel } from './FinancialLedgerPanel';
import { LiveCallSimulatorModal } from './LiveCallSimulatorModal';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Tenant, AnalyticsStats, CallLog } from '@/types/trivaana';
import { Bell, ShieldCheck, User } from 'lucide-react';

interface MissionControlProps {
  onExitDashboard: () => void;
  initialTab?: DashboardTab;
  initialPreset?: string;
}

export const MissionControl: React.FC<MissionControlProps> = ({
  onExitDashboard,
  initialTab = 'overview',
  initialPreset,
}) => {
  const [currentTab, setCurrentTab] = useState<DashboardTab>(initialTab);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const refreshAllData = async () => {
    try {
      const [tData, sData, cData] = await Promise.all([
        trivaanaApi.getTenant(),
        trivaanaApi.getStats(),
        trivaanaApi.getCalls(),
      ]);
      setTenant(tData);
      setStats(sData);
      setCalls(cData.calls);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  return (
    <div className="flex h-screen bg-slate-100/80 font-sans text-slate-900 overflow-hidden select-none">
      {/* Left Application Sidebar */}
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        tenant={tenant}
        stats={stats}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onExitDashboard={onExitDashboard}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Subtle Ambient Dashboard Backdrop */}
        <BackgroundPattern variant="dashboard">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 relative z-10 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tenant:
              </span>
              <span className="text-sm font-extrabold text-slate-900">
                {tenant?.name || 'Trivaana Enterprise Suite'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                {tenant?.plan || 'Growth'} Plan
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>TRAI Gate Active</span>
              </div>

              <div className="h-4 w-px bg-slate-200"></div>

              {/* User Avatar */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  TR
                </div>
                <span className="text-xs font-bold text-slate-800 hidden md:inline">
                  Admin
                </span>
              </div>
            </div>
          </header>

          {/* Active Panel Scroll Container */}
          <main className="flex-1 overflow-y-auto p-6 relative z-10">
            <div className="max-w-7xl mx-auto pb-12">
              {currentTab === 'overview' && (
                <OverviewPanel
                  stats={stats}
                  tenant={tenant}
                  calls={calls}
                  onNavigateTab={setCurrentTab}
                  onOpenSimulator={() => setIsSimulatorOpen(true)}
                />
              )}

              {currentTab === 'speed-to-lead' && (
                <SpeedToLeadPanel
                  onCallCompleted={refreshAllData}
                />
              )}

              {currentTab === 'leads' && (
                <LeadManagementPanel
                  onLeadCallTriggered={refreshAllData}
                />
              )}

              {currentTab === 'campaigns' && (
                <CampaignManagerPanel
                  onCampaignUpdated={refreshAllData}
                />
              )}

              {currentTab === 'agents' && (
                <AgentStudioPanel
                  initialPreset={initialPreset}
                />
              )}

              {currentTab === 'intelligence' && (
                <CallIntelligencePanel />
              )}

              {currentTab === 'billing' && (
                <FinancialLedgerPanel
                  tenant={tenant}
                  onBalanceUpdated={refreshAllData}
                />
              )}
            </div>
          </main>
        </BackgroundPattern>
      </div>

      {/* Live Dialpad Simulator Modal */}
      <LiveCallSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />
    </div>
  );
};
