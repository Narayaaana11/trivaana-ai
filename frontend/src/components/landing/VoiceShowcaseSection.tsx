import React, { useEffect, useRef, useState } from 'react';
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
    voiceId: 'tarun',
    voiceLabel: 'Tarun · Warm & Natural',
    name: 'Aravind · Real Estate',
    lang: 'te-IN',
    languageLabel: 'Telugu (తెలుగు)',
    tier: 'Sarvam · ₹6.50/min',
    modelId: 'bulbul:v3',
    provider: 'Sarvam AI · bulbul:v3',
    audioUrl: '/audio/aravind.mp3',
    sample: 'నమస్కారం! ట్రివానా ఏఐకి స్వాగతం. నేను మీ వర్చువల్ అసిస్టెంట్ని. ఈరోజు మీకు ఎలా సహాయం చేయగలను?',
    tone: 'Warm · Confident · Conversational',
  },
  {
    id: 'priya',
    voiceId: 'priya',
    voiceLabel: 'Priya · Reassuring & Clear',
    name: 'Priya · Healthcare Desk',
    lang: 'hi-IN',
    languageLabel: 'Hindi (हिन्दी)',
    tier: 'Sarvam · ₹6.50/min',
    modelId: 'bulbul:v3',
    provider: 'Sarvam AI · bulbul:v3',
    audioUrl: '/audio/priya.mp3',
    sample: 'नमस्ते! ट्रिवाना एआई में आपका स्वागत है। मैं आपकी वर्चुअल असिस्टेंट हूँ। आज मैं आपकी क्या मदद कर सकती हूँ?',
    tone: 'Empathetic · Clear · Polite',
  },
  {
    id: 'rohan',
    voiceId: 'rohan',
    voiceLabel: 'Rohan · Energetic & Crisp',
    name: 'Rohan · EdTech Counselor',
    lang: 'en-IN',
    languageLabel: 'Indian English',
    tier: 'Sarvam · ₹6.50/min',
    modelId: 'bulbul:v3',
    provider: 'Sarvam AI · bulbul:v3',
    audioUrl: '/audio/rohan.mp3',
    sample: "Hello! Welcome to Trivaana AI. I'm your virtual assistant. How can I help you today?",
    tone: 'Crisp · Energetic · Natural Cadence',
  },
  {
    id: 'kavya',
    voiceId: 'kavya',
    voiceLabel: 'Kavya · Bright & Expressive',
    name: 'Kavya · Financial Advisory',
    lang: 'ta-IN',
    languageLabel: 'Tamil (தமிழ்)',
    tier: 'Sarvam · ₹6.50/min',
    modelId: 'bulbul:v3',
    provider: 'Sarvam AI · bulbul:v3',
    audioUrl: '/audio/kavya.mp3',
    sample: 'வணக்கம்! ட்ரிவானா AI-க்கு உங்களை வரவேற்கிறோம். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?',
    tone: 'Trustworthy · Measured · Multilingual',
  },
  {
    id: 'sarvam-shubh',
    voiceId: 'shubh',
    voiceLabel: 'Shubh · Crisp & Confident (Male)',
    name: 'Shubh · Business Desk',
    lang: 'te-IN',
    languageLabel: 'Telugu (తెలుగు)',
    tier: 'Sarvam · ₹6.50/min',
    modelId: 'bulbul:v3',
    provider: 'Sarvam AI · bulbul:v3',
    audioUrl: '/audio/sarvam-shubh.mp3',
    sample: 'నమస్కారం, నేను త్రివాణ ఏఐ నుండి శుభ్ మాట్లాడుతున్నాను. ఈ రోజు మీ బిజినెస్ కాల్స్ కోసం నేను ఎలా సహాయం చేయగలను?',
    tone: 'Natural Indian Telugu · Clear · Expressive',
  },
  {
    id: 'ananya',
    voiceId: 'kavitha',
    voiceLabel: 'Kavitha · Warm & Fluent',
    name: 'Ananya · Bengaluru Desk',
    lang: 'kn-IN',
    languageLabel: 'Kannada (ಕನ್ನಡ)',
    tier: 'Sarvam · ₹6.50/min',
    modelId: 'bulbul:v3',
    provider: 'Sarvam AI · bulbul:v3',
    audioUrl: '/audio/how-kn-in.mp3',
    sample: 'ನಮಸ್ಕಾರ ಸ್ನೇಹಾ ಮೇಡಂ! ವೈಟ್‌ಫೀಲ್ಡ್ 2BHK ಬಗ್ಗೆ ಕರೆ ಮಾಡುತ್ತಿದ್ದೇನೆ. ಶನಿವಾರ ಸಂಜೆ 4 ಗಂಟೆಗೆ ಬರಬಹುದೇ?',
    tone: 'Natural Indian Kannada · Warm · Polite',
  },
];

export const VoiceShowcaseSection: React.FC<VoiceShowcaseSectionProps> = ({ onEnterDashboard }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingId(null);
    setIsPaused(false);
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = (profile: (typeof VOICE_PROFILES)[0]) => {
    setAudioError(null);
    if (playingId === profile.id && audioRef.current) {
      if (isPaused) {
        audioRef.current.play().then(() => setIsPaused(false)).catch(() => {
          setAudioError(`Unable to resume audio for ${profile.name}.`);
          stopAudio();
        });
      } else {
        audioRef.current.pause();
        setIsPaused(true);
      }
      return;
    }
    stopAudio();
    setPlayingId(profile.id);
    setIsPaused(false);
    setProgress(0);

    try {
      const audio = new Audio(profile.audioUrl);
      audioRef.current = audio;
      audio.ontimeupdate = () => {
        if (audio.duration && Number.isFinite(audio.duration)) {
          setProgress(Math.min(100, Math.round((audio.currentTime / audio.duration) * 100)));
        }
      };
      audio.onended = () => {
        setPlayingId(null);
        setIsPaused(false);
        setProgress(0);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setAudioError(`Real Sarvam AI audio asset (${profile.audioUrl}) failed to load.`);
        setPlayingId(null);
        setIsPaused(false);
        audioRef.current = null;
      };
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err: any) => {
          setAudioError(err?.message || `Playback blocked for ${profile.name}.`);
          setPlayingId(null);
          setIsPaused(false);
        });
      }
    } catch (err: any) {
      setAudioError(err?.message || 'Audio playback failed.');
      setPlayingId(null);
    }
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
        {audioError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 text-center">
            {audioError}
          </div>
        )}
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

                    {active && (
                      <div className="w-full h-1.5 rounded-full bg-[#e4e4e9] overflow-hidden">
                        <div
                          className="h-full bg-[#ff5500] transition-all duration-150"
                          style={{ width: `${Math.max(8, progress)}%` }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <VoicePill
                        active={active && !isPaused}
                        onClick={() => togglePlay(vp)}
                        label={active ? (isPaused ? 'Resume audio' : 'Pause audio') : 'Hear voice sample'}
                      />
                      <span className="text-[10px] font-mono text-[#6e6e7e]">
                        {vp.modelId} · {vp.voiceId.slice(0, 8)}…
                      </span>
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
