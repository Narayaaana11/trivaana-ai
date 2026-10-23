import React, { useState } from 'react';
import { LandingPage } from '@/components/landing/LandingPage';
import { MissionControl } from '@/components/dashboard/MissionControl';
import { LiveCallSimulatorModal } from '@/components/dashboard/LiveCallSimulatorModal';
import { DashboardTab } from '@/components/dashboard/AppSidebar';

export function App() {
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');
  const [initialDashboardTab, setInitialDashboardTab] = useState<DashboardTab>('overview');
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const handleEnterDashboard = (tab: DashboardTab = 'overview') => {
    setInitialDashboardTab(tab);
    setView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPreset = (presetName: string) => {
    setSelectedPreset(presetName);
    setInitialDashboardTab('agents');
    setView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPlan = (planId: string) => {
    setInitialDashboardTab('billing');
    setView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-orange-500 selection:text-white">
      {view === 'landing' ? (
        <LandingPage
          onEnterDashboard={() => handleEnterDashboard('overview')}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
          onSelectPreset={handleSelectPreset}
          onSelectPlan={handleSelectPlan}
        />
      ) : (
        <MissionControl
          onExitDashboard={() => {
            setView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          initialTab={initialDashboardTab}
          initialPreset={selectedPreset}
        />
      )}

      {/* Global Simulator Modal Accessible from Landing */}
      <LiveCallSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />
    </div>
  );
}

export default App;
