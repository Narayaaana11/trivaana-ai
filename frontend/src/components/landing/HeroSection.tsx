import React, { useEffect, useRef, useState } from 'react';
import {
  BlurText,
  GradientText,
  RotatingText,
  ShinyText,
  StatusMark,
  StarBorder,
  ClickSpark,
  Magnet,
  AuroraBackground,
  GlareHover,
  TextType,
  VoicePill,
  LogoLoop,
} from '@/components/reactbits';
import BRAND from '@/lib/brand';
import {
  ArrowRight,
  Sparkles,
  Volume2,
  ShieldCheck,
  Zap,
  PhoneForwarded,
  PhoneIncoming,
  Mic,
  MicOff,
} from 'lucide-react';

interface HeroSectionProps {
  onEnterDashboard: () => void;
  onOpenSimulator: () => void;
}

const QUICK_PROMPT_PILLS: {
  label: string;
  mode: 'instant' | 'bulk' | 'inbound';
  lang: string;
  prompt: string;
}[] = [
  {
    label: 'Remind about renewals',
    mode: 'bulk',
    lang: 'hi-IN',
    prompt:
      'Call annual SaaS & gym members 7 days before expiry in Hindi and English, answer pricing FAQs, and send the UPI renewal link on WhatsApp.',
  },
  {
    label: 'Call new property leads',
    mode: 'instant',
    lang: 'te-IN',
    prompt:
      'Call new 2BHK & 3BHK real estate enquiries in Telugu within 30 seconds, confirm preferred locality & budget, and book a weekend site visit on Calendar.',
  },
  {
    label: 'Remind patients',
    mode: 'inbound',
    lang: 'te-IN',
    prompt:
      'Remind dental and orthopedic patients 24 hours before their OPD slot, confirm attendance, or reschedule cleanly on Google Calendar.',
  },
  {
    label: 'Wake up an old list',
    mode: 'bulk',
    lang: 'ta-IN',
    prompt:
      'Dial cold CRM leads from the last 90 days with a festive upgrade offer, qualify buying intent, and tag hot prospects for callbacks.',
  },
  {
    label: 'Book test drives',
    mode: 'instant',
    lang: 'en-IN',
    prompt:
      'Call EV & SUV website inquiries in under 30 seconds, confirm showroom branch preference, and schedule a home test drive slot.',
  },
];

const HERO_PRESET_PROMPTS: Record<'instant' | 'bulk' | 'inbound', string> = {
  instant:
    'Call new 2BHK & 3BHK real estate enquiries in Telugu within 30 seconds, confirm preferred locality & budget, and book a weekend site visit on Calendar.',
  bulk:
    'Dial 1,000+ past coaching enquiries in Hindi, invite parents to Sunday’s free NEET 2027 diagnostic test, and send the test link on WhatsApp.',
  inbound:
    'Answer incoming clinic reception calls 24×7 in Telugu, Hindi, and English, handle OP timing FAQs from the knowledge base, and transfer urgent callers.',
};

const SAMPLE_VOICE_LINES: Record<string, string> = {
  'te-IN':
    'నమస్కారం వెంకట్ గారు! త్రివాణా ఏఐ నుండి మాట్లాడుతున్నాను. మీరు మన విల్లాస్ గురించి ఎంక్వైరీ చేశారు కదా? శనివారం సైట్ విజిట్ బుక్ చేద్దామా?',
  'hi-IN':
    'नमस्ते सुनीता जी! त्रिवणा एआई से बोल रही हूँ। आपकी NEET 2027 स्कॉलरशिप टेस्ट इस रविवार सुबह 10 बजे है।',
  'en-IN':
    'Hello Vikram! I am calling from Trivaana AI regarding your luxury SUV test drive request. Shall I confirm tomorrow at 11 AM?',
  'ta-IN':
    'வணக்கம்! திரிவாணா ஏஐ-இல் இருந்து பேசுகிறேன். உங்கள் நேரடி டெமோவை நாளை காலை 11 மணிக்கு உறுதி செய்யலாமா?',
  'kn-IN':
    'ನಮಸ್ಕಾರ! ತ್ರಿವಾಣಾ AI ನಿಂದ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ. ನಿಮ್ಮ ಪ್ರಾಜெಕ್ಟ್ ಭೇಟಿಯನ್ನು ಶನಿವಾರ ಬೆಳಿಗ್ಗೆ ನಿಗದಿಪಡಿಸಲೇ?',
  'ml-IN':
    'നമസ്കാരം! ട്രിവാണ എഐയിൽ നിന്നാണ് വിളിക്കുന്നത്. നാളെ രാവിലെ 11 മണിക്ക് ഡെമോ ബുക്ക് ചെയ്യട്ടെ?',
  'mr-IN':
    'नमस्कार! मी त्रिवाणा एआय मधून बोलत आहे. शनिवारच्या साइट व्हिजिटची वेळ कन्फर्म करू का?',
};

