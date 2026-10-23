import React, { useState } from 'react';
import { SpotlightCard } from '@/components/reactbits';
import {
  Check,
  Zap,
  ShieldCheck,
  FileText,
  CreditCard,
  ArrowRight,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface PricingSectionProps {
  onSelectPlan?: (planId: string) => void;
  onEnterDashboard: () => void;
}

const TIERS = [
  {
    id: 'starter',
    name: 'Starter Pilot',
    price: '2,999',
    billing: 'per month + 18% GST',
    description: 'Perfect for local clinics, boutique brokerages, and solo founders testing AI calling.',
    highlight: false,
    ratePerMin: '₹3.80/min',
    features: [
      '1,000 Minutes Included',
      '2 Concurrent Calling Lines',
      'Telugu, Hindi & Indian English',
      'CSV Lead List Upload',
      'Full Call Transcripts & Audio',
      'TRAI 10 AM - 6 PM Compliance Guard',
      'Community Email Support',
    ],
    cta: 'Start with ₹2,999',
    btnClass: 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200',
  },
  {
    id: 'growth',
    name: 'Growth Scale',
    price: '7,999',
    billing: 'per month + 18% GST',
    description: 'Engineered for scaling real estate agencies, edtech academies, and auto dealerships.',
    highlight: true,
    badge: 'Most Popular for SMBs',
    ratePerMin: '₹3.40/min',
    features: [
      '3,000 Minutes Included',
      '10 Concurrent Calling Lines',
      'All 7 Indian Dialects (Tamil, Kannada, etc.)',
      'Autonomous OSM Lead Scout (Vizag, Hyd, Blr)',
      'WhatsApp Calendar Invite Dispatcher',
      'Speed-to-Lead Webhook (<30s trigger)',
      '5 Outpero Industry Dialect Presets',
      'Emergency Concurrency Kill Switch',
      'Priority WhatsApp Support',
    ],
    cta: 'Scale with Growth Plan',
    btnClass: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Fleet',
    price: '24,999',
    billing: 'per month + 18% GST',
    description: 'For corporate BPOs, hospital chains, and BFSI financial institutions with heavy volume.',
    highlight: false,
    ratePerMin: '₹2.90/min',
    features: [
      '10,000 Minutes Included',
      '50 Concurrent Calling Lines',
      'Dedicated Indian SIP Trunk Integration',
      'Custom Voice Cloning & Fine-Tuned Prompts',
      'Razorpay Multi-Subaccount Billing',
      'Zero-Float-Drift Integer Paise Ledger',
      'Custom CRM Webhooks (Salesforce, LeadSquared)',
      'Dedicated 99.9% Uptime SLA',
      '24/7 Dedicated Account Manager',
    ],
    cta: 'Contact Enterprise Sales',
    btnClass: 'bg-slate-900 hover:bg-slate-950 text-white',
  },
];

export const PricingSection: React.FC<PricingSectionProps> = ({
  onSelectPlan,
  onEnterDashboard,
}) => {
  return (
    <section id="pricing" className="py-24 bg-slate-50/70 border-b border-slate-200/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold mb-4 border border-orange-200">
            <CreditCard className="w-3.5 h-3.5 text-orange-600" />
            <span>Zero Hidden Fees • 100% Transparent INR Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-950 tracking-tight">
            Predictable Pricing Engineered for <br />
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Indian Business ROI
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Pre-fund your calling wallet via Razorpay UPI or Netbanking. Balance is deducted in whole integer paise for actual connected seconds only.
          </p>
        </div>

        {/* 3 Tier Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-7xl mx-auto">
          {TIERS.map((tier) => (
            <SpotlightCard
              key={tier.id}
              spotlightColor={tier.highlight ? 'rgba(255, 85, 0, 0.16)' : 'rgba(0, 0, 0, 0.04)'}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all relative ${
                tier.highlight
                  ? 'bg-white border-2 border-orange-500 shadow-xl lg:-translate-y-2'
                  : 'bg-white border border-slate-200/90 shadow-sm'
              }`}
            >
              <div>
                {tier.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs font-extrabold px-3.5 py-1 rounded-full shadow-sm uppercase tracking-wide">
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">{tier.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{tier.description}</p>
                  </div>
                </div>

                <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-slate-700">₹</span>
                    <span className="text-4xl sm:text-5xl font-black text-slate-950 font-mono tracking-tight">
                      {tier.price}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{tier.billing}</div>
                  <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs font-semibold text-orange-700">
                    <span>Overage Rate:</span>
                    <span className="font-mono bg-orange-100/70 px-2 py-0.5 rounded text-orange-900">
                      {tier.ratePerMin}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Included Capabilities
                  </div>
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    if (onSelectPlan) onSelectPlan(tier.id);
                    onEnterDashboard();
                  }}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${tier.btnClass}`}
                >
                  <span>{tier.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </SpotlightCard>
          ))}
        </div>

        {/* GST & Wallet Trust Banner */}
        <div className="mt-12 max-w-4xl mx-auto rounded-2xl p-6 bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                TRAI Certified & 18% GST Tax Invoices
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Full B2B tax compliance. Automated tax invoice PDF generation with input tax credit (ITC) eligibility.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-600 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
              UPI • Netbanking • Cards
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
