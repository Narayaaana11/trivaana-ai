import React from 'react';
import { LandingPage, type PublicRoute } from '@/components/landing/LandingPage';

interface PublicPortalProps {
  publicRoute: PublicRoute;
  onNavigatePublic: (route: PublicRoute) => void;
  onEnterDashboard: () => void;
  onStartFree?: () => void;
  onOpenSimulator: () => void;
  onSelectPreset: (preset: string) => void;
  onSelectPlan: (planId: string) => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = (props) => {
  return <LandingPage {...props} />;
};

