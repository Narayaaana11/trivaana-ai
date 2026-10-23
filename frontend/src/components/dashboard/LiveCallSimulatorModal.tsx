import React, { useState } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
} from 'lucide-react';
import BRAND from '@/lib/brand';

interface LiveCallSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveCallSimulatorModal: React.FC<LiveCallSimulatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeLang, setActiveLang] = useState<'te' | 'hi' | 'en'>('te');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [dialedDigits, setDialedDigits] = useState('9848022338');
  const [isMuted, setIsMuted] = useState(false);
  const [conversation, setConversation] = useState<{ sender: 'ai' | 'user'; text: string }[]>([]);

  if (!isOpen) return null;

  const DIALOGUES: Record<'te' | 'hi' | 'en', Array<{ sender: 'ai' | 'user'; text: string }>> = {
    te: [
      { sender: 'ai', text: 'నమస్కారం వెంకట్ గారు! త్రివాణా ఏఐ రియల్ ఎస్టేట్ అడ్వైజర్ నుండి మాట్లాడుతున్నాను. మీరు మన హైటెక్ సిటీ విల్లాస్ బ్రోచర్ డౌన్‌లోడ్ చేశారు కదా?' },
      { sender: 'user', text: 'అవునండి, 3 BHK విల్లాస్ ప్రైస్ ఎంత రేంజ్ లో ఉంటుంది?' },
      { sender: 'ai', text: 'మన గేటెడ్ కమ్యూనిటీలో 3 BHK విల్లాస్ ₹1.85 Cr నుండి ప్రారంభం అవుతాయి. ఈ శనివారం ఉదయం 11 గంటలకు సైట్ విజిట్ ప్లాన్ చేద్దామా?' },
      { sender: 'user', text: 'సరే, శనివారం 11 గంటలకు ఓకే అండి.' },
      { sender: 'ai', text: 'చాలా ధన్యవాదాలు వెంకట్ గారు! మీ వాట్సాప్‌కి లొకేషన్ మరియు క్యాలెండర్ ఇన్వైట్ ఇప్పుడే పంపాను. శనివారం కలుద్దాం!' },
    ],
    hi: [
      { sender: 'ai', text: 'नमस्ते सुनीता जी! त्रिवणा एआई एडटेक टीम से बात कर रही हूँ। आपने अपनी बेटी के NEET 2027 के लिए इन्क्वायरी की थी।' },
      { sender: 'user', text: 'हाँ, क्या आपके पास वीकेंड टेस्ट सीरीज और डाउट सेशंस हैं?' },
      { sender: 'ai', text: 'बिल्कुल! हमारा फ्री नेशनल स्कॉलरशिप टेस्ट इस रविवार सुबह 10 बजे ऑनलाइन है। क्या मैं आपकी सीट कन्फर्म कर दूँ?' },
      { sender: 'user', text: 'हाँ, प्लीज रजिस्टर कर दीजिए।' },
      { sender: 'ai', text: 'धन्यवाद सुनीता जी! टेस्ट का लॉगिन लिंक आपके व्हाट्सएप पर तुरंत भेज दिया गया है।' },
    ],
    en: [
      { sender: 'ai', text: 'Hello Vikram! This is Trivaana AI calling regarding your enterprise telecalling consultation request.' },
      { sender: 'user', text: 'Hi! Can your voice agent handle mixed Telugu and English seamlessly?' },
      { sender: 'ai', text: 'Yes, absolutely. Our acoustic models are fine-tuned for code-switching and local Indian accents under 420ms latency. Can we confirm a full team walkthrough tomorrow at 2 PM?' },
      { sender: 'user', text: 'Yes, 2 PM sounds good.' },
      { sender: 'ai', text: 'Great! I have dispatched the Google Meet invite to your phone. Have a wonderful day!' },
    ],
  };

  const handleStartCall = () => {
    setCallStatus('calling');
    setConversation([]);

    setTimeout(() => {
      setCallStatus('connected');
      const dialog = DIALOGUES[activeLang];
      setConversation([dialog[0]]);

      // Play audio of AI greeting
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(dialog[0].text);
        u.rate = 1.0;
        window.speechSynthesis.speak(u);
      }

      // Progressively reveal rest of dialogue
      let idx = 1;
      const interval = setInterval(() => {
        if (idx < dialog.length) {
          const currentItem = dialog[idx];
          setConversation((prev) => [...prev, currentItem]);
          if (currentItem.sender === 'ai' && 'speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(currentItem.text);
            u.rate = 1.0;
            window.speechSynthesis.speak(u);
          }
          idx++;
        } else {
          clearInterval(interval);
        }
      }, 3000);
    }, 1500);
  };

  const handleEndCall = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCallStatus('idle');
    setConversation([]);
  };

  const handleDigitClick = (d: string) => {
    if (dialedDigits.length < 10) {
      setDialedDigits((prev) => prev + d);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-slate-950 rounded-3xl max-w-2xl w-full border border-slate-800 shadow-2xl overflow-hidden text-white flex flex-col md:flex-row">
        
        {/* Left Side: Dialpad & Language */}
        <div className="w-full md:w-72 p-6 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Dialpad Sandbox
              </span>
              <span className="text-[10px] text-slate-500 font-mono">SIP 5060</span>
            </div>

            {/* Language Selector Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-xl mb-4 text-xs font-semibold">
              <button
                onClick={() => setActiveLang('te')}
                className={`py-1 rounded-lg transition-all ${
                  activeLang === 'te' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                తెలుగు
              </button>
              <button
                onClick={() => setActiveLang('hi')}
                className={`py-1 rounded-lg transition-all ${
                  activeLang === 'hi' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                हिन्दी
              </button>
              <button
                onClick={() => setActiveLang('en')}
                className={`py-1 rounded-lg transition-all ${
                  activeLang === 'en' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                English
              </button>
            </div>

            {/* Number Display */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center mb-4">
              <span className="text-xs text-slate-500 block">Dialing Number (+91)</span>
              <span className="text-lg font-mono font-bold text-white tracking-wider">
                +91 {dialedDigits || '__________'}
              </span>
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 text-center text-sm font-bold">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDigitClick(d)}
                  className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors cursor-pointer active:scale-95"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Action Call Button */}
          <div className="mt-4">
            {callStatus === 'idle' ? (
              <button
                onClick={handleStartCall}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Call Voice Agent</span>
              </button>
            ) : (
              <button
                onClick={handleEndCall}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Conversation Feed & Acoustic Visualizer */}
        <div className="flex-1 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  callStatus === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : callStatus === 'calling'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-slate-600'
                }`}></span>
                <span className="text-xs font-bold text-slate-300">
                  {callStatus === 'idle' && 'Sandbox Idle'}
                  {callStatus === 'calling' && 'Connecting to Trivaana SIP Trunk...'}
                  {callStatus === 'connected' && 'Call Connected (Ultra-Low Latency)'}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Waveform Bar */}
            <div className="my-4 h-12 bg-slate-900 rounded-xl p-2 flex items-center justify-center gap-1.5 border border-slate-800">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full bg-orange-500 transition-all duration-150 ${
                    callStatus === 'connected' ? 'animate-pulse' : 'opacity-20'
                  }`}
                  style={{
                    height: callStatus === 'connected' ? `${Math.sin(i * 0.9) * 16 + 18}px` : '4px',
                    animationDelay: `${i * 50}ms`,
                  }}
                ></div>
              ))}
            </div>

            {/* Conversation Dialog Box */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {conversation.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Select a language on the dialpad and tap "Call Voice Agent" to experience natural regional conversation.
                </div>
              ) : (
                conversation.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.sender === 'ai' && (
                      <div className="w-6 h-6 rounded-lg bg-orange-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-slate-800 text-white rounded-tr-none'
                          : 'bg-orange-950/70 border border-orange-800/80 text-orange-100 rounded-tl-none font-serif italic'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {msg.sender === 'user' && (
                      <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-white shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Powered by Trivaana Vernacular Acoustic Stack</span>
            <span className="text-emerald-400 font-mono">TRAI Scrubbed</span>
          </div>
        </div>
      </div>
    </div>
  );
};