const ECOSYSTEM_LOGOS = [
  { name: 'Exotel', tag: 'India PSTN' },
  { name: 'Plivo', tag: 'SIP & Voice' },
  { name: 'Vobiz', tag: 'Trunking' },
  { name: 'Twilio', tag: 'Global Voice' },
  { name: 'Sarvam AI', tag: 'Bulbul v3' },
  { name: 'ElevenLabs', tag: 'Flash v2.5' },
  { name: 'LiveKit Agents', tag: 'WebRTC' },
  { name: 'Razorpay', tag: 'UPI & GST' },
  { name: 'WhatsApp Cloud', tag: 'Templates' },
  { name: 'Google Calendar', tag: 'Live Booking' },
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  onEnterDashboard,
  onOpenSimulator,
}) => {
  const [selectedMode, setSelectedMode] = useState<'instant' | 'bulk' | 'inbound'>('instant');
  const [selectedLang, setSelectedLang] = useState('te-IN');
  const [promptInput, setPromptInput] = useState(HERO_PRESET_PROMPTS.instant);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleModeSwitch = (mode: 'instant' | 'bulk' | 'inbound') => {
    setSelectedMode(mode);
    setPromptInput(HERO_PRESET_PROMPTS[mode]);
  };

  const handleQuickPill = (pill: (typeof QUICK_PROMPT_PILLS)[number]) => {
    setSelectedMode(pill.mode);
    setSelectedLang(pill.lang);
    setPromptInput(pill.prompt);
    setVoiceHint(null);
  };

  const handleDictatePrompt = () => {
    setVoiceHint(null);
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceHint('Microphone dictation requires Chrome/Edge — try selecting a quick prompt above or typing directly.');
      return;
    }

    if (isListeningVoice) {
      setIsListeningVoice(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = selectedLang || 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsListeningVoice(true);
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setPromptInput(transcript);
        }
        setIsListeningVoice(false);
      };
      recognition.onerror = () => {
        setIsListeningVoice(false);
        setVoiceHint('Could not capture audio — check mic permissions or edit the prompt directly.');
      };
      recognition.onend = () => setIsListeningVoice(false);
      recognition.start();
    } catch {
      setIsListeningVoice(false);
      setVoiceHint('Microphone unavailable in this browser context.');
    }
  };

  const handlePlayVoice = () => {
    setVoiceHint(null);
    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlayingAudio(false);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audioUrl = `/audio/how-${(selectedLang || 'en-IN').toLowerCase()}.mp3`;
    try {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setIsPlayingAudio(true);
      audio.onended = () => {
        setIsPlayingAudio(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setVoiceHint(`ElevenLabs voice sample (${audioUrl}) failed to load.`);
        setIsPlayingAudio(false);
        audioRef.current = null;
      };
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err: any) => {
          setVoiceHint(err?.message || 'Audio playback blocked.');
          setIsPlayingAudio(false);
        });
      }
    } catch (err: any) {
      setVoiceHint(err?.message || 'Audio playback failed.');
      setIsPlayingAudio(false);
    }
  };

  const handleBuildEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(
      'trivaana_landing_draft',
      JSON.stringify({
        prompt: promptInput,
        language: selectedLang,
        mode: selectedMode,
      })
    );
    onEnterDashboard();
  };

  return (
    <section className="bg-outpero-grid relative overflow-hidden pt-12 pb-14 md:pt-16 md:pb-20 border-b border-[#e4e4e9]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Outpero Style Eyebrow Pill with ReactBits StatusMark & ShinyText */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#e4e4e9] text-xs text-[#0f0f14] mb-6 font-semibold shadow-2xs">
          <StatusMark status="busy" />
          <ShinyText
            text="AI TELECALLING SOFTWARE"
            color="#525260"
            shineColor="#ff5500"
            speed={3}
            className="tracking-wide uppercase text-[11px] font-semibold"
          />
          <span className="text-[#d4d4dc]">·</span>
          <span className="text-[#ff5500] font-bold">From ₹6.50/min</span>
        </div>

        {/* Display Headline with BlurText, GradientText & RotatingText */}
        <h1 className="font-display text-4xl sm:text-6xl font-extrabold text-[#0f0f14] tracking-[-0.03em] leading-[1.08] flex flex-col items-center">
          <BlurText text="AI telecalling software." delay={45} className="justify-center" />
          <GradientText className="mt-1">
            India&apos;s most natural-sounding voices.
          </GradientText>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-[#525260] max-w-2xl mx-auto leading-relaxed">
          Deploy AI employees that call{' '}
          <RotatingText
            texts={['in under 30 seconds', 'across 7 Indian languages', '1,000+ leads in parallel', 'incoming callers 24×7']}
            className="font-bold text-[#0f0f14] underline decoration-[#ff5500]/50 underline-offset-4"
          />{' '}
          and book qualified appointments straight to your calendar.
        </p>

        {/* Secondary Actions with ReactBits StarBorder, ClickSpark & Magnet */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <ClickSpark>
            <Magnet padding={40} magnetStrength={2.5}>
              <StarBorder>
                <button
                  type="button"
                  onClick={onEnterDashboard}
                  className="px-6 py-3 rounded-full bg-[#ff5500] hover:bg-[#ea580c] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-[#ff5500]/20 cursor-pointer transition-colors"
                >
                  <span>Start free (₹500 Demo Wallet)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </StarBorder>
            </Magnet>
          </ClickSpark>
          <button
            type="button"
            onClick={onOpenSimulator}
            className="px-6 py-3 rounded-full bg-white hover:bg-[#f6f6f8] border border-[#e4e4e9] text-[#0f0f14] font-semibold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
          >
            <Volume2 className="w-4 h-4 text-[#ff5500]" />
            <span>Try interactive voice sandbox</span>
          </button>
        </div>

        {/* Outpero Centered Dark Prompt Builder with AuroraBackground & GlareHover */}
        <GlareHover className="mt-10 rounded-[26px] shadow-2xl">
          <AuroraBackground className="text-left rounded-[26px] bg-outpero-dark-card border border-white/10">
            <form onSubmit={handleBuildEmployee} className="p-5 sm:p-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[#ff8547] text-[11px] font-bold">
                    <Sparkles className="w-3 h-3" />
                    <span>Prompt Architect</span>
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-white">
                    What should your AI telecaller do?
                  </span>
                  <TextType
                    strings={['Zero flowchart wiring needed.', 'Builds questions, script & CRM extraction.']}
                    className="text-[11px] text-slate-400 hidden sm:inline-flex"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">in</span>
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value)}
                    aria-label="Select AI employee language"
                    className="px-3 py-1.5 rounded-full bg-[#1b1824] border border-white/15 text-xs font-semibold text-white cursor-pointer"
                  >
                    {BRAND.languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name} ({l.nativeName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3-Tab Mode Selector inside Dark Card */}
              <div className="grid grid-cols-3 gap-1.5 bg-[#121019]/90 p-1 rounded-2xl border border-white/10 text-xs">
                {[
                  { id: 'instant', label: 'Instant leads', icon: Zap },
                  { id: 'bulk', label: 'Bulk campaigns', icon: PhoneForwarded },
                  { id: 'inbound', label: 'Inbound reception', icon: PhoneIncoming },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = selectedMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleModeSwitch(tab.id as any)}
                      className={`py-2 px-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        active ? 'bg-[#ff5500] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Prompt Editor */}
              <div className="rounded-2xl bg-[#1b1824] border border-white/12 p-4 space-y-3">
                <textarea
                  rows={3}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                  placeholder="Describe what your AI employee should ask, qualify, and book..."
                />

                {/* 5 Quick Prompt Pills (Outpero Parity) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {QUICK_PROMPT_PILLS.map((pill) => {
                    const isSelected = promptInput === pill.prompt;
                    return (
                      <button
                        key={pill.label}
                        type="button"
                        onClick={() => handleQuickPill(pill)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#ff5500]/20 text-[#ff8547] border-[#ff5500]/40'
                            : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>

                {voiceHint && (
                  <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded-lg px-2.5 py-1.5">
                    {voiceHint}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <VoicePill
                      active={isPlayingAudio}
                      onClick={handlePlayVoice}
                      label={isPlayingAudio ? 'Stop voice sample' : `Hear sample (${selectedLang})`}
                      className="!bg-white/10 !text-white !border-white/15 hover:!bg-white/15"
                    />
                    <button
                      type="button"
                      onClick={handleDictatePrompt}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        isListeningVoice
                          ? 'bg-[#ff5500] text-white border-[#ff5500] animate-pulse'
                          : 'bg-white/10 text-slate-200 border-white/15 hover:bg-white/15'
                      }`}
                    >
                      {isListeningVoice ? (
                        <MicOff className="w-3.5 h-3.5" />
                      ) : (
                        <Mic className="w-3.5 h-3.5 text-[#ff8547]" />
                      )}
                      <span>{isListeningVoice ? 'Listening…' : 'Describe it by voice'}</span>
                    </button>
                  </div>

                  <ClickSpark>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white hover:bg-[#fff7ed] text-[#121019] text-xs font-extrabold shadow-lg cursor-pointer transition-colors"
                    >
                      <span>Build my employee</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </ClickSpark>
                </div>
              </div>

              {/* Compliance Proof Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  TRAI TCCCPR 10 AM – 6 PM &amp; DND Scrubbing enforced automatically
                </span>
                <span>Pay only for connected talk time · Unanswered calls ₹0</span>
              </div>
            </form>
          </AuroraBackground>
        </GlareHover>

        {/* Outpero Trust Line Below Dark Prompt Builder */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs font-medium text-[#525260]">
          <span className="font-semibold text-[#0f0f14]">Trusted by 5,000+ businesses</span>
          <span className="text-[#c5c5d0]">·</span>
          <span>50 free credits</span>
          <span className="text-[#c5c5d0]">·</span>
          <span>No card required</span>
          <span className="text-[#c5c5d0]">·</span>
          <span className="text-[#ff5500] font-semibold">From ₹6.50 per minute</span>
        </div>

        {/* ReactBits LogoLoop Ecosystem Ticker */}
        <div className="mt-10 pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8a98] mb-3">
            Connected Telephony, AI Voice &amp; Payment Stack
          </div>
          <LogoLoop items={ECOSYSTEM_LOGOS} />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
