import React, { useState } from 'react';
import {
  AnimatedContent,
  SplitText,
  PillNav,
  GlassIcons,
  TrueFocus,
  DecryptedText,
  AuroraBackground,
  CardSwap,
  MagicBento,
  NoiseOverlay,
} from '@/components/reactbits';
import {
  Zap,
  PhoneForwarded,
  PhoneIncoming,
  Calendar,
  MessageSquare,
  Database,
  PhoneCall,
  ShieldCheck,
  Code2,
  CheckCircle2,
  ArrowRight,
  Brain,
  Webhook,
  Headphones,
} from 'lucide-react';

interface PlatformModesSectionProps {
  onEnterDashboard: () => void;
}

const MODE_DETAILS = {
  instant: {
    title: 'New enquiry arrives → called in under 30 seconds',
    description:
      'Connect Meta Lead Ads, website forms, IndiaMART, or any CRM webhook. Trivaana verifies consent & DND, dials in the caller’s language, qualifies interest, and books directly into your calendar.',
    steps: [
      { step: '1. Lead captured', detail: 'POST /api/public/lead-intake/{slug} or webhook' },
      { step: '2. DND & Consent check', detail: 'TRAI guard verified in <50ms' },
      { step: '3. Instant call (<30s)', detail: 'Booked visit + WhatsApp confirmation sent' },
    ],
  },
  bulk: {
    title: 'Hand over the list → get back only the interested leads',
    description:
      'Upload thousands of past or dormant leads via CSV or pasted numbers. Multiple concurrent AI lines work through the list during TRAI permitted hours and retry unanswered numbers automatically.',
    steps: [
      { step: '1. Map CSV & Suppression', detail: 'Column mapper + automatic DNC exclusion' },
      { step: '2. Multi-line AI Dialer', detail: 'Up to 50+ concurrent vernacular calls' },
      { step: '3. Structured Extractions', detail: 'Export interested contacts or fire CRM webhooks' },
    ],
  },
  inbound: {
    title: '24×7 AI Receptionist on your business numbers',
    description:
      'Map Exotel, Plivo, Vobiz, or Twilio DIDs to trained AI Employees. Answer every incoming call immediately, quote verified Knowledge Base prices, remember returning callers, or warm-transfer to a human.',
    steps: [
      { step: '1. Business Number Ring', detail: '044 / 080 / 040 landline or virtual mobile' },
      { step: '2. KB-Grounded Answers', detail: 'Zero hallucinated pricing or timelines' },
      { step: '3. Warm Human Transfer', detail: 'Escalate hot buyers directly to closing team' },
    ],
  },
};

