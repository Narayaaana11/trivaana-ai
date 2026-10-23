import React from 'react';
import { SpotlightCard } from '@/components/reactbits';
import {
  Building2,
  Stethoscope,
  GraduationCap,
  Car,
  Landmark,
  ArrowRight,
  TrendingUp,
  MessageSquareQuote,
  Sparkles,
} from 'lucide-react';

interface VerticalPresetsSectionProps {
  onSelectPreset?: (presetName: string) => void;
  onEnterDashboard: () => void;
}

const PRESETS = [
  {
    id: 'real-estate',
    name: 'Real Estate & Builders',
    icon: Building2,
    badge: '48% Site Visit Rate',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    primaryLang: 'Telugu / Hindi / English',
    description: 'Autonomous follow-ups on MagicBricks, 99acres, and Facebook ads within 30 seconds. Qualifies budget and books weekend site visits.',
    quote: '"నమస్కారం! మా ప్రీమియం విల్లాస్ బ్రోచర్ డౌన్‌లోడ్ చేశారు కదా? ఈ శనివారం సైట్ విజిట్ ప్లాన్ చేద్దామా?"',
    metric: '3.8x More Site Visits',
    color: 'from-amber-500/10 to-orange-500/10',
    iconColor: 'text-orange-600',
    borderColor: 'border-orange-200/80',
  },
  {
    id: 'healthcare',
    name: 'Clinics & Hospitals',
    icon: Stethoscope,
    badge: '32% No-Show Reduction',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    primaryLang: 'Telugu / Hindi / English',
    description: 'Empathetic OPD appointment reminders, pre-op instructions, lab report dispatches, and follow-up review collection.',
    quote: '"నమస్కారం అండి, అపోలో క్లినిక్ నుండి డాక్టర్ వర్మ అపాయింట్‌మెంట్ రేపు ఉదయం 10:30 కి కన్ఫర్మ్ చేద్దామా?"',
    metric: 'Zero Staff Burnout',
    color: 'from-blue-500/10 to-cyan-500/10',
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-200/80',
  },
  {
    id: 'edtech',
    name: 'EdTech & Test Prep',
    icon: GraduationCap,
    badge: '61% Demo Attendance',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    primaryLang: 'Hindi / Telugu / English',
    description: 'Rapid outreach for NEET, JEE, and Coding bootcamp webinar signups. Reminds parents and sends WhatsApp links 15 mins prior.',
    quote: '"नमस्ते! आपकी बेटी की NEET 2027 की फ्री मॉक टेस्ट रविवार सुबह 10 बजे है। क्या आप अटेंड कर रहे हैं?"',
    metric: '4.2x Webinar Turnout',
    color: 'from-purple-500/10 to-pink-500/10',
    iconColor: 'text-purple-600',
    borderColor: 'border-purple-200/80',
  },
  {
    id: 'automotive',
    name: 'Automotive Dealerships',
    icon: Car,
    badge: '54% Test Drive Booking',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    primaryLang: 'Telugu / Hindi / English',
    description: 'Immediate qualification for new car inquiries, annual maintenance reminders, and auto insurance renewal prompts.',
    quote: '"నమస్కారం! కొత్త SUV టెస్ట్ డ్రైవ్ బుక్ చేసుకోవడానికి ఏ సమయం అనుకూలంగా ఉంటుంది?"',
    metric: '₹4.2L Extra Margin/Mo',
    color: 'from-rose-500/10 to-red-500/10',
    iconColor: 'text-rose-600',
    borderColor: 'border-rose-200/80',
  },
  {
    id: 'bfsi',
    name: 'Finance & Lending (BFSI)',
    icon: Landmark,
    badge: '89% Verification Rate',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    primaryLang: 'Hindi / English / Telugu',
    description: 'TRAI-compliant polite soft reminders for upcoming EMIs, credit card KYC verification calls, and pre-approved loan followups.',
    quote: '"नमस्ते, आपकी ईएमआई 5 तारीख को देय है। क्या आप यूपीఐ ద్వారా చెల్లించాలనుకుంటున్నారా?"',
    metric: '99.4% TRAI Compliant',
    color: 'from-indigo-500/10 to-blue-500/10',
    iconColor: 'text-indigo-600',
    borderColor: 'border-indigo-200/80',
  },
];

export const VerticalPresetsSection: React.FC<VerticalPresetsSectionProps> = ({
  onSelectPreset,
  onEnterDashboard,
}) => {
  return (
    <section id="verticals" className="py-24 bg-slate-50/70 border-b border-slate-200/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold mb-4 border border-orange-200">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Turnkey Outpero-Grade Industry Presets</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-950 tracking-tight">
            Battle-Tested Call Scripts for <br />
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              High-Ticket Indian Verticals
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Don’t spend weeks writing prompts. Deploy pre-configured, vernacular voice agents with proven objection handling, booking workflows, and CRM syncing.
          </p>
        </div>

        {/* 5 Presets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRESETS.map((preset) => {
            const IconComponent = preset.icon;
            return (
              <SpotlightCard
                key={preset.id}
                spotlightColor="rgba(255, 85, 0, 0.12)"
                className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center">
                      <IconComponent className={`w-6 h-6 ${preset.iconColor}`} />
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${preset.badgeColor}`}>
                      {preset.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-1">{preset.name}</h3>
                  <p className="text-xs font-medium text-orange-600 mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                    {preset.primaryLang}
                  </p>

                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    {preset.description}
                  </p>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 mb-5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <MessageSquareQuote className="w-3.5 h-3.5 text-orange-600" />
                      <span>Live Speech Sample</span>
                    </div>
                    <p className="text-xs text-slate-600 italic font-serif leading-relaxed">
                      {preset.quote}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{preset.metric}</span>
                  </div>
                  <button
                    onClick={() => {
                      if (onSelectPreset) onSelectPreset(preset.name);
                      onEnterDashboard();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer group"
                  >
                    <span>Deploy Preset</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </SpotlightCard>
            );
          })}

          {/* Custom Workflow Card */}
          <div className="rounded-2xl p-6 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 text-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-4 border border-white/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white/20 text-white border border-white/30 inline-block mb-3">
                Zero Code Needed
              </span>
              <h3 className="text-xl font-bold text-white mb-2">Custom Business Workflow?</h3>
              <p className="text-sm text-orange-50 leading-relaxed mb-4">
                Bring your own sales qualification scripts or CRM lead forms. Our prompt engineers configure custom objection handlers for your exact business model.
              </p>
            </div>

            <button
              onClick={onEnterDashboard}
              className="w-full py-2.5 px-4 rounded-xl bg-white text-orange-600 font-bold text-xs hover:bg-orange-50 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              <span>Build Custom Agent in Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
