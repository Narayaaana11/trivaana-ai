import React, { useState } from 'react';
import { LandingNav } from './LandingNav';
import { HeroSection } from './HeroSection';
import { HowItWorksSection } from './HowItWorksSection';
import { VoiceShowcaseSection } from './VoiceShowcaseSection';
import { PlatformModesSection } from './PlatformModesSection';
import { VerticalPresetsSection } from './VerticalPresetsSection';
import { RoiCalculatorSection } from './RoiCalculatorSection';
import { PricingSection } from './PricingSection';
import { LandingFooter } from './LandingFooter';
import {
  PublicVoicesPage,
  PublicPricingPage,
  PublicProductPage,
  PublicContactPage,
} from './PublicPages';
import { DocsPortalPage } from './DocsPortalPage';
import { PublicLegalPage } from './LegalPages';

export type PublicRoute =
  | 'home'
  | 'voices'
  | 'pricing'
  | 'instant-leads'
  | 'campaigns'
  | 'inbound'
  | 'contact'
  | 'docs'
  | 'terms'
  | 'privacy'
  | 'dnd-policy';

interface LandingPageProps {
  onEnterDashboard: () => void;
  onOpenSimulator: () => void;
  onSelectPreset?: (presetName: string) => void;
  onSelectPlan?: (planId: string) => void;
  publicRoute?: PublicRoute;
  onNavigatePublic?: (route: PublicRoute) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterDashboard,
  onOpenSimulator,
  onSelectPreset,
  onSelectPlan,
  publicRoute,
  onNavigatePublic,
}) => {
  const [internalRoute, setInternalRoute] = useState<PublicRoute>('home');
  const activeRoute = publicRoute ?? internalRoute;

  const navigateRoute = (route: PublicRoute) => {
    setInternalRoute(route);
    onNavigatePublic?.(route);
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (activeRoute === 'docs') {
    return (
      <DocsPortalPage
        onBackToSite={() => navigateRoute('home')}
        onEnterDashboard={onEnterDashboard}
        onNavigateContact={() => navigateRoute('contact')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-[#0f0f14] flex flex-col selection:bg-[#ff5500] selection:text-white">
      <LandingNav
        onEnterDashboard={onEnterDashboard}
        onOpenSimulator={onOpenSimulator}
        activeRoute={activeRoute}
        onNavigatePublic={navigateRoute}
      />

      <main className="flex-1">
        {activeRoute === 'home' && (
          <>
            <HeroSection
              onEnterDashboard={onEnterDashboard}
              onOpenSimulator={onOpenSimulator}
            />

            <HowItWorksSection onEnterDashboard={onEnterDashboard} />

            <VoiceShowcaseSection onEnterDashboard={onEnterDashboard} />

            <PlatformModesSection onEnterDashboard={onEnterDashboard} />

            <div id="presets">
              <VerticalPresetsSection
                onEnterDashboard={onEnterDashboard}
                onSelectPreset={onSelectPreset}
              />
            </div>

            <RoiCalculatorSection onEnterDashboard={onEnterDashboard} />

            <PricingSection
              onEnterDashboard={onEnterDashboard}
              onSelectPlan={onSelectPlan}
            />
          </>
        )}

        {activeRoute === 'voices' && (
          <PublicVoicesPage
            onEnterDashboard={onEnterDashboard}
            onOpenDocs={() => navigateRoute('docs')}
          />
        )}

        {activeRoute === 'pricing' && (
          <PublicPricingPage
            onEnterDashboard={onEnterDashboard}
            onOpenDocs={() => navigateRoute('docs')}
          />
        )}

        {(activeRoute === 'instant-leads' ||
          activeRoute === 'campaigns' ||
          activeRoute === 'inbound') && (
          <PublicProductPage
            product={activeRoute}
            onEnterDashboard={onEnterDashboard}
            onOpenDocs={() => navigateRoute('docs')}
          />
        )}

        {activeRoute === 'contact' && (
          <PublicContactPage onEnterDashboard={onEnterDashboard} />
        )}

        {(activeRoute === 'terms' ||
          activeRoute === 'privacy' ||
          activeRoute === 'dnd-policy') && (
          <PublicLegalPage
            docType={activeRoute}
            onNavigateLegal={(doc) => navigateRoute(doc)}
            onBackHome={() => navigateRoute('home')}
            onNavigateContact={() => navigateRoute('contact')}
          />
        )}
      </main>

      <LandingFooter
        onEnterDashboard={onEnterDashboard}
        onOpenSimulator={onOpenSimulator}
        onNavigatePublic={navigateRoute}
      />
    </div>
  );
};
