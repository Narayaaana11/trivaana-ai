import React, { useState } from 'react';
import {
  DotGridBackground,
  SplitText,
  FadeContent,
  CountUp,
  TiltedCard,
  BorderGlow,
  VoicePill,
} from '@/components/reactbits';
import { Volume2, Radio } from 'lucide-react';

interface VoiceShowcaseSectionProps {
  onEnterDashboard: () => void;
}

const VOICE_PROFILES = [
  {
    id: 'aravind',
    name: 'Aravind · Real Estate',
    lang: 'te-IN',
    languageLabel: 'Telugu (తెలుగు)',
    tier: 'Standard · ₹6.50/min',
    provider: 'Sarvam Bulbul v3',
    sample: 'నమస్కారం అండి! గేటెడ్ విల్లాస్ బ్రోచర్ గురించి కాల్ చేస్తున్నాను. ఈ శనివారం విజిట్ బుక్ చేద్దామా?',
    tone: 'Warm · Confident · Conversational',
  },
  {
    id: 'priya',
    name: 'Priya · Healthcare Desk',
    lang: 'hi-IN',
    languageLabel: 'Hindi (हिन्दी)',
    tier: 'Premium · ₹8.50/min',
    provider: 'ElevenLabs Flash v2.5',
    sample: 'नमस्ते! अपोलो डेंटल क्लिनिक से प्रिया बोल रही हूँ। कल सुबह 10:30 का अपॉइंटमेंट कन्फर्म कर दूँ?',
    tone: 'Empathetic · Clear · Polite',
  },
  {
    id: 'rohan',
    name: 'Rohan · EdTech Counselor',
    lang: 'en-IN',
    languageLabel: 'Indian English',
    tier: 'Standard · ₹6.50/min',
    provider: 'Sarvam Neural',
    sample: 'Hi there! Calling about your daughter’s NEET 2027 mock test scholarship slot this Sunday at 10 AM.',
    tone: 'Crisp · Energetic · Natural Indian Cadence',
  },
  {
    id: 'kavya',
    name: 'Kavya · Financial Advisory',
    lang: 'ta-IN',
    languageLabel: 'Tamil (தமிழ்)',
    tier: 'Premium · ₹8.50/min',
    provider: 'Sarvam / ElevenLabs',
    sample: 'வணக்கம்! உங்கள் வணிக கடன் தகுதி சரிபார்ப்பை 2 நிமிடங்களில் முடிக்கலாமா?',
    tone: 'Trustworthy · Measured · Multilingual',
  },
];

export const VoiceShowcaseSection: React.FC<VoiceShowcaseSectionProps> = ({ onEnterDashboard }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const togglePlay = (profile: (typeof VOICE_PROFILES)[0]) => {
    if (!('speechSynthesis' in window)) return;
    if (playingId === profile.id) {
      window.speechSynthesis.cancel();
      setPlayingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(profile.sample);
    u.lang = profile.lang;
    u.onend = () => setPlayingId(null);
    u.onerror = () => setPlayingId(null);
    setPlayingId(profile.id);
    window.speechSynthesis.speak(u);
  };

  return (
    <DotGridBackground className="py-20 bg-[#fcfcfd] border-b border-[#e4e4e9]">
      <section id="voices" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e4e4e9] text-[11px] font-bold uppercase tracking-wider text-[#ff5500]">
            <Radio className="w-3.5 h-3.5" />
            <span>Voices · Audition Live</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0f0f14] tracking-tight">
            <SplitText text="Voices your customers won't hang up on." className="justify-center" />
          </h2>
          <p className="text-sm sm:text-base text-[#525260]">
            Tuned on natural Indian code-switching — Telugu + English, Hinglish, Tamil, Kannada, Malayalam, and Marathi — with Standard and Premium neural engines.
          </p>
        </div>

        {/* Audition Proof Stats Card with CountUp & FadeContent */}
        <FadeContent>
          <div className="rounded-3xl bg-gradient-to-b from-[#fff7ed]/60 to-white border border-[#e4e4e9] p-6 sm:p-8 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center shadow-2xs">
            <div>
              <div className="font-display text-3xl font-extrabold text-[#0f0f14] tabular-nums">
                <CountUp to={600} duration={1.1} />+
              </div>
              <div className="text-xs font-bold text-[#0f0f14] mt-1">Voices auditioned</div>
              <p className="text-[11px] text-[#6e6e7e] mt-1">Across Indian accents, pace &amp; warmth</p>
            </div>
            <div>
              <div className="font-display text-3xl font-extrabold text-[#0f0f14] tabular-nums">
                <CountUp to={7} duration={0.8} />
              </div>
              <div className="text-xs font-bold text-[#0f0f14] mt-1">Indian languages</div>
              <p className="text-[11px] text-[#6e6e7e] mt-1">Native speaker reviewed scripts</p>
            </div>
            <div>
              <div className="font-display text-3xl font-extrabold text-[#0f0f14] tabular-nums">~600ms</div>
              <div className="text-xs font-bold text-[#0f0f14] mt-1">Turn-taking latency</div>
              <p className="text-[11px] text-[#6e6e7e] mt-1">Handles natural barge-in &amp; interruptions</p>
            </div>
            <div>
              <div className="font-display text-3xl font-extrabold text-[#ff5500] tabular-nums">₹6.50/m</div>
              <div className="text-xs font-bold text-[#0f0f14] mt-1">Standard vs Premium</div>
              <p className="text-[11px] text-[#6e6e7e] mt-1">Upgrade any employee per-minute anytime</p>
            </div>
          </div>
        </FadeContent>

        {/* Interactive Voice Sample Grid with TiltedCard, BorderGlow & VoicePill */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VOICE_PROFILES.map((vp) => {
            const active = playingId === vp.id;
            return (
              <TiltedCard key={vp.id} maxTilt={3}>
                <BorderGlow className="h-full shadow-2xs">
                  <div className="p-5 flex flex-col justify-between gap-4 h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-sm text-[#0f0f14]">{vp.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f6f6f8] border border-[#e4e4e9] text-[#525260]">
                            {vp.languageLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6e6e7e] mt-1">
                          {vp.provider} · {vp.tone}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] shrink-0">
                        {vp.tier}
                      </span>
                    </div>

                    <p className="text-xs text-[#0f0f14] bg-[#f6f6f8] p-3 rounded-xl border border-[#e4e4e9] leading-relaxed">
                      &ldquo;{vp.sample}&rdquo;
                    </p>

                    <div className="flex items-center justify-between">
                      <VoicePill
                        active={active}
                        onClick={() => togglePlay(vp)}
                        label={active ? 'Stop audio' : 'Hear voice sample'}
                      />
                      <button
                        type="button"
                        onClick={onEnterDashboard}
                        className="text-xs font-semibold text-[#ff5500] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Use this voice</span>
                      </button>
                    </div>
                  </div>
                </BorderGlow>
              </TiltedCard>
            );
          })}
        </div>
      </section>
    </DotGridBackground>
  );
};
