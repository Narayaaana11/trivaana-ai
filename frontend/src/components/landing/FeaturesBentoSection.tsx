import React from 'react';
import {
  BentoGrid,
  BentoCard,
  BorderBeam,
  InView,
  NumberTicker,
} from '@/components/motion';
import { Badge } from '@/components/ui';
import {
  Zap,
  Globe2,
  ShieldCheck,
  Wallet,
  MessageSquareText,
  PhoneCall,
  CalendarCheck,
  CheckCircle2,
} from 'lucide-react';

interface FeaturesBentoSectionProps {
  onEnterDashboard: () => void;
  onOpenSimulator: () => void;
}

export const FeaturesBentoSection: React.FC<FeaturesBentoSectionProps> = ({
  onEnterDashboard,
  onOpenSimulator,
}) => {
  return (
    <section className="py-20 bg-[#fcfcfd] border-b border-[#e4e4e9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <InView className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="primary" className="mb-3">
            <Zap className="w-3 h-3" />
            <span>Built for Indian Telephony &amp; Enterprise Scale</span>
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0f0f14] tracking-tight">
            Everything an autonomous AI calling team needs
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#525260]">
            From instant webhook dialing and vernacular voice synthesis to deterministic paise billing and TRAI compliance.
          </p>
        </InView>

        <BentoGrid>
          {/* Card 1: Sub-30s Instant Speed-to-Lead */}
          <BentoCard
            className="md:col-span-2 relative"
            name="Sub-30s Instant Speed-to-Lead"
            badge="3.8× Higher Connect Rate"
            description="Every Meta Lead Ad, website form, or IndiaMART enquiry triggers an automated DND check and outbound call in under 30 seconds — while the prospect is still looking at your page."
            Icon={Zap}
            ctaLabel="Launch instant lead workflow"
            onCtaClick={onEnterDashboard}
            background={
              <div className="p-4 sm:p-5 bg-[#121019] text-white relative">
                <BorderBeam size={180} duration={10} borderWidth={1} colorFrom="#ff5500" colorTo="#16a34a" />
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-code text-slate-400 mb-3">
                  <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    WEBHOOK RECEIVED · 00:00.0s
                  </span>
                  <span>POST /api/public/lead-intake/skyline-villas</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">1. NDNC Guard</div>
                    <div className="font-bold text-white mt-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cleared in 42ms</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">2. Exotel Dial</div>
                    <div className="font-bold text-[#ff8547] mt-1 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Ringing in 11.4s</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">3. Outcome</div>
                    <div className="font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <CalendarCheck className="w-3.5 h-3.5" />
                      <span>Visit Booked + WA</span>
                    </div>
                  </div>
                </div>
              </div>
            }
          />

          {/* Card 2: 7 Indian Languages */}
          <BentoCard
            name="7 Indian Languages & Code-Mixing"
            badge="Sarvam + ElevenLabs"
            description="Natural Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, and Indian English — including real-world Hinglish and Tenglish phrasing."
            Icon={Globe2}
            ctaLabel="Audition live voices"
            onCtaClick={onOpenSimulator}
            background={
              <div className="p-4 flex flex-wrap gap-1.5 justify-center">
                {[
                  'తెలుగు · Telugu',
                  'हिन्दी · Hindi',
                  'தமிழ் · Tamil',
                  'ಕನ್ನಡ · Kannada',
                  'മലയാളം · Malayalam',
                  'मराठी · Marathi',
                  'Indian English',
                ].map((lang) => (
                  <span
                    key={lang}
                    className="px-2.5 py-1 rounded-full bg-white border border-[#e4e4e9] text-[11px] font-semibold text-[#0f0f14] shadow-2xs"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            }
          />

          {/* Card 3: TRAI & NDNC Compliance */}
          <BentoCard
            name="TRAI 10 AM – 6 PM & NDNC Guard"
            badge="Zero-Risk Dialing"
            description="Every outbound call is automatically gated by IST calling windows, DLT headers, and National Do Not Call scrubbing before a single ring."
            Icon={ShieldCheck}
            background={
              <div className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="font-semibold text-emerald-900">Calling Window (IST)</span>
                  <span className="font-mono-code font-bold text-emerald-700">10:00 – 18:00</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#e4e4e9]">
                  <span className="font-semibold text-[#0f0f14]">NDNC / DNC Scrub</span>
                  <span className="text-[11px] font-bold text-[#16a34a]">Active</span>
                </div>
              </div>
            }
          />

          {/* Card 4: Integer Paise Wallet & Zero Waste */}
          <BentoCard
            name="Integer Paise Metering & GST"
            badge="₹0 Unanswered"
            description="Deterministic wallet ledger computed in integer paise. Unanswered, busy, or failed rings cost ₹0, with instant Razorpay UPI top-ups."
            Icon={Wallet}
            background={
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a98]">
                    Standard Rate
                  </div>
                  <div className="font-display text-2xl font-extrabold text-[#0f0f14] mt-0.5">
                    ₹<NumberTicker value={6.5} decimals={2} />
                    <span className="text-xs font-medium text-[#525260]">/min</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Unanswered
                  </div>
                  <div className="font-display text-2xl font-extrabold text-emerald-600 mt-0.5">
                    ₹0
                  </div>
                </div>
              </div>
            }
          />

          {/* Card 5: Real-Time Call Intelligence */}
          <BentoCard
            name="Transcripts, Audio & CRM Sync"
            badge="Structured JSON"
            description="Every call yields full bilingual transcripts, audio playback, sentiment tags, and structured lead fields synced to your CRM via webhooks."
            Icon={MessageSquareText}
            ctaLabel="Explore dashboard"
            onCtaClick={onEnterDashboard}
            background={
              <div className="p-4 space-y-2 text-[11px]">
                <div className="flex items-center justify-between text-[#525260]">
                  <span className="font-semibold text-[#0f0f14]">Extracted: Budget</span>
                  <span className="font-mono-code font-bold text-[#ff5500]">₹90L – ₹1.1Cr</span>
                </div>
                <div className="flex items-center justify-between text-[#525260]">
                  <span className="font-semibold text-[#0f0f14]">Intent Score</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    Hot · Booked
                  </span>
                </div>
              </div>
            }
          />
        </BentoGrid>
      </div>
    </section>
  );
};