export const PlatformModesSection: React.FC<PlatformModesSectionProps> = ({ onEnterDashboard }) => {
  const [activeMode, setActiveMode] = useState<'instant' | 'bulk' | 'inbound'>('instant');
  const current = MODE_DETAILS[activeMode];

  return (
    <>
      {/* 3-Mode Employee Showcase (#modes) */}
      <section id="modes" className="py-20 bg-white border-b border-[#e4e4e9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-xl">
              <div className="mb-2">
                <TrueFocus items={['Instant <30s', 'Bulk Dialing', 'Inbound 24×7']} />
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0f0f14] tracking-tight mt-1">
                <SplitText text="One AI employee. Instant, bulk, and inbound." />
              </h2>
            </div>

            <PillNav
              layoutGroupId="platformModeSwitch"
              activeId={activeMode}
              onChange={(id) => setActiveMode(id as 'instant' | 'bulk' | 'inbound')}
              items={[
                { id: 'instant', label: 'Instant Leads', icon: Zap },
                { id: 'bulk', label: 'Bulk Campaigns', icon: PhoneForwarded },
                { id: 'inbound', label: 'Incoming Calls', icon: PhoneIncoming },
              ]}
            />
          </div>

          <AuroraBackground className="rounded-[26px] bg-outpero-dark-card text-white border border-white/10">
            <NoiseOverlay />
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5 space-y-4">
                <h3 className="font-display text-2xl font-bold leading-snug">{current.title}</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{current.description}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onEnterDashboard}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#ff5500] hover:bg-[#ea580c] text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    <span>Configure in Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <CardSwap
                  cards={[
                    { id: 'cs1', badge: 'te-IN', title: 'Venkat Rao · 3BHK Villa Enquiry', meta: '142s', outcome: 'Site Visit Scheduled · Sat 11 AM' },
                    { id: 'cs2', badge: 'hi-IN', title: 'Dr. Sunita Sharma · NEET Scholarship', meta: '98s', outcome: 'Online Diagnostic Test Booked' },
                    { id: 'cs3', badge: 'en-IN', title: 'Vikram · Luxury SUV Showroom', meta: '115s', outcome: 'Test Drive Confirmed · Tomorrow' },
                  ]}
                  className="pt-2"
                />
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {current.steps.map((st, idx) => (
                  <AnimatedContent key={`${activeMode}-${idx}`} delay={idx * 0.06}>
                    <div className="p-4 rounded-2xl bg-[#1b1824] border border-white/10 space-y-2 h-full">
                      <div className="w-7 h-7 rounded-full bg-[#ff5500]/20 text-[#ff8547] text-xs font-extrabold flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div className="font-bold text-xs text-white">{st.step}</div>
                      <div className="text-[11px] text-slate-400 leading-relaxed">{st.detail}</div>
                    </div>
                  </AnimatedContent>
                ))}
              </div>
            </div>
          </AuroraBackground>
        </div>
      </section>

      {/* Agentic Actions Grid ("Voices with hands") */}
      <section id="actions" className="py-20 bg-[#fcfcfd] border-b border-[#e4e4e9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff5500]">
              Mid-Call &amp; Post-Call Actions
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0f0f14] tracking-tight mt-1">
              India&apos;s best voices. Now with hands.
            </h2>
            <p className="text-sm text-[#525260] mt-2">
              Your AI Employees don&apos;t just talk — they execute real business workflows automatically while on or immediately after the call.
            </p>
          </div>

          {/* 6-Node Radial Agentic Diagram (Outpero "Voices with hands" parity) */}
          <div className="rounded-[26px] bg-outpero-dark-card border border-white/10 p-6 sm:p-10 text-white relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-3 space-y-3">
                {[
                  { icon: Calendar, label: 'Google Calendar', note: 'Live free/busy check & invite' },
                  { icon: Database, label: 'Your CRM', note: 'LeadSquared, Zoho, HubSpot & Salesforce' },
                  { icon: Webhook, label: 'Custom API', note: 'HTTPS JSON POST with HMAC signature' },
                ].map((sat) => {
                  const Icon = sat.icon;
                  return (
                    <div
                      key={sat.label}
                      className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#1b1824] border border-white/10 hover:border-[#ff5500]/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#ff5500]/15 text-[#ff8547] flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{sat.label}</div>
                        <div className="text-[11px] text-slate-400">{sat.note}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-6 flex flex-col items-center justify-center py-6 relative">
                <div className="w-44 h-44 rounded-full border border-dashed border-white/15 flex items-center justify-center relative">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#ff5500] to-[#ea580c] shadow-[0_0_50px_rgba(255,85,0,0.4)] flex flex-col items-center justify-center text-center p-3">
                    <Headphones className="w-7 h-7 text-white mb-1" />
                    <span className="text-xs font-extrabold text-white leading-tight">
                      Trivaana AI Employee
                    </span>
                    <span className="text-[10px] text-orange-100 mt-0.5">Live Tool Execution</span>
                  </div>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/8 border border-white/10 text-[11px] text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Executes actions mid-call &amp; post-call in &lt;400ms</span>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-3">
                {[
                  { icon: PhoneCall, label: 'Call transfer', note: 'Warm SIP bridge to closing reps' },
                  { icon: Brain, label: 'Caller memory', note: 'Recalls past calls & preferences' },
                  { icon: MessageSquare, label: 'WhatsApp', note: 'Brochures, pins & payment links' },
                ].map((sat) => {
                  const Icon = sat.icon;
                  return (
                    <div
                      key={sat.label}
                      className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#1b1824] border border-white/10 hover:border-[#ff5500]/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{sat.label}</div>
                        <div className="text-[11px] text-slate-400">{sat.note}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <MagicBento>
            {[
              {
                icon: Calendar,
                accent: 'orange' as const,
                title: 'Live Calendar Booking',
                desc: 'Checks live slot availability and books site visits, OPDs, or demos mid-conversation.',
              },
              {
                icon: MessageSquare,
                accent: 'emerald' as const,
                title: 'WhatsApp Follow-ups',
                desc: 'Sends Meta-approved brochures, location pins, or test links right after hanging up.',
              },
              {
                icon: Database,
                accent: 'indigo' as const,
                title: 'CRM & Sheets Extraction',
                desc: 'Captures budget, city, timeline, and custom JSON fields straight into Leads & webhooks.',
              },
              {
                icon: PhoneCall,
                accent: 'amber' as const,
                title: 'Warm Human Transfer',
                desc: 'Bridges hot prospects seamlessly to your closing specialist when escalation rules trigger.',
              },
            ].map((item, idx) => (
              <AnimatedContent key={item.title} delay={idx * 0.05}>
                <div className="p-5 rounded-2xl bg-white border border-[#e4e4e9] shadow-2xs space-y-3 h-full">
                  <GlassIcons icon={item.icon} accent={item.accent} />
                  <h3 className="font-display font-bold text-sm text-[#0f0f14]">{item.title}</h3>
                  <p className="text-xs text-[#525260] leading-relaxed">{item.desc}</p>
                </div>
              </AnimatedContent>
            ))}
          </MagicBento>
        </div>
      </section>

      {/* TRAI Compliance + Developer API Showcase (#api-compliance) */}
      <section id="api-compliance" className="py-20 bg-white border-b border-[#e4e4e9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> TRAI &amp; Developer Ready
            </span>
            <h2 className="font-display text-3xl font-extrabold text-[#0f0f14] tracking-tight">
              Built for Indian compliance &amp; REST APIs.
            </h2>
            <p className="text-xs sm:text-sm text-[#525260] leading-relaxed">
              Every call is scrubbed against your workspace Do-Not-Call ledger, gated to TRAI TCCCPR hours, and billed deterministically in integer paise.
            </p>
            <ul className="space-y-2 text-xs text-[#0f0f14] font-medium">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> HMAC-SHA256 signed event webhooks (`call.completed`, `lead.qualified`)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Zero-float-drift prepaid wallet ledger + 18% GST SAC 998313 invoices</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Works with Exotel, Plivo, Vobiz, Twilio, LiveKit, Sarvam &amp; ElevenLabs</li>
            </ul>
          </div>

          <div className="lg:col-span-7 rounded-2xl bg-[#121019] border border-white/10 p-5 text-white shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-white/10 pb-3">
              <span className="font-semibold text-[#ff8547] inline-flex items-center gap-1.5">
                <Code2 className="w-4 h-4" /> Instant Lead Intake API
              </span>
              <span className="text-[10px] font-mono-code text-slate-400">
                <DecryptedText text="POST /api/public/lead-intake/{slug}" />
              </span>
            </div>
            <pre className="font-mono-code text-[11px] sm:text-xs text-slate-200 overflow-x-auto leading-relaxed">{`curl -X POST "https://api.trivaana.ai/api/public/lead-intake/aravind-villas" \\
  -H "Content-Type: application/json" \\
  -H "X-Intake-Secret: trv_live_your_secret" \\
  -d '{
    "name": "K. Venkat Rao",
    "phone": "+919848012345",
    "city": "Hyderabad",
    "consent_confirmed": true
  }'`}</pre>
          </div>
        </div>
      </section>
    </>
  );
};
