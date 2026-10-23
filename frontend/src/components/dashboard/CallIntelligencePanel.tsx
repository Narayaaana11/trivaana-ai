import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { CallLog } from '@/types/trivaana';
import {
  FileSpreadsheet,
  PhoneCall,
  MessageSquare,
  Clock,
  Send,
  CheckCircle2,
  Calendar,
  Sparkles,
  Bot,
  User,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const CallIntelligencePanel: React.FC = () => {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatchedId, setDispatchedId] = useState<string | null>(null);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const res = await trivaanaApi.getCalls();
      setCalls(res.calls);
      if (res.calls.length > 0 && !selectedCall) {
        setSelectedCall(res.calls[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const handleDispatchWhatsApp = async (callId: string) => {
    try {
      await trivaanaApi.retriggerWhatsApp(callId);
      setDispatchedId(callId);
      setTimeout(() => setDispatchedId(null), 4000);
    } catch (err: any) {
      alert(`WhatsApp dispatch failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-3 border border-orange-200">
          <FileSpreadsheet className="w-3.5 h-3.5 text-orange-600" />
          <span>Conversational Intelligence & Instant Follow-Ups</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Call Transcripts & WhatsApp Dispatcher
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Review verbatim regional language dialogues, AI sentiment analysis, and trigger automatic WhatsApp calendar meeting invites with a single click.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Call History List */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Call Logs ({calls.length})
            </h2>
            <span className="text-[11px] text-slate-400">Real-time sync</span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading call history...</div>
            ) : calls.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No calls logged yet.</div>
            ) : (
              calls.map((call) => {
                const isSelected = selectedCall?.id === call.id;
                return (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50/70 border-orange-300 shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="font-bold text-xs text-slate-900">{call.contact_name}</div>
                      <span className="font-mono text-[11px] font-bold text-slate-900">
                        ₹{call.cost.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-mono">{call.phone}</span>
                      <span>{call.duration}s talk</span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                      <span className="px-2 py-0.5 rounded bg-white text-orange-700 font-semibold text-[10px] border border-orange-200/60">
                        {call.language}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {call.outcome}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Transcript View & WhatsApp Action */}
        <div className="lg:col-span-7 space-y-6">
          {selectedCall ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-6">
              {/* Call Summary Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedCall.contact_name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="font-mono">{selectedCall.phone}</span>
                    <span>•</span>
                    <span>{selectedCall.language} Dialect</span>
                    <span>•</span>
                    <span className="font-mono">{selectedCall.duration} seconds</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDispatchWhatsApp(selectedCall.id)}
                  className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>
                    {dispatchedId === selectedCall.id ? 'WhatsApp Sent ✓' : 'Dispatch WhatsApp Followup'}
                  </span>
                </button>
              </div>

              {/* Speaker Transcript Dialogue */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Verbatim Regional Dialogue
                </h4>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 font-serif text-xs text-slate-800 leading-relaxed italic space-y-2">
                  <div className="flex items-start gap-2">
                    <Bot className="w-4 h-4 text-orange-600 shrink-0 mt-0.5 not-italic" />
                    <div>
                      <span className="not-italic font-bold text-slate-900 block font-sans text-[11px]">
                        Trivaana AI Agent:
                      </span>
                      {selectedCall.transcript}
                    </div>
                  </div>
                </div>
              </div>

              {/* Automated WhatsApp Preview Card */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    WhatsApp Confirmation Message Preview
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold px-2 py-0.5 rounded bg-emerald-100">
                    Auto-Dispatched
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-emerald-200/60 text-xs text-slate-700 leading-relaxed font-sans shadow-2xs">
                  <p>
                    <strong>Namaskaram {selectedCall.contact_name}!</strong> 🙏
                  </p>
                  <p className="mt-1">
                    Thank you for speaking with our AI advisor regarding your inquiry. As discussed on our call, we have scheduled your visit / consultation.
                  </p>
                  <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                    📅 Date: This Saturday, 11:00 AM IST <br />
                    📍 Location: Visakhapatnam Prime Hub <br />
                    🔗 Calendar Invite: https://trivaana.ai/cal/{selectedCall.id.slice(0, 8)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200">
              Select a call record to view transcripts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
