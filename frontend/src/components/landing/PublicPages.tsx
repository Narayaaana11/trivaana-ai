import React, { useState } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import {
  VoicePill,
  Counter,
  ElasticSlider,
  BorderGlow,
  TiltedCard,
  AuroraBackground,
  SplitText,
} from '@/components/reactbits';
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  PhoneIncoming,
  PhoneForwarded,
  Zap,
  ShieldCheck,
  Code2,
} from 'lucide-react';

interface PageCommonProps {
  onEnterDashboard: () => void;
  onOpenDocs: () => void;
}

/* ---------------- 1. /voices Dedicated Page ---------------- */
const ALL_VOICES = [
  { id: 'v1', name: 'Meera', lang: 'hi-IN', label: 'Hindi · Warm', tier: 'Standard · ₹6.50/min', line: 'नमस्ते जी, मैं मीरा बोल रही हूँ। आपका अपॉइंटमेंट कन्फर्म कर दूँ?' },
  { id: 'v2', name: 'Aravind', lang: 'te-IN', label: 'Telugu · Executive', tier: 'Standard · ₹6.50/min', line: 'నమస్కారం అండి! గేటెడ్ విల్లాస్ విజిట్ శనివారం ప్లాన్ చేద్దామా?' },
  { id: 'v3', name: 'Priya', lang: 'hi-IN', label: 'Hindi · Flash v2.5', tier: 'Premium · ₹8.50/min', line: 'नमस्ते! आपकी NEET स्कॉलरशिप टेस्ट रविवार सुबह 10 बजे है।' },
  { id: 'v4', name: 'Kavya', lang: 'ta-IN', label: 'Tamil · Conversational', tier: 'Premium · ₹8.50/min', line: 'வணக்கம்! உங்கள் டெமோ அழைப்பை நாளை காலை உறுதி செய்யலாமா?' },
  { id: 'v5', name: 'Ananya', lang: 'kn-IN', label: 'Kannada · Reception', tier: 'Standard · ₹6.50/min', line: 'ನಮಸ್ಕಾರ! ನಿಮಗೆ ಅನುಕೂಲವಾದ ಸಮಯವನ್ನು ದಯವಿಟ್ಟು ತಿಳಿಸಿ.' },
  { id: 'v6', name: 'Rohan', lang: 'en-IN', label: 'Indian English · Sales', tier: 'Standard · ₹6.50/min', line: 'Hi! Calling about your test drive booking scheduled for tomorrow at 11 AM.' },
];

