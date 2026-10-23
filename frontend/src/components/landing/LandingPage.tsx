import React from 'react';
import { LandingNav } from './LandingNav';
import { HeroSection } from './HeroSection';
import { VerticalPresetsSection } from './VerticalPresetsSection';
import { RoiCalculatorSection } from './RoiCalculatorSection';
import { PricingSection } from './PricingSection';
import { LandingFooter } from './LandingFooter';

interface LandingPageProps {
  onEnterDashboard: () => void;
  onOpenSimulator: () => void;
  onSelectPreset?: (presetName: string) => void;
  onSelectPlan?: (planId: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterDashboard,
  onOpenSimulator,
  onSelectPreset,
  onSelectPlan,
}) => {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navbar */}
      <LandingNav
        onEnterDashboard={onEnterDashboard}
        onOpenSimulator={onOpenSimulator}
      />

      <main className="flex-1">
        {/* Hero Section */}
        <HeroSection
          onEnterDashboard={onEnterDashboard}
          onOpenSimulator={onOpenSimulator}
        />

        {/* 5 Industry Presets Section */}
        <VerticalPresetsSection
          onEnterDashboard={onEnterDashboard}
          onSelectPreset={onSelectPreset}
        />

        {/* Interactive ROI Calculator Section */}
        <RoiCalculatorSection
          onEnterDashboard={onEnterDashboard}
        />

        {/* Transparent Commercial Pricing Section */}
        <PricingSection
          onEnterDashboard={onEnterDashboard}
          onSelectPlan={onSelectPlan}
        />
      </main>

      {/* Footer */}
      <LandingFooter
        onEnterDashboard={onEnterDashboard}
        onOpenSimulator={onOpenSimulator}
      />
    </div>
  );
};
