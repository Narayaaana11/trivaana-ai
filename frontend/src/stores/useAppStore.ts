import { create } from 'zustand';
import { Tenant, AnalyticsStats } from '@/types/trivaana';

export interface UserSessionProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  staff_role?: string | null;
  is_super_admin: boolean;
}

interface AppStoreState {
  user: UserSessionProfile | null;
  tenant: Tenant | null;
  stats: AnalyticsStats | null;
  theme: 'light' | 'dark';
  setSession: (user: UserSessionProfile | null, tenant: Tenant | null) => void;
  setStats: (stats: AnalyticsStats | null) => void;
  toggleTheme: () => void;
  reset: () => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  user: null,
  tenant: null,
  stats: null,
  theme: 'light',
  setSession: (user, tenant) => set({ user, tenant }),
  setStats: (stats) => set({ stats }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  reset: () => set({ user: null, tenant: null, stats: null }),
}));

