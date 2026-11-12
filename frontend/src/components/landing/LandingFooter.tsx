import React from 'react';
import { TrivaanaLogo } from '@/components/brand/TrivaanaLogo';
import { ShieldCheck } from 'lucide-react';
import BRAND from '@/lib/brand';
import type { PublicRoute } from './LandingPage';

interface LandingFooterProps {
  onEnterDashboard: () => void;
  onOpenSimulator: () => void;
  onNavigatePublic?: (route: PublicRoute) => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onEnterDashboard,
  onOpenSimulator,
  onNavigatePublic,
}) => {
  const goPublic = (route: PublicRoute) => {
    if (onNavigatePublic) {
      onNavigatePublic(route);
    } else if (route === 'voices') {
      document.getElementById('voices')?.scrollIntoView({ behavior: 'smooth' });
    } else if (route === 'pricing') {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[#121019] text-slate-400 border-t border-white/10 text-sm overflow-hidden">
      {/* Closing High-Contrast Outpero CTA Band */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10 border-b border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Your customers are already calling.
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Launch your first multilingual AI Employee in under 3 minutes — no per-seat contracts.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenSimulator}
            className="px-5 py-2.5 rounded-full bg-[#1b1824] hover:bg-[#242030] border border-white/15 text-white text-xs font-bold cursor-pointer"
          >
            Try Voice Sandbox
          </button>
          <button
            type="button"
            onClick={onEnterDashboard}
            className="px-6 py-2.5 rounded-full bg-[#ff5500] hover:bg-[#ea580c] text-white text-xs font-extrabold shadow-lg cursor-pointer"
          >
            Start free →
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <TrivaanaLogo size={34} showText={true} textColor="#ffffff" subtitle="India's Most Natural Voice AI" />
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              India&apos;s autonomous multilingual telecalling &amp; AI employee SaaS platform. Built for sub-30s instant speed-to-lead, 7 Indian languages, and deterministic billing.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">All Telephony Gateways Operational</span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="/product/instant-leads" onClick={(e) => { e.preventDefault(); goPublic('instant-leads'); }} className="hover:text-white transition-colors cursor-pointer">
                  Instant Leads (&lt;30s)
                </a>
              </li>
              <li>
                <a href="/product/campaigns" onClick={(e) => { e.preventDefault(); goPublic('campaigns'); }} className="hover:text-white transition-colors cursor-pointer">
                  Bulk Campaigns
                </a>
              </li>
              <li>
                <a href="/product/inbound" onClick={(e) => { e.preventDefault(); goPublic('inbound'); }} className="hover:text-white transition-colors cursor-pointer">
                  Incoming Calls (24×7)
                </a>
              </li>
              <li>
                <a href="/voices" onClick={(e) => { e.preventDefault(); goPublic('voices'); }} className="hover:text-white transition-colors cursor-pointer">
                  7 Indian Voices
                </a>
              </li>
              <li>
                <a href="/pricing" onClick={(e) => { e.preventDefault(); goPublic('pricing'); }} className="hover:text-white transition-colors cursor-pointer">
                  INR Pricing Estimator
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="/docs" onClick={(e) => { e.preventDefault(); goPublic('docs'); }} className="hover:text-white transition-colors cursor-pointer">
                  Docs &amp; Help Centre
                </a>
              </li>
              <li>
                <a href="/docs" onClick={(e) => { e.preventDefault(); goPublic('docs'); }} className="hover:text-white transition-colors cursor-pointer">
                  REST API &amp; Webhooks
                </a>
              </li>
              <li>
                <button type="button" onClick={onOpenSimulator} className="hover:text-white transition-colors cursor-pointer">
                  Live Voice Sandbox
                </button>
              </li>
              <li>
                <button type="button" onClick={onEnterDashboard} className="hover:text-white transition-colors cursor-pointer text-[#ff8547]">
                  Mission Control Login
                </button>
              </li>
            </ul>
          </div>

          {/* Languages */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Languages</h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center justify-between gap-2">
                <span>Telugu</span>
                <span className="text-[10px] text-[#ff8547] font-mono-code">te-IN</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Hindi</span>
                <span className="text-[10px] text-[#ff8547] font-mono-code">hi-IN</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Tamil</span>
                <span className="text-[10px] text-[#ff8547] font-mono-code">ta-IN</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Kannada</span>
                <span className="text-[10px] text-[#ff8547] font-mono-code">kn-IN</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>EN / ML / MR</span>
                <span className="text-[10px] text-[#ff8547] font-mono-code">+3</span>
              </li>
            </ul>
          </div>

          {/* Company & Compliance */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-2.5 text-xs mb-4">
              <li>
                <a href="/contact" onClick={(e) => { e.preventDefault(); goPublic('contact'); }} className="hover:text-white transition-colors cursor-pointer">
                  Contact Sales
                </a>
              </li>
              <li>
                <a href="mailto:founders@trivaana.ai" className="hover:text-white transition-colors">
                  founders@trivaana.ai
                </a>
              </li>
            </ul>
            <div className="p-3 rounded-xl bg-[#1b1824] border border-white/10">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs mb-1">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>TRAI TCCCPR</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                10 AM–6 PM IST guard, NDNC scrubbing &amp; 18% GST ITC ledger.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            © 2026 {BRAND.name}. All rights reserved. Built with precision for Indian enterprises.
          </div>
          <div className="flex items-center gap-6">
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePublic?.('terms');
              }}
              className="hover:text-white transition-colors"
            >
              Terms of Service
            </a>
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePublic?.('privacy');
              }}
              className="hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="/dnd-policy"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePublic?.('dnd-policy');
              }}
              className="hover:text-white transition-colors"
            >
              DND Policy
            </a>
            <span className="text-[#ff8547] font-medium">Made in India</span>
          </div>
        </div>
      </div>

      {/* Giant Translucent Edge-to-Edge Watermark (Outpero Footer Signature) */}
      <div
        aria-hidden="true"
        className="w-full select-none pointer-events-none text-center font-display font-black tracking-[0.06em] uppercase leading-[0.82] text-white/[0.04] text-[17vw] sm:text-[14vw] whitespace-nowrap -mb-3"
      >
        TRIVAANA
      </div>
    </footer>
  );
};
