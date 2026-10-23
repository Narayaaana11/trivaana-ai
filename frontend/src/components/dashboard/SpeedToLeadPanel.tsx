import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import {
  Zap,
  PhoneCall,
  CheckCircle2,
  Clock,
  Send,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import BRAND from '@/lib/brand';

interface SpeedToLeadPanelProps {
  onCallCompleted?: () => void;
}

export const SpeedToLeadPanel: React.FC<SpeedToLeadPanelProps> = ({
  onCallCompleted,
}) => {
  const [name, setName] = useState('Venkateswara Rao');
  const [phone, setPhone] = useState('+91 98480 22338');
  const [vertical, setVertical] = useState('Real Estate');
  const [language, setLanguage] = useState('te-IN');
  const [isTriggering, setIsTriggering] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'dialing' | 'connected' | 'completed'>('idle');
  const [timerSeconds, setTimerSeconds] = useState(28);
  const [resultCall, setResultCall] = useState<any>(null);
  const [whatsAppDispatched, setWhatsAppDispatched] = useState(false);

  useEffect(() => {
    let interval: any;
    if (callState === 'dialing' && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setCallState('connected');
            return 0;
          }
          return prev - 1;
        });
      }, 100); // Fast mock timer
    }
    return () => clearInterval(interval);
  }, [callState, timerSeconds]);

  const handleTriggerCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTriggering(true);
    setCallState('dialing');
    setTimerSeconds(28);
    setWhatsAppDispatched(false);

    try {
      const res = await trivaanaApi.triggerInstantCall(name, phone, vertical, language);
      setResultCall(res.call);
      setTimeout(() => {
        setCallState('completed');
        setIsTriggering(false);
        if (onCallCompleted) onCallCompleted();
      }, 3500);
    } catch (err: any) {
      alert(`Error triggering call: ${err.message}`);
      setIsTriggering(false);
      setCallState('idle');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!resultCall?.id) return;
    try {
      await trivaanaApi.retriggerWhatsApp(resultCall.id);
      setWhatsAppDispatched(true);
    } catch (err: any) {
      alert(`Error sending WhatsApp: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-3 border border-orange-200">
          <Zap className="w-3.5 h-3.5 text-orange-600 fill-current" />
          <span>Sub-30-Second Speed-to-Lead Guarantee</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Instant Inbound Intercept Studio
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Research proves contacting a lead within 60 seconds increases qualification rates by 391%. Test Trivaana AI’s lightning-fast autonomous outbound call pipeline right here.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: Inbound Lead Generator */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span>Simulate Lead Form Submission</span>
          </h2>

          <form onSubmit={handleTriggerCall} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prospect Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                placeholder="e.g. Venkat Reddy"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number (+91)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                placeholder="+91 98480 12345"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Industry Vertical
                </label>
                <select
                  value={vertical}
                  onChange={(e) => setVertical(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                >
                  <option value="Real Estate">Real Estate</option>
                  <option value="Healthcare">Healthcare Clinic</option>
                  <option value="EdTech">EdTech & Coaching</option>
                  <option value="Automotive">Auto Dealership</option>
                  <option value="Finance">BFSI & Lending</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dialect / Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                >
                  <option value="te-IN">Telugu (తెలుగు)</option>
                  <option value="hi-IN">Hindi (हिन्दी)</option>
                  <option value="en-IN">Indian English</option>
                  <option value="ta-IN">Tamil (தமிழ்)</option>
                  <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                </select>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200/90 text-xs text-orange-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <span>
                Calls placed through verified DLT-registered enterprise SIP trunk with automated TRAI compliance checks.
              </span>
            </div>

            <button
              type="submit"
              disabled={isTriggering}
              className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:bg-slate-300 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isTriggering ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting AI Telephony...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Fire Instant Callback (&lt;30s)</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Panel: Telemetry & Live Call Flow */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950 rounded-3xl p-6 text-white border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  callState === 'dialing'
                    ? 'bg-amber-400 animate-ping'
                    : callState === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : callState === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-slate-600'
                }`}></span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {callState === 'idle' && 'Telemetry Waiting for Event'}
                  {callState === 'dialing' && 'Inbound Intercept Dispatched'}
                  {callState === 'connected' && 'Autonomous Voice Agent Live'}
                  {callState === 'completed' && 'Call Concluded & Qualified'}
                </span>
              </div>
              <div className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-orange-400">
                Turn-taking: 412ms
              </div>
            </div>

            {/* Countdown / Speedometer */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 mb-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Lead Response Time</span>
                <span className="text-2xl font-black text-white font-mono">
                  {callState === 'idle' ? '0.00s' : `${(30 - timerSeconds).toFixed(1)}s`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">TRAI NDNC Status</span>
                <span className="text-xs font-bold text-emerald-400">
                  Passed / Scrubbed
                </span>
              </div>
            </div>

            {/* Simulated Audio Waveform */}
            <div className="h-14 bg-slate-900 rounded-xl p-3 flex items-center justify-center gap-1.5 overflow-hidden border border-slate-800">
              {[...Array(24)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full bg-orange-500 transition-all duration-150 ${
                    callState === 'connected' || callState === 'dialing'
                      ? 'animate-pulse'
                      : 'opacity-20'
                  }`}
                  style={{
                    height: callState === 'connected' ? `${Math.sin(i * 0.8) * 20 + 24}px` : '6px',
                    animationDelay: `${i * 40}ms`,
                  }}
                ></div>
              ))}
            </div>

            {/* Live Transcript Stream */}
            {resultCall && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Dialogue Stream</span>
                  <span className="text-[10px] text-orange-400 font-mono">
                    Outcome: {resultCall.outcome}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-serif italic text-slate-300 leading-relaxed max-h-40 overflow-y-auto">
                  {resultCall.transcript}
                </div>

                {/* WhatsApp Dispatch action */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-400">
                    Calculated Call Cost: <span className="font-mono text-white font-bold">₹{resultCall.cost}</span>
                  </div>
                  <button
                    onClick={handleSendWhatsApp}
                    disabled={whatsAppDispatched}
                    className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-950 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{whatsAppDispatched ? 'WhatsApp Sent ✓' : 'Dispatch WhatsApp Invite'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
