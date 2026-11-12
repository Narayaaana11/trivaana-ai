import React, { useState } from 'react';
import { TrivaanaLogo } from '@/components/brand/TrivaanaLogo';
import { Magnet } from '@/components/reactbits';
import { DropdownPanel } from '@/components/ui';
import { Play, Menu, X, ArrowRight, ChevronDown, Zap, PhoneForwarded, PhoneIncoming, BookOpen } from 'lucide-react';
import type { PublicRoute } from './LandingPage';

interface LandingNavProps {
  onEnterDashboard: () => void;
  onStartFree?: () => void;
  onOpenSimulator: () => void;
  activeRoute?: PublicRoute;
  onNavigatePublic?: (route: PublicRoute) => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({
  onEnterDashboard,
  onStartFree,
  onOpenSimulator,
  activeRoute = 'home',
  onNavigatePublic,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  const navRoutes: { label: string; route: PublicRoute; href: string }[] = [
    { label: 'Voices', route: 'voices', href: '/voices' },
    { label: 'Pricing', route: 'pricing', href: '/pricing' },
    { label: 'Docs', route: 'docs', href: '/docs' },
    { label: 'Contact', route: 'contact', href: '/contact' },
  ];

  const handleRouteClick = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    route: PublicRoute
  ) => {
    if (onNavigatePublic) {
      e.preventDefault();
      onNavigatePublic(route);
    }
    setProductOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#e4e4e9]/90 bg-[#fcfcfd]/90 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
        <a
          href="/"
          onClick={(e) => handleRouteClick(e, 'home')}
          className="flex items-center group cursor-pointer text-left shrink-0"
        >
          <TrivaanaLogo size={34} showText={true} textColor="#0f0f14" subtitle="India's Most Natural Voice AI" />
        </a>

        {/* Desktop Centered Navigation Matching Outpero */}
        <nav className="hidden lg:flex items-center gap-6 text-[13px] font-medium text-[#525260]">
          <div
            className="relative"
            onMouseEnter={() => setProductOpen(true)}
            onMouseLeave={() => setProductOpen(false)}
          >
            <button
              type="button"
              aria-expanded={productOpen}
              aria-haspopup="menu"
              onClick={() => setProductOpen((v) => !v)}
              className={`inline-flex items-center gap-1 hover:text-[#0f0f14] transition-colors cursor-pointer py-2 ${
                activeRoute === 'instant-leads' || activeRoute === 'campaigns' || activeRoute === 'inbound'
                  ? 'text-[#0f0f14] font-semibold'
                  : ''
              }`}
            >
              <span>Product</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#8a8a98] transition-transform duration-200 ${productOpen ? 'rotate-180' : ''}`} />
            </button>
            <DropdownPanel
              open={productOpen}
              onClose={() => setProductOpen(false)}
              align="left"
              widthClass="w-72"
              className="mt-0.5 space-y-1 shadow-xl"
            >
              <a
                href="/product/instant-leads"
                onClick={(e) => handleRouteClick(e, 'instant-leads')}
                className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[#f6f6f8] transition-colors"
              >
                <Zap className="w-4 h-4 text-[#ff5500] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#0f0f14]">Instant Leads (&lt;30s)</div>
                  <div className="text-[11px] text-[#6e6e7e]">13 lead connectors &amp; sub-30s callback</div>
                </div>
              </a>
              <a
                href="/product/campaigns"
                onClick={(e) => handleRouteClick(e, 'campaigns')}
                className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[#f6f6f8] transition-colors"
              >
                <PhoneForwarded className="w-4 h-4 text-[#ff5500] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#0f0f14]">Bulk Campaigns</div>
                  <div className="text-[11px] text-[#6e6e7e]">Parallel CSV dialing &amp; outcome tagging</div>
                </div>
              </a>
              <a
                href="/product/inbound"
                onClick={(e) => handleRouteClick(e, 'inbound')}
                className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[#f6f6f8] transition-colors"
              >
                <PhoneIncoming className="w-4 h-4 text-[#ff5500] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#0f0f14]">24×7 Incoming Calls</div>
                  <div className="text-[11px] text-[#6e6e7e]">AI reception, bookings &amp; warm transfer</div>
                </div>
              </a>
              <a
                href="/docs"
                onClick={(e) => handleRouteClick(e, 'docs')}
                className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[#f6f6f8] transition-colors"
              >
                <BookOpen className="w-4 h-4 text-[#ff5500] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#0f0f14]">API &amp; Webhooks Docs</div>
                  <div className="text-[11px] text-[#6e6e7e]">REST reference, TRAI DND &amp; intake guides</div>
                </div>
              </a>
            </DropdownPanel>
          </div>

          {navRoutes.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleRouteClick(e, link.route)}
              className={`hover:text-[#0f0f14] transition-colors cursor-pointer whitespace-nowrap ${
                activeRoute === link.route ? 'text-[#ff5500] font-semibold' : ''
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenSimulator}
            className="px-3.5 py-2 rounded-full bg-white hover:bg-[#f6f6f8] text-[#0f0f14] font-semibold text-xs border border-[#e4e4e9] flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3 h-3 text-[#ff5500]" />
            Live Sandbox
          </button>

          <button
            onClick={onEnterDashboard}
            className="px-3 py-2 rounded-full text-xs font-semibold text-[#525260] hover:text-[#0f0f14] transition cursor-pointer whitespace-nowrap"
          >
            Sign in
          </button>

          <Magnet padding={40} magnetStrength={3}>
            <button
              onClick={onStartFree ?? onEnterDashboard}
              className="px-4 py-2 rounded-full bg-[#ff5500] hover:bg-[#ea580c] text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm shadow-[#ff5500]/25 cursor-pointer whitespace-nowrap"
            >
              <span>Start free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Magnet>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex sm:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-[#0f0f14] hover:bg-[#f6f6f8] border border-[#e4e4e9]"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-[#e4e4e9] bg-white px-4 pt-3 pb-6 space-y-2 shadow-lg">
          <div className="pb-2 border-b border-[#f0f0f4] space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a98] px-1">
              Product
            </div>
            {(
              [
                { label: 'Instant Leads (<30s)', route: 'instant-leads' as const, href: '/product/instant-leads' },
                { label: 'Bulk Campaigns', route: 'campaigns' as const, href: '/product/campaigns' },
                { label: 'Incoming Calls', route: 'inbound' as const, href: '/product/inbound' },
              ]
            ).map((item) => (
              <a
                key={item.route}
                href={item.href}
                onClick={(e) => handleRouteClick(e, item.route)}
                className="block py-1.5 px-1 text-sm font-semibold text-[#0f0f14] hover:text-[#ff5500]"
              >
                {item.label}
              </a>
            ))}
          </div>
          {navRoutes.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleRouteClick(e, link.route)}
              className="block py-2 px-1 text-sm font-semibold text-[#0f0f14] hover:text-[#ff5500]"
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
              className="w-full py-2.5 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9] text-[#0f0f14] font-bold text-xs flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 text-[#ff5500]" />
              Live Sandbox Simulator
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                (onStartFree ?? onEnterDashboard)();
              }}
              className="w-full py-2.5 rounded-full bg-[#ff5500] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <Zap className="w-4 h-4" />
              Start free →
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default LandingNav;
