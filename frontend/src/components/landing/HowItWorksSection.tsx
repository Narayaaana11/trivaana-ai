import React, { useEffect, useRef, useState } from 'react';
import { VoicePill, StatusMark } from '@/components/reactbits';
import { PhoneCall, CheckCircle2, Calendar, MessageSquare, Database, ArrowRight } from 'lucide-react';

interface HowItWorksSectionProps {
  onEnterDashboard: () => void;
}

const SCRIPT_DEMOS = [
  {
    code: 'hi-IN',
    native: 'हिन्दी',
    lead: 'Aman Verma',
    source: '+91 98••• ••210 · Meta ad · Noida',
    langTag: 'Hindi + English',
    lookingFor: '2BHK, Sector 150',
    purpose: 'To live in',
    budget: '~₹90L',
    visit: 'Sat, 11:00 AM',
    summary: 'Wants a 2BHK in Sector 150, Noida to live in, around ₹90L. Site visit booked for Saturday 11 AM; location sent on WhatsApp.',
    bubbles: [
      { who: 'ai', text: 'नमस्ते अमन जी! नेक्स्ट रियलिटी नोएडा से मीरा बोल रही हूँ। आपने Sector 150 में 2BHK के लिए इन्क्वायरी की थी?' },
      { who: 'user', text: 'हाँ, बजट करीब ₹90 लाख है। शनिवार सुबह देख सकते हैं क्या?' },
      { who: 'ai', text: 'बिल्कुल सर! शनिवार 11:00 AM का विज़िट बुक कर दिया है और लोकेशन WhatsApp पर भेज दी है।' },
    ],
  },
  {
    code: 'te-IN',
    native: 'తెలుగు',
    lead: 'K. Venkat Rao',
    source: '+91 98480 ••345 · 99acres · Hyderabad',
    langTag: 'Telugu + English',
    lookingFor: '3BHK Villa, Kokapet',
    purpose: 'Family Residence',
    budget: '₹1.4 Cr',
    visit: 'Sat, 11:00 AM',
    summary: 'Confirmed 3BHK East-facing villa requirement in Kokapet around ₹1.4 Cr. Weekend site visit scheduled with WhatsApp pin.',
    bubbles: [
      { who: 'ai', text: 'నమస్కారం వెంకట్ గారు! కోకాపేట్ గేటెడ్ విల్లాస్ గురించి కాల్ చేస్తున్నాను. శనివారం సైట్ విజిట్ ప్లాన్ చేద్దామా?' },
      { who: 'user', text: 'అవునండి, ₹1.4 కోట్ల బడ్జెట్‌లో 3BHK చూడాలి. శనివారం 11 గంటలకు వస్తాను.' },
      { who: 'ai', text: 'సూపర్ సర్! శనివారం ఉదయం 11:00కి స్లాట్ బుక్ చేసి, గూగుల్ మ్యాప్స్ పిన్ వాట్సాప్‌లో పంపించాను.' },
    ],
  },
  {
    code: 'ta-IN',
    native: 'தமிழ்',
    lead: 'Karthik Subramanian',
    source: '+91 98401 ••912 · Website form · Chennai',
    langTag: 'Tamil + English',
    lookingFor: '3BHK Flat, OMR',
    purpose: 'Investment',
    budget: '₹1.1 Cr',
    visit: 'Sun, 10:30 AM',
    summary: 'Interested in OMR Phase-II 3BHK unit around ₹1.1 Cr; Sunday 10:30 AM walkthrough confirmed.',
    bubbles: [
      { who: 'ai', text: 'வணக்கம் கார்த்திக் சார்! OMR 3BHK புராஜெக்ட் பற்றி பேசுகிறேன். ஞாயிறு காலை நேரில் பார்க்கலாமா?' },
      { who: 'user', text: 'ஆம், ₹1.1 கோடி பட்ஜெட்டில் ஞாயிறு 10:30க்கு வரலாம்.' },
      { who: 'ai', text: 'நன்றி சார்! ஞாயிறு 10:30 AM கன்ஃபார்ம் ஆகிவிட்டது, விவரங்கள் WhatsApp-இல் அனுப்பியுள்ளேன்.' },
    ],
  },
  {
    code: 'kn-IN',
    native: 'ಕನ್ನಡ',
    lead: 'Sneha Kulkarni',
    source: '+91 99001 ••440 · Google Form · Bengaluru',
    langTag: 'Kannada + English',
    lookingFor: '2BHK, Whitefield',
    purpose: 'Self-Use',
    budget: '₹85L',
    visit: 'Sat, 4:00 PM',
    summary: 'Looking for Whitefield 2BHK under ₹90L. Confirmed Saturday 4 PM visit and calendar invite.',
    bubbles: [
      { who: 'ai', text: 'ನಮಸ್ಕಾರ ಸ್ನೇಹಾ ಮೇಡಂ! ವೈಟ್‌ಫೀಲ್ಡ್ 2BHK ಬಗ್ಗೆ ಕರೆ ಮಾಡುತ್ತಿದ್ದೇನೆ. ಶನಿವಾರ ಸಂಜೆ 4 ಗಂಟೆಗೆ ಬರಬಹುದೇ?' },
      { who: 'user', text: 'ಹೌದು, ಶನಿವಾರ 4 ಗಂಟೆಗೆ ಸರಿ ಆಗುತ್ತದೆ.' },
      { who: 'ai', text: 'ಧನ್ಯವಾದಗಳು! ಶನಿವಾರ 4:00 PM ನಿಗದಿಯಾಗಿದೆ, ಲೊಕೇಶನ್ WhatsApp ಕಳುಹಿಸಿದ್ದೇನೆ.' },
    ],
  },
  {
    code: 'ml-IN',
    native: 'മലയാളം',
    lead: 'Arjun Nair',
    source: '+91 94471 ••620 · Instant Ad · Kochi',
    langTag: 'Malayalam',
    lookingFor: 'Waterfront 3BHK, Edappally',
    purpose: 'NRI Home',
    budget: '₹1.25 Cr',
    visit: 'Tomorrow, 11:00 AM',
    summary: 'NRI buyer evaluating waterfront 3BHK in Edappally; video walkthrough booked for tomorrow 11 AM.',
    bubbles: [
      { who: 'ai', text: 'നമസ്കാരം അർജുൻ! ഇടപ്പള്ളിയിലെ 3BHK വില്ലകളെക്കുറിച്ച് വിളിക്കുകയാണ്. നാളെ 11 മണിക്ക് വീഡിയോ ടൂർ ബുക്ക് ചെയ്യട്ടെ?' },
      { who: 'user', text: 'അതെ, നാളെ രാവിലെ 11 മണിക്ക് സൗകര്യമാണ്.' },
      { who: 'ai', text: 'ശരി സർ! നാളെ 11:00 AM-ന് സ്ലോട്ട് ബുക്ക് ചെയ്തു, ലിങ്ക് വാട്‌സാപ്പിൽ അയച്ചിട്ടുണ്ട്.' },
    ],
  },
  {
    code: 'mr-IN',
    native: 'मराठी',
    lead: 'Pratik Deshmukh',
    source: '+91 98220 ••715 · MagicBricks · Pune',
    langTag: 'Marathi + English',
    lookingFor: '3BHK, Baner',
    purpose: 'Family Upgrade',
    budget: '₹1.35 Cr',
    visit: 'Sat, 11:30 AM',
    summary: 'Family upgrade to 3BHK in Baner, Pune; confirmed Saturday 11:30 AM site tour.',
    bubbles: [
      { who: 'ai', text: 'नमस्कार प्रतीक जी! बाणेर येथील 3BHK प्रकल्पाबद्दल बोलत आहे. शनिवारी सकाळी ११:३० ला साइट व्हिजिट ठरवूया का?' },
      { who: 'user', text: 'हो, शनिवार सकाळी ११:३० चालेल.' },
      { who: 'ai', text: 'धन्यवाद सर! तुमची व्हिजिट बुक झाली आहे आणि लोकेशन WhatsApp वर पाठवले आहे.' },
    ],
  },
  {
    code: 'en-IN',
    native: 'English',
    lead: 'Rohan Malhotra',
    source: '+91 98114 ••889 · Website Demo · Mumbai',
    langTag: 'Indian English',
    lookingFor: 'Enterprise 20 Lines',
    purpose: 'Sales Automation',
    budget: 'Growth Plan',
    visit: 'Thu, 3:00 PM',
    summary: 'SaaS VP evaluated 20 concurrent AI calling lines with Exotel SIP; live onboarding booked Thursday 3 PM.',
    bubbles: [
      { who: 'ai', text: 'Hi Rohan! Calling from Trivaana AI regarding your request for 20 concurrent AI telecalling lines.' },
      { who: 'user', text: 'Great, can we review Exotel KYC and webhook payload on Thursday 3 PM?' },
      { who: 'ai', text: 'Done! Sent the calendar invite for Thursday 3 PM along with our API quickstart link on WhatsApp.' },
    ],
  },
];

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({ onEnterDashboard }) => {
  const [activeCode, setActiveCode] = useState('hi-IN');
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeDemo = SCRIPT_DEMOS.find((d) => d.code === activeCode) || SCRIPT_DEMOS[0];

  const stopDemoAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlaying(false);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleHearDemo = () => {
    setAudioError(null);
    if (playing) {
      stopDemoAudio();
      return;
    }
    stopDemoAudio();
    const audioUrl = `/audio/how-${activeDemo.code.toLowerCase()}.mp3`;
    try {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setPlaying(true);
      audio.onended = () => {
        setPlaying(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setAudioError(`ElevenLabs call sample (${audioUrl}) failed to load.`);
        setPlaying(false);
        audioRef.current = null;
      };
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err: any) => {
          setAudioError(err?.message || 'Unable to play call sample.');
          setPlaying(false);
        });
      }
    } catch (err: any) {
      setAudioError(err?.message || 'Audio playback failed.');
      setPlaying(false);
    }
  };

  return (
    <section id="how-it-works" className="py-20 bg-[#f6f6f8] border-b border-[#e4e4e9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-3">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0f0f14] tracking-tight">
            How it works
          </h2>
          {/* 7-Script Outpero Switcher */}
          <div className="inline-flex flex-wrap justify-center gap-1.5 bg-white p-1.5 rounded-2xl border border-[#e4e4e9] shadow-2xs">
            {SCRIPT_DEMOS.map((demo) => {
              const selected = demo.code === activeCode;
              return (
                <button
                  key={demo.code}
                  type="button"
                  onClick={() => {
                    stopDemoAudio();
                    setAudioError(null);
                    setActiveCode(demo.code);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    selected
                      ? 'bg-[#0f0f14] text-white shadow-xs'
                      : 'text-[#525260] hover:text-[#0f0f14] hover:bg-[#f6f6f8]'
                  }`}
                >
                  {demo.native}
                </button>
              );
            })}
          </div>
        </div>

        {/* Outpero Split Mockup: Left iPhone Call Card + Right CRM Conversation Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Phone Call Frame */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[330px] rounded-[34px] bg-[#121019] text-white p-5 border-4 border-[#272436] shadow-2xl space-y-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <StatusMark status="online" /> Connected · 00:42
                </span>
                <span>{activeDemo.langTag}</span>
              </div>

              <div className="text-center py-2 border-b border-white/10">
                <div className="w-11 h-11 rounded-full bg-[#ff5500]/20 border border-[#ff5500]/50 text-[#ff8547] mx-auto flex items-center justify-center mb-2">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div className="font-display font-bold text-base">{activeDemo.lead}</div>
                <div className="text-[11px] text-slate-400">{activeDemo.source}</div>
              </div>

              <div className="space-y-2.5 text-xs max-h-60 overflow-y-auto pr-1">
                {activeDemo.bubbles.map((b, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl leading-relaxed ${
                      b.who === 'ai'
                        ? 'bg-[#1b1824] border border-white/10 text-slate-100'
                        : 'bg-[#ff5500]/20 border border-[#ff5500]/30 text-orange-100 ml-5'
                    }`}
                  >
                    <div className="text-[9px] uppercase font-bold opacity-65 mb-1">
                      {b.who === 'ai' ? 'Trivaana AI' : activeDemo.lead}
                    </div>
                    {b.text}
                  </div>
                ))}
              </div>

              <div className="pt-2 flex flex-col items-center gap-1.5">
                <VoicePill
                  active={playing}
                  onClick={handleHearDemo}
                  label={playing ? 'Stop call audio' : 'Hear a live call'}
                  className="!bg-white !text-[#0f0f14]"
                />
                <span className="text-[10px] font-mono text-slate-400">ElevenLabs · eleven_v4_turbo</span>
                {audioError && <span className="text-[11px] text-red-400 text-center">{audioError}</span>}
              </div>
            </div>
          </div>

          {/* Right CRM Extraction & Output Card */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-[#e4e4e9] shadow-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e4e4e9] flex flex-wrap items-center justify-between gap-2 bg-[#fcfcfd]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#525260]">
                <span className="font-display font-extrabold text-[#0f0f14]">Trivaana AI</span>
                <span>·</span>
                <span>Conversations</span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> {activeDemo.visit} Confirmed
              </span>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-display text-lg font-extrabold text-[#0f0f14]">{activeDemo.lead}</div>
                  <div className="text-[#6e6e7e]">{activeDemo.source}</div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#fff7ed] border border-[#fed7aa] text-[#c2410c] font-bold">
                  {activeDemo.langTag}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9]">
                  <div className="text-[10px] uppercase font-bold text-[#8a8a98]">Looking for</div>
                  <div className="font-bold text-[#0f0f14] mt-0.5">{activeDemo.lookingFor} ✓</div>
                </div>
                <div className="p-3 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9]">
                  <div className="text-[10px] uppercase font-bold text-[#8a8a98]">Purpose</div>
                  <div className="font-bold text-[#0f0f14] mt-0.5">{activeDemo.purpose} ✓</div>
                </div>
                <div className="p-3 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9]">
                  <div className="text-[10px] uppercase font-bold text-[#8a8a98]">Budget</div>
                  <div className="font-bold text-[#0f0f14] mt-0.5">{activeDemo.budget} ✓</div>
                </div>
                <div className="p-3 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9]">
                  <div className="text-[10px] uppercase font-bold text-[#8a8a98]">Scheduled</div>
                  <div className="font-bold text-emerald-700 mt-0.5">{activeDemo.visit} ✓</div>
                </div>
              </div>

              <p className="p-3.5 rounded-xl bg-[#fcfcfd] border border-[#e4e4e9] text-[#525260] leading-relaxed">
                {activeDemo.summary}
              </p>

              <div className="pt-2 border-t border-[#e4e4e9] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-[#8a8a98]">Outputs to:</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    <MessageSquare className="w-3 h-3" /> WhatsApp Sent
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-[#c2410c] font-semibold border border-[#fed7aa]">
                    <Calendar className="w-3 h-3" /> Calendar Booked
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-[#0f0f14] font-semibold border border-[#e4e4e9]">
                    <Database className="w-3 h-3" /> CRM Updated
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onEnterDashboard}
                  className="text-xs font-bold text-[#ff5500] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  Open Conversations <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

