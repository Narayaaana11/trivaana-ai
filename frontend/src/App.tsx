import React, { useState } from 'react';
import { LandingPage, type PublicRoute } from '@/components/landing/LandingPage';
import { MissionControl } from '@/components/dashboard/MissionControl';
import { LiveCallSimulatorModal } from '@/components/dashboard/LiveCallSimulatorModal';
import { AuthModal } from '@/components/auth/AuthModal';
import { DashboardTab } from '@/components/dashboard/AppSidebar';
import { trivaanaApi } from '@/lib/trivaana-api';

function resolveInitialPublicRoute(): PublicRoute {
  if (typeof window === 'undefined') return 'home';
  const p = window.location.pathname.toLowerCase();
  if (p.includes('/voices')) return 'voices';
  if (p.includes('/pricing')) return 'pricing';
  if (p.includes('/product/instant-leads')) return 'instant-leads';
  if (p.includes('/product/campaigns')) return 'campaigns';
  if (p.includes('/product/inbound')) return 'inbound';
  if (p.includes('/contact')) return 'contact';
  if (p.includes('/docs')) return 'docs';
  return 'home';
}

export function App() {
  const [view, setView] = useState<'landing' | 'dashboard'>(() => {
    if (
      typeof window !== 'undefined' &&
      trivaanaApi.isAuthenticated() &&
      window.location.hash.startsWith('#/')
    ) {
      return 'dashboard';
    }
    return 'landing';
  });
  const [publicRoute, setPublicRoute] = useState<PublicRoute>(resolveInitialPublicRoute);
  const [initialDashboardTab, setInitialDashboardTab] = useState<DashboardTab>('overview');
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<DashboardTab>('overview');

  const handleEnterDashboard = (tab: DashboardTab = 'overview') => {
    if (!trivaanaApi.isAuthenticated()) {
      setPendingTab(tab);
      setIsAuthModalOpen(true);
      return;
    }
    setInitialDashboardTab(tab);
    setView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = () => {
    setInitialDashboardTab(pendingTab);
    setView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPreset = (presetName: string) => {
    setSelectedPreset(presetName);
    handleEnterDashboard('agents');
  };

  const handleSelectPlan = (_planId: string) => {
    handleEnterDashboard('billing');
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-orange-500 selection:text-white">
      {view === 'landing' ? (
        <LandingPage
          publicRoute={publicRoute}
          onNavigatePublic={(route) => {
            setPublicRoute(route);
            if (typeof window !== 'undefined') {
              const routePathMap: Record<PublicRoute, string> = {
                home: '/',
                voices: '/voices',
                pricing: '/pricing',
                'instant-leads': '/product/instant-leads',
                campaigns: '/product/campaigns',
                inbound: '/product/inbound',
                contact: '/contact',
                docs: '/docs',
              };
              try {
                window.history.replaceState(null, '', routePathMap[route] || '/');
              } catch {
                // ignore history restrictions in non-browser test runners
              }
            }
          }}
          onEnterDashboard={() => handleEnterDashboard('overview')}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
          onSelectPreset={handleSelectPreset}
          onSelectPlan={handleSelectPlan}
        />
      ) : (
        <MissionControl
          onExitDashboard={() => {
            setView('landing');
            setPublicRoute('home');
            if (typeof window !== 'undefined') {
              try {
                window.history.replaceState(null, '', '/');
              } catch {
                // ignore
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
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

      {/* Real Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;