export const PublicVoicesPage: React.FC<PageCommonProps> = ({ onEnterDashboard }) => {
  const [filterLang, setFilterLang] = useState('all');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const visible = ALL_VOICES.filter((v) => filterLang === 'all' || v.lang === filterLang);

  return (
    <section className="bg-outpero-grid py-16 border-b border-[#e4e4e9]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e4e4e9] text-[11px] font-bold uppercase text-[#ff5500]">
            • Voices
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-[#0f0f14] tracking-tight">
            <SplitText text="India's most natural-sounding voices." className="justify-center" />
          </h1>
          <p className="text-sm sm:text-base text-[#525260]">
            We auditioned 600+ voices, onboarded native speakers in every language, and tuned pacing, pauses, and pronunciation so callers never feel like they are stuck on an IVR.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {[
            { id: 'all', label: 'All Languages' },
            { id: 'hi-IN', label: 'हिन्दी Hindi' },
            { id: 'te-IN', label: 'తెలుగు Telugu' },
            { id: 'ta-IN', label: 'தமிழ் Tamil' },
            { id: 'kn-IN', label: 'ಕನ್ನಡ Kannada' },
            { id: 'en-IN', label: 'Indian English' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterLang(f.id)}
              className={`px-3.5 py-1.5 rounded-full font-bold border cursor-pointer transition-colors ${
                filterLang === f.id
                  ? 'bg-[#0f0f14] text-white border-[#0f0f14]'
                  : 'bg-white text-[#525260] border-[#e4e4e9] hover:border-[#ff5500]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((v) => {
            const active = playingId === v.id;
            return (
              <TiltedCard key={v.id} maxTilt={3}>
                <BorderGlow className="h-full">
                  <div className="p-5 flex flex-col justify-between gap-4 h-full text-xs">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-base font-extrabold text-[#0f0f14]">{v.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#fff7ed] border border-[#fed7aa] text-[#c2410c] text-[10px] font-bold">
                          {v.tier}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6e6e7e] mt-0.5">{v.label}</div>
                      <p className="mt-3 p-3 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9] text-[#0f0f14] leading-relaxed">
                        &ldquo;{v.line}&rdquo;
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <VoicePill
                        active={active}
                        label={active ? 'Stop sample' : 'Hear voice'}
                        onClick={() => {
                          if (!('speechSynthesis' in window)) return;
                          window.speechSynthesis.cancel();
                          if (active) {
                            setPlayingId(null);
                            return;
                          }
                          const u = new SpeechSynthesisUtterance(v.line);
                          u.lang = v.lang;
                          u.onend = () => setPlayingId(null);
                          setPlayingId(v.id);
                          window.speechSynthesis.speak(u);
                        }}
                      />
                      <button
                        type="button"
                        onClick={onEnterDashboard}
                        className="font-bold text-[#ff5500] hover:underline cursor-pointer"
                      >
                        Select →
                      </button>
                    </div>
                  </div>
                </BorderGlow>
              </TiltedCard>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ---------------- 2. /pricing Dedicated Outpero Cost Estimator ---------------- */
export const PublicPricingPage: React.FC<PageCommonProps> = ({ onEnterDashboard }) => {
  const [monthlyCalls, setMonthlyCalls] = useState(2000);
  const [avgMins, setAvgMins] = useState(1.5);
  const [voiceRate, setVoiceRate] = useState<6.5 | 8.5>(6.5);
  const [channels, setChannels] = useState(2);

  const talkCost = Math.round(monthlyCalls * avgMins * voiceRate);
  const infraCost = 649 + Math.max(0, channels - 1) * 649;
  const totalMonthly = talkCost + infraCost;

  return (
    <section className="bg-outpero-grid py-16 border-b border-[#e4e4e9]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e4e4e9] text-[11px] font-bold uppercase text-[#ff5500]">
            • Transparent Pricing
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-[#0f0f14] tracking-tight">
            Pay for talk time. Nothing else.
          </h1>
          <p className="text-sm sm:text-base text-[#525260]">
            1 credit = ₹1. Billed per connected minute. Unanswered calls cost ₹0. No feature gates or per-seat pricing.
          </p>
        </div>

        {/* Outpero Monthly Estimator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white rounded-3xl border border-[#e4e4e9] p-6 sm:p-8 space-y-6 text-xs shadow-xs">
            <h2 className="font-display text-xl font-extrabold text-[#0f0f14]">What would a month cost you?</h2>

            <div>
              <div className="flex justify-between font-bold mb-1">
                <span>Monthly connected calls</span>
                <span className="text-[#ff5500]"><Counter value={monthlyCalls} /> calls</span>
              </div>
              <ElasticSlider min={100} max={20000} step={100} value={monthlyCalls} onChange={setMonthlyCalls} />
            </div>

            <div>
              <div className="flex justify-between font-bold mb-1">
                <span>Average call duration (minutes)</span>
                <span className="text-[#ff5500] tabular-nums">{avgMins.toFixed(1)} min</span>
              </div>
              <ElasticSlider min={0.5} max={5} step={0.5} value={avgMins} onChange={setAvgMins} />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVoiceRate(6.5)}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer ${
                  voiceRate === 6.5 ? 'border-[#ff5500] bg-[#fff7ed]' : 'border-[#e4e4e9] bg-[#f6f6f8]'
                }`}
              >
                <div className="font-bold text-[#0f0f14]">Standard Voice</div>
                <div className="font-display text-lg font-extrabold text-[#ff5500]">₹6.50/min</div>
              </button>
              <button
                type="button"
                onClick={() => setVoiceRate(8.5)}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer ${
                  voiceRate === 8.5 ? 'border-[#ff5500] bg-[#fff7ed]' : 'border-[#e4e4e9] bg-[#f6f6f8]'
                }`}
              >
                <div className="font-bold text-[#0f0f14]">Premium Neural</div>
                <div className="font-display text-lg font-extrabold text-[#ff5500]">₹8.50/min</div>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#e4e4e9]">
              <div>
                <div className="font-bold text-[#0f0f14]">Number + Concurrent Channels (₹649/mo each)</div>
                <div className="text-[11px] text-[#6e6e7e]">One channel = one simultaneous call</div>
              </div>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChannels((c) => Math.max(1, c - 1))}
                  className="w-7 h-7 rounded-lg bg-[#f6f6f8] border border-[#e4e4e9] font-bold cursor-pointer"
                >
                  -
                </button>
                <span className="font-display font-extrabold text-sm w-6 text-center">{channels}</span>
                <button
                  type="button"
                  onClick={() => setChannels((c) => Math.min(50, c + 1))}
                  className="w-7 h-7 rounded-lg bg-[#f6f6f8] border border-[#e4e4e9] font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <AuroraBackground className="lg:col-span-5 rounded-3xl bg-outpero-dark-card text-white p-6 sm:p-8 border border-white/10 shadow-xl space-y-5">
            <div className="text-[11px] font-bold uppercase text-[#ff8547]">Estimated Monthly Total</div>
            <div className="font-display text-4xl sm:text-5xl font-extrabold tabular-nums">
              ₹{totalMonthly.toLocaleString('en-IN')}
            </div>
            <div className="space-y-2 text-xs text-slate-300 border-t border-white/10 pt-4">
              <div className="flex justify-between">
                <span>Talk time ({Math.round(monthlyCalls * avgMins).toLocaleString('en-IN')} mins)</span>
                <span className="font-bold text-white tabular-nums">₹{talkCost.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Business Number + {channels} Channel(s)</span>
                <span className="font-bold text-white tabular-nums">₹{infraCost.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Unanswered / Busy Calls</span>
                <span className="font-bold">₹0.00</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onEnterDashboard}
              className="w-full py-3 rounded-full bg-[#ff5500] hover:bg-[#ea580c] text-white font-bold text-xs cursor-pointer"
            >
              Start free with 50 credits →
            </button>
          </AuroraBackground>
        </div>
      </div>
    </section>
  );
};

/* ---------------- 3. /product/* Dedicated Feature Pages ---------------- */
const CONNECTORS = [
  'IndiaMART', 'JustDial', 'Meta Lead Ads', 'Google Lead Forms', 'MagicBricks',
  '99acres', 'Zoho CRM', 'HubSpot', 'Salesforce', 'Zapier', 'Make', 'Pabbly', 'Custom Webhook',
];

export const PublicProductPage: React.FC<{
  product: 'instant-leads' | 'campaigns' | 'inbound';
  onEnterDashboard: () => void;
  onOpenDocs: () => void;
}> = ({ product, onEnterDashboard, onOpenDocs }) => {
  if (product === 'instant-leads') {
    return (
      <section className="bg-outpero-grid py-16 border-b border-[#e4e4e9]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e4e4e9] text-[11px] font-bold uppercase text-[#ff5500]">
              <Zap className="w-3.5 h-3.5" /> Instant Leads
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-[#0f0f14] tracking-tight">
              Every new lead gets a call in under 30 seconds.
            </h1>
            <p className="text-sm sm:text-base text-[#525260]">
              Plugs into wherever your enquiries already land — qualifies interest, books slots, and posts structured outcomes back to your CRM.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button type="button" onClick={onEnterDashboard} className="px-6 py-2.5 rounded-full bg-[#ff5500] text-white text-xs font-bold cursor-pointer">
                Start free →
              </button>
              <button type="button" onClick={onOpenDocs} className="px-6 py-2.5 rounded-full bg-white border border-[#e4e4e9] text-xs font-bold cursor-pointer">
                Read the API docs
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#e4e4e9] p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-extrabold text-[#0f0f14]">
              Plugs into wherever your leads already land.
            </h2>
            <div className="flex flex-wrap gap-2">
              {CONNECTORS.map((c) => (
                <span key={c} className="px-3.5 py-2 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9] text-xs font-semibold text-[#0f0f14]">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (product === 'campaigns') {
    return (
      <section className="bg-outpero-grid py-16 border-b border-[#e4e4e9]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e4e4e9] text-[11px] font-bold uppercase text-[#ff5500]">
              <PhoneForwarded className="w-3.5 h-3.5" /> Bulk Campaigns
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-[#0f0f14] tracking-tight">
              Hand over the list. Get back the interested ones.
            </h1>
            <p className="text-sm sm:text-base text-[#525260]">
              Upload 1,240 old enquiries before lunch. By evening, every one has been dialed within TRAI hours, and you have a filtered shortlist of interested buyers.
            </p>
            <button type="button" onClick={onEnterDashboard} className="px-6 py-2.5 rounded-full bg-[#ff5500] text-white text-xs font-bold cursor-pointer">
              Launch Bulk Campaign →
            </button>
          </div>

          {/* 3-Step Visual Matching outpero.com/product/campaigns */}
          <div className="rounded-[26px] bg-outpero-dark-card text-white p-6 sm:p-8 border border-white/10 grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white text-[#0f0f14] space-y-2">
              <div className="font-bold text-[#ff5500]">1. Upload your list (enquiries_2026.csv)</div>
              <div className="divide-y divide-[#e4e4e9]">
                {[
                  ['Rahul Verma', '+91 98••• ••210', 'Baner'],
                  ['Sneha Iyer', '+91 99••• ••118', 'Wakad'],
                  ['Imran Shaikh', '+91 97••• ••402', 'Hinjewadi'],
                ].map((r) => (
                  <div key={r[0]} className="py-1.5 flex justify-between">
                    <span className="font-semibold">{r[0]}</span>
                    <span className="text-[#6e6e7e]">{r[2]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#1b1824] border border-white/10 space-y-2">
              <div className="font-bold text-[#ff8547]">2. Calls in parallel</div>
              <div className="p-2.5 rounded-xl bg-white/5">Line 1 · Dialing Rahul</div>
              <div className="p-2.5 rounded-xl bg-white/5">Line 2 · Connected Sneha</div>
              <div className="text-[11px] text-slate-400 pt-1">10:00–18:00 · Mon–Sat · DND respected</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#1b1824] border border-white/10 space-y-2">
              <div className="font-bold text-emerald-400">3. Sorted by outcome</div>
              <div className="flex justify-between"><span>Interested</span><span className="font-bold text-emerald-400">96</span></div>
              <div className="flex justify-between"><span>Callback scheduled</span><span>142</span></div>
              <div className="flex justify-between"><span>No answer · Retry queued</span><span>310</span></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-outpero-grid py-16 border-b border-[#e4e4e9]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e4e4e9] text-[11px] font-bold uppercase text-[#ff5500]">
          <PhoneIncoming className="w-3.5 h-3.5" /> Incoming Calls 24×7
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-[#0f0f14] tracking-tight">
          Every call to your number, answered on the first ring.
        </h1>
        <p className="text-sm sm:text-base text-[#525260] max-w-2xl mx-auto">
          No hardware and no tedious IVR menus. Point your business mobile or landline at Trivaana, answer FAQs from your Knowledge Base, and warm-transfer hot calls.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left text-xs">
          {[
            ['1. Connect your number', 'Use Exotel, Plivo, Vobiz, or Twilio DID with verified KYC.'],
            ['2. Ground answers in KB', 'AI quotes accurate prices, timings, and branch locations.'],
            ['3. Transfer or log', 'Warm transfer urgent callers or trigger instant WhatsApp confirmation.'],
          ].map(([title, body]) => (
            <div key={title} className="p-5 rounded-2xl bg-white border border-[#e4e4e9] space-y-2">
              <CheckCircle2 className="w-4 h-4 text-[#ff5500]" />
              <div className="font-display font-bold text-sm text-[#0f0f14]">{title}</div>
              <p className="text-[#525260]">{body}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={onEnterDashboard} className="px-6 py-3 rounded-full bg-[#ff5500] text-white text-xs font-bold cursor-pointer inline-flex items-center gap-2">
          <span>Set up Inbound Reception</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
};

/* ---------------- 4. /contact Dedicated Page ---------------- */
export const PublicContactPage: React.FC<{ onEnterDashboard: () => void }> = ({ onEnterDashboard }) => {
  const [sentId, setSentId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="bg-outpero-grid py-16 border-b border-[#e4e4e9]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-[#0f0f14] tracking-tight">
            Let&apos;s talk about your calls.
          </h1>
          <p className="text-sm text-[#525260]">
            Tell us your monthly calling volume, languages, and telephony requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
          <div className="md:col-span-5 space-y-3">
            <div className="p-5 rounded-2xl bg-white border border-[#e4e4e9] space-y-1.5">
              <Mail className="w-4 h-4 text-[#ff5500]" />
              <div className="font-bold text-[#0f0f14]">Email us</div>
              <div className="text-[#525260]">support@trivaana.ai</div>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-[#e4e4e9] space-y-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <div className="font-bold text-[#0f0f14]">Just want to try it?</div>
              <p className="text-[#525260]">Start free with demo wallet credits and no card required.</p>
              <button type="button" onClick={onEnterDashboard} className="font-bold text-[#ff5500] hover:underline cursor-pointer">
                Launch Mission Control →
              </button>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              setError(null);
              try {
                const res = await trivaanaApi.submitPublicContact({
                  name,
                  email,
                  phone: phone || undefined,
                  message,
                });
                setSentId(res.inquiry_id || 'submitted');
              } catch (err: any) {
                setError(err.message || 'Failed to send inquiry.');
              } finally {
                setSubmitting(false);
              }
            }}
            className="md:col-span-7 bg-white rounded-3xl border border-[#e4e4e9] p-6 space-y-3 shadow-xs"
          >
            {sentId ? (
              <div className="py-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="font-display font-bold text-base text-[#0f0f14]">Inquiry Received</div>
                <p className="text-[#525260]">
                  Reference ID: <span className="font-mono font-bold text-[#0f0f14]">{sentId}</span>. For immediate setup, launch Mission Control or email support@trivaana.ai.
                </p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold">{error}</div>
                )}
                <input required placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#e4e4e9]" />
                <input required type="email" placeholder="Work Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#e4e4e9]" />
                <input placeholder="Phone (+91...)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#e4e4e9]" />
                <textarea required rows={3} placeholder="Tell us about your use case (Real Estate, Healthcare, EdTech, Banking)..." value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#e4e4e9]" />
                <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ea580c] disabled:opacity-50 text-white font-bold cursor-pointer inline-flex items-center justify-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" /> {submitting ? 'Sending...' : 'Send Message'}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </section>
  );
};

