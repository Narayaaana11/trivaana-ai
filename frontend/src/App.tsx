import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { type PublicRoute } from '@/components/landing/LandingPage';
import { PublicPortal } from '@/apps/public/PublicPortal';
import { LiveCallSimulatorModal } from '@/components/dashboard/LiveCallSimulatorModal';
import { AuthModal } from '@/components/auth/AuthModal';
import { DashboardTab } from '@/components/dashboard/AppSidebar';
import { trivaanaApi } from '@/lib/trivaana-api';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/stores/useAppStore';

const CustomerPortal = lazy(() =>
  import('@/apps/customer/CustomerPortal').then((m) => ({ default: m.CustomerPortal }))
);
const AdminPortal = lazy(() =>
  import('@/apps/admin/AdminPortal').then((m) => ({ default: m.AdminPortal }))
);
const StaffPortal = lazy(() =>
  import('@/apps/staff/StaffPortal').then((m) => ({ default: m.StaffPortal }))
);

function AcceptInviteRoute({ onAccepted }: { onAccepted: () => void }) {
  const [params] = useSearchParams();
  const [inviteToken, setInviteToken] = useState(params.get('token') || '');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await trivaanaApi.acceptWorkspaceInvite({
              invite_token: inviteToken.trim(),
              full_name: fullName.trim(),
              password,
            });
            onAccepted();
          } catch (error: any) {
            setErr(error.message || 'Unable to accept invitation.');
          } finally {
            setBusy(false);
          }
        }}
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-7 space-y-4 shadow-sm text-xs"
      >
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Team Invitation</span>
          <h1 className="font-display text-2xl font-extrabold text-slate-900 mt-1">Accept Workspace Invitation</h1>
          <p className="text-slate-500 mt-1">Create your password to join the invited Trivaana AI workspace.</p>
        </div>
        {err && <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold">{err}</div>}
        <input
          required
          placeholder="Invitation Token"
          value={inviteToken}
          onChange={(e) => setInviteToken(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono"
        />
        <input
          required
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
        />
        <input
          required
          type="password"
          minLength={6}
          placeholder="Create a strong password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold cursor-pointer disabled:opacity-50"
        >
          {busy ? 'Joining...' : 'Join Workspace'}
        </button>
      </form>
    </div>
  );
}

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
  if (p.includes('/terms')) return 'terms';
  if (p.includes('/privacy')) return 'privacy';
  if (p.includes('/dnd-policy')) return 'dnd-policy';
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

  const handleSelectPlan = (planId: string) => {
    try {
      if (planId) sessionStorage.setItem('trivaana_selected_plan', planId);
    } catch {
      // ignore
    }
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
            terms: '/terms',
            privacy: '/privacy',
            'dnd-policy': '/dnd-policy',
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
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-500">Loading workspace...</div>}>
        <Routes>
          <Route
            path="/accept-invite"
            element={
              <AcceptInviteRoute
                onAccepted={() => {
                  handleAuthSuccess();
                  setView('dashboard');
                  navigate('/');
                }}
              />
            }
          />
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
      </Suspense>

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
