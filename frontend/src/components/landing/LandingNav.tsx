import React, { useState } from 'react';
import BRAND from '@/lib/brand';
import { TrivaanaLogo } from '@/components/brand/TrivaanaLogo';
import { Magnet } from '@/components/reactbits';
import { Zap, Play, Menu, X, ArrowRight } from 'lucide-react';

interface LandingNavProps {
  onEnterDashboard: () => void;
  onOpenSimulator: () => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({
  onEnterDashboard,
  onOpenSimulator,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Speed to Lead (<30s)', href: '#speed-to-lead' },
    { label: '7 Regional Voices', href: '#voices' },
    { label: 'Outpero Presets', href: '#presets' },
    { label: 'ROI Calculator', href: '#roi-calculator' },
    { label: 'Pricing Plans', href: '#pricing' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md transition-all shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Tagline */}
        <a href="/" className="flex items-center group cursor-pointer text-left">
          <TrivaanaLogo size={36} showText={true} subtitle="India's Most Natural Voice AI" />
        </a>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-600">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="hover:text-orange-600 transition-colors cursor-pointer"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={onOpenSimulator}
            className="px-3.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Play className="w-3.5 h-3.5 text-orange-600" />
            Live Simulator
          </button>

          <Magnet padding={40} magnetStrength={3}>
            <button
              onClick={onEnterDashboard}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm shadow-orange-600/25 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Mission Control</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </Magnet>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex sm:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3 shadow-lg">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-slate-700 hover:text-orange-600"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSimulator();
              }}
              className="w-full py-2.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 text-orange-600" />
              Live Dialpad Simulator
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onEnterDashboard();
              }}
              className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <Zap className="w-4 h-4" />
              Open Mission Control
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default LandingNav;
