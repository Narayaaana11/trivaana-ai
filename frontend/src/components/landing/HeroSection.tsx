import React, { useState } from 'react';
import BRAND from '@/lib/brand';
import { BlurText, ShinyText, Magnet, SpotlightCard } from '@/components/reactbits';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import {
  Play,
  Square,
  ArrowRight,
  Zap,
  PhoneCall,
  ShieldCheck,
  CheckCircle2,
  Clock,
  TrendingDown,
  Volume2
} from 'lucide-react';

interface HeroSectionProps {
  onEnterDashboard: () => void;
  onOpenSimulator: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onEnterDashboard,
  onOpenSimulator,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<'te' | 'hi' | 'en'>('te');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const sampleTexts = {
    te: "నమస్కారం వెంకట్ గారు! త్రివాణా ఏఐ నుండి మాట్లాడుతున్నాను. మీరు మన లగ్జరీ గేటెడ్ విల్లాస్ గురించి ఎంక్వైరీ చేశారు కదా? ఈ శనివారం సైట్ విజిట్ ప్లాన్ చేసుకుందామా?",
    hi: "नमस्ते सुनीता जी! त्रिवणा एआई से बोल रही हूँ। आपकी बेटी के NEET 2027 की तैयारी के लिए फ्री स्कॉलरशिप टेस्ट इस रविवार सुबह 10 बजे है।",
    en: "Hello Vikram! I am an AI advisor calling from Trivaana AI. We received your request for an enterprise test drive. Can we confirm tomorrow at 11 AM?"
  };

  const handlePlayVoice = (lang: 'te' | 'hi' | 'en') => {
    setSelectedLanguage(lang);
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(sampleTexts[lang]);
      utterance.rate = 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      setIsPlayingAudio(true);
      window.speechSynthesis.speak(utterance);
    } else {
      alert('SpeechSynthesis not supported in this browser.');
    }
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32 bg-white text-slate-900 border-b border-slate-200/80">
      <BackgroundPattern variant="hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200/90 text-xs text-orange-900 mb-6 font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse"></span>
            <ShinyText
              text="India's Most Natural-Sounding Voice Agents"
              color="#9a3412"
              shineColor="#ff5500"
              speed={2.5}
              className="font-semibold text-xs"
            />
            <span className="text-orange-300">|</span>
            <span className="text-orange-900 font-bold">From ₹3.20/min</span>
          </div>

          {/* Primary Headline with BlurText Reveal */}
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-slate-950 tracking-tight leading-[1.1] flex flex-col items-center justify-center">
              <BlurText
                text="Voice Agents That Call Every Lead in"
                delay={60}
                className="justify-center"
              />
              <span className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 bg-clip-text text-transparent mt-1">
                Under 30 Seconds
              </span>
            </h1>
          </div>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Work through contact lists, answer customer inbound calls 24/7, in seven Indian vernacular languages. Connects instant lead ads directly to qualified revenue demo bookings.
          </p>

          {/* Dual Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Magnet padding={50} magnetStrength={3}>
              <button
                onClick={onEnterDashboard}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-orange-600/25 cursor-pointer"
              >
                <span>Launch Mission Control (50 Free Credits)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Magnet>

            <button
              onClick={onOpenSimulator}
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-300 hover:bg-slate-50 active:scale-[0.98] text-slate-800 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer bg-white shadow-xs"
            >
              <Play className="w-4 h-4 text-orange-600" />
              <span>Live Dialpad Simulator</span>
            </button>
          </div>

          {/* Outpero Comparison & Interactive Dialect Preview Card */}
          <div className="mt-14 max-w-4xl mx-auto">
            <SpotlightCard className="p-6 sm:p-8 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl text-left">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                      Live Telecalling Engine
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Sub-250ms Latency
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Try Instant Vernacular Speech Preview
                  </h3>
                </div>

                {/* Dialect Selector Chips */}
                <div className="flex items-center gap-2">
                  {[
                    { id: 'te', label: 'Telugu (తెలుగు)' },
                    { id: 'hi', label: 'Hindi (हिन्दी)' },
                    { id: 'en', label: 'Indian English' },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => handlePlayVoice(lang.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                        selectedLanguage === lang.id
                          ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sample Transcript Preview Box */}
              <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0 mt-0.5">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      {selectedLanguage === 'te' ? 'Telugu Real Estate Persona' : selectedLanguage === 'hi' ? 'Hindi Healthcare Persona' : 'English Corporate Persona'}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-800 font-medium mt-0.5 leading-relaxed">
                      "{sampleTexts[selectedLanguage]}"
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handlePlayVoice(selectedLanguage)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                    isPlayingAudio
                      ? 'bg-rose-50 text-rose-700 border border-rose-300'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                >
                  {isPlayingAudio ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isPlayingAudio ? 'Stop Preview' : 'Play Audio'}
                </button>
              </div>

              {/* 3 Metric Value Pillars */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-100">
                  <div className="text-xl font-extrabold text-orange-600 font-mono">11.4s</div>
                  <div className="text-xs text-slate-600 font-semibold mt-0.5">Automated Speed-to-Lead</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <div className="text-xl font-extrabold text-emerald-700 font-mono">24.8%</div>
                  <div className="text-xs text-slate-600 font-semibold mt-0.5">Demo Conversion Rate</div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                  <div className="text-xl font-extrabold text-blue-700 font-mono">85.6%</div>
                  <div className="text-xs text-slate-600 font-semibold mt-0.5">Cost Savings vs Manual BPO</div>
                </div>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </BackgroundPattern>
    </section>
  );
};

export default HeroSection;
