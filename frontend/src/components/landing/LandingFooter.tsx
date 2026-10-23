import React from 'react';
import { TrivaanaLogo } from '@/components/brand/TrivaanaLogo';
import { ShieldCheck, PhoneCall, Heart, ExternalLink } from 'lucide-react';
import BRAND from '@/lib/brand';

interface LandingFooterProps {
  onEnterDashboard: () => void;
  onOpenSimulator: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onEnterDashboard,
  onOpenSimulator,
}) => {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <TrivaanaLogo size="md" showTagline={true} />
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              India's premier autonomous multilingual telecalling SaaS platform. Engineered for speed-to-lead under 30 seconds, 7 regional dialects, and 85% operational cost reduction.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-emerald-400 font-medium">All Telephony Gateways Operational</span>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={onOpenSimulator} className="hover:text-white transition-colors cursor-pointer">
                  Dialect Speech Tester
                </button>
              </li>
              <li>
                <a href="#verticals" className="hover:text-white transition-colors">
                  Outpero Industry Presets
                </a>
              </li>
              <li>
                <a href="#roi-calculator" className="hover:text-white transition-colors">
                  Telecalling ROI Calculator
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  INR Pricing & Plans
                </a>
              </li>
              <li>
                <button onClick={onEnterDashboard} className="hover:text-white transition-colors cursor-pointer text-orange-400">
                  Mission Control Dashboard
                </button>
              </li>
            </ul>
          </div>

          {/* Dialects */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Supported Languages</h4>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center justify-between">
                <span>Telugu (తెలుగు)</span>
                <span className="text-[10px] text-orange-400 font-mono">te-IN</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Hindi (हिन्दी)</span>
                <span className="text-[10px] text-orange-400 font-mono">hi-IN</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Indian English</span>
                <span className="text-[10px] text-orange-400 font-mono">en-IN</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Tamil (தமிழ்)</span>
                <span className="text-[10px] text-orange-400 font-mono">ta-IN</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Kannada (ಕನ್ನಡ)</span>
                <span className="text-[10px] text-orange-400 font-mono">kn-IN</span>
              </li>
            </ul>
          </div>

          {/* Compliance & Legal */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Regulatory Compliance</h4>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>TRAI Enforcement</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Automatic calling suppression outside 10:00 AM - 6:00 PM IST. NDNC Registry scrubbing included.
                </p>
              </div>
              <div className="text-[11px] text-slate-400">
                Registered under Indian Ministry of Corporate Affairs. 18% GST Invoicing with ITC eligibility.
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved. Built with precision for Indian enterprises.
          </div>
          <div className="flex items-center gap-6">
            <span>Terms of Service</span>
            <span>Privacy Policy</span>
            <span>DND Policy</span>
            <span className="text-orange-400 font-medium">Made in India</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
