import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { type PublicRoute } from '@/components/landing/LandingPage';
import { PublicPortal } from '@/apps/public/PublicPortal';
import { CustomerPortal } from '@/apps/customer/CustomerPortal';
import { AdminPortal } from '@/apps/admin/AdminPortal';
import { StaffPortal } from '@/apps/staff/StaffPortal';
import { LiveCallSimulatorModal } from '@/components/dashboard/LiveCallSimulatorModal';
import { AuthModal } from '@/components/auth/AuthModal';
import { DashboardTab } from '@/components/dashboard/AppSidebar';
import { trivaanaApi } from '@/lib/trivaana-api';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/stores/useAppStore';

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

function AppShell() {
  const navigate = useNavigate();
  const { user, setSession, reset } = useAppStore();

  const [view, setView] = useState<'landing' | 'dashboard'>(() => {
    if (
      typeof window !== 'undefined' &&
      trivaanaApi.isAuthenticated() &&
      (window.location.hash.startsWith('#/') || window.location.pathname.startsWith('/app'))
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

  useEffect(() => {
    if (trivaanaApi.isAuthenticated() && !user) {
      trivaanaApi
        .getMe()
        .then((me) => {
          setSession(me.user || me, me.tenant || null);
        })
        .catch(() => {
          // ignore if token expired
        });
    }
  }, [user, setSession]);

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
    trivaanaApi
      .getMe()
      .then((me) => setSession(me.user || me, me.tenant || null))
      .catch(() => {});
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

  const exitToLanding = () => {
    reset();
    setView('landing');
    setPublicRoute('home');
    try {
      window.history.replaceState(null, '', '/');
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isSuperAdmin = Boolean(user?.is_super_admin);
  const hasStaffAccess = Boolean(
    user?.is_super_admin ||
      (user?.staff_role && user.staff_role.length > 0)
  );

  const mainView =
    view === 'landing' ? (
      <PublicPortal
        publicRoute={publicRoute}
        onNavigatePublic={(route) => {
          setPublicRoute(route);
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
            // ignore
          }
        }}
        onEnterDashboard={() => handleEnterDashboard('overview')}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onSelectPreset={handleSelectPreset}
        onSelectPlan={handleSelectPlan}
      />
    ) : (
      <CustomerPortal
        onExitDashboard={exitToLanding}
        initialTab={initialDashboardTab}
        initialPreset={selectedPreset}
      />
    );

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-orange-500 selection:text-white">
      <Routes>
        <Route
          path="/admin/*"
          element={
            <AdminPortal
              isSuperAdmin={isSuperAdmin}
              onExitToCustomer={() => {
                setView('dashboard');
                navigate('/');
              }}
            />
          }
        />
        <Route
          path="/staff/*"
          element={
            <StaffPortal
              hasStaffAccess={hasStaffAccess}
              onExitToCustomer={() => {
                setView('dashboard');
                navigate('/');
              }}
            />
          }
        />
        <Route path="*" element={mainView} />
      </Routes>

      <LiveCallSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
