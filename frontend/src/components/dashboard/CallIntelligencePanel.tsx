import React, { useState, useEffect, useCallback } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { CallLog } from '@/types/trivaana';
import { VoicePill } from '@/components/reactbits';
import {
  MessageSquareText,
  PhoneCall,
  Bot,
  User,
  Download,
  Search,
  Sparkles,
  Copy,
  CheckCircle2,
  AlertCircle,
  PhoneIncoming,
  Zap,
} from 'lucide-react';

export const CallIntelligencePanel: React.FC = () => {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [transferPhone, setTransferPhone] = useState('');
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchCalls = useCallback(async () => {
    try {
      setLoading(true);
      const res = await trivaanaApi.getCalls({
        direction: directionFilter || undefined,
        search: searchQuery || undefined,
      });
      setCalls(res.calls || []);
      if (res.calls?.length) {
        const det = await trivaanaApi.getCallDetail(res.calls[0].id).catch(() => res.calls[0]);
        setSelectedCall(det);
      } else {
        setSelectedCall(null);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [directionFilter, searchQuery]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchCalls();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchCalls]);

  const handleSelectCall = async (call: CallLog) => {
    try {
      const detail = await trivaanaApi.getCallDetail(call.id);
      setSelectedCall(detail);
    } catch {
      setSelectedCall(call);
    }
  };

  const handleAnalyze = async (callId: string) => {
    try {
      const res = await trivaanaApi.analyzeCall(callId);
      setFeedback({ type: 'success', message: `Call analyzed (${res.mode}): ${res.outcome}` });
      const detail = await trivaanaApi.getCallDetail(callId);
      setSelectedCall(detail);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleExportCallsCsv = async () => {
    const token = localStorage.getItem('trivaana_token');
    const res = await fetch('/api/calls/export', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trivaana_call_history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulateInbound = async () => {
    try {
      const numsRes = await trivaanaApi.getPhoneNumbers().catch(() => ({ phone_numbers: [] }));
      const targetNum = numsRes.phone_numbers?.[0]?.phone_number || '+918047361234';
      const res = await trivaanaApi.simulateInboundCall({
        to_number: targetNum,
        from_number: '+919848012345',
        caller_name: 'Venkat Rao (Inbound Test)',
        initial_query: '3BHK Villa pricing',
      });
      setFeedback({ type: 'success', message: `Simulated inbound call routed to ${res.agent_name} (Call ID: ${res.call_id}).` });
      fetchCalls();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const messages = selectedCall?.transcript_messages || [];
  const filteredMessages = transcriptSearch
    ? messages.filter((m) => m.message.toLowerCase().includes(transcriptSearch.toLowerCase()))
    : messages;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
            <MessageSquareText className="w-3.5 h-3.5 text-orange-600" />
            <span>Conversations, Transcripts & Post-Call Intelligence</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Call History, Chat Transcripts & Extractions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Inspect timestamped transcripts, extracted structured data, executed actions, recordings, and inbound routing.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={handleSimulateInbound} className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <PhoneIncoming className="w-3.5 h-3.5" /> Test Inbound Call
          </button>
          <button onClick={handleExportCallsCsv} className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Call List */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contact, phone, transcript..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)} className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <option value="">All</option>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-10 text-center text-xs text-slate-400">Loading conversations...</div>
            ) : calls.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">No calls match your filter.</div>
            ) : (
              calls.map((call) => (
                <div
                  key={call.id}
                  onClick={() => handleSelectCall(call)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedCall?.id === call.id ? 'bg-orange-50/70 border-orange-300' : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>{call.contact_name}</span>
                      {call.is_sandbox && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase">Simulated</span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-900">₹{call.cost.toFixed(2)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>{call.phone} • {call.direction} • {call.duration}s</span>
                    <span className="text-emerald-700 font-semibold">{call.outcome}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected Conversation Detail */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-5">
          {!selectedCall ? (
            <div className="py-16 text-center text-xs text-slate-400">Select a call on the left to inspect transcript and extractions.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-black text-slate-900">{selectedCall.contact_name}</h2>
                  <p className="text-xs text-slate-500">
                    {selectedCall.phone} • {selectedCall.direction} • {selectedCall.language} • {selectedCall.duration}s • Provider: {selectedCall.provider}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleAnalyze(selectedCall.id)}
                    className="px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Analyze Summary
                  </button>
                  <button
                    onClick={async () => {
                      const wa = await trivaanaApi.retriggerWhatsApp(selectedCall.id);
                      setFeedback({ type: wa.configured ? 'success' : 'error', message: wa.message || `WhatsApp status: ${wa.status}` });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    WhatsApp Follow-up
                  </button>
                  <div className="flex items-center gap-1">
                    <input
                      value={transferPhone}
                      onChange={(e) => setTransferPhone(e.target.value)}
                      placeholder="+91 human agent"
                      className="w-32 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                    />
                    <button
                      onClick={async () => {
                        if (!transferPhone.trim()) return;
                        try {
                          const xfer = await trivaanaApi.transferCall(selectedCall.id, transferPhone.trim());
                          setFeedback({ type: 'success', message: `Warm transfer initiated (${xfer.transfer_id}) -> ${xfer.target_phone}` });
                          setTransferPhone('');
                          fetchCalls();
                        } catch (err: any) {
                          setFeedback({ type: 'error', message: err.message });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                    >
                      Warm Transfer
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary & Sentiment */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">AI Call Summary</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-white border text-[10px] font-bold uppercase">{selectedCall.sentiment || 'neutral'}</span>
                    {selectedCall.summary && (
                      <button
                        onClick={() => navigator.clipboard.writeText(selectedCall.summary || '')}
                        className="text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-slate-700">{selectedCall.summary || 'Click "Analyze Summary" to extract summary, sentiment, and structured fields.'}</p>
                {selectedCall.extracted_data && Object.keys(selectedCall.extracted_data).length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(selectedCall.extracted_data).map(([k, v]) => (
                        <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px]">
                          <strong className="text-slate-600">{k}:</strong>
                          <span className="text-slate-900 font-semibold">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedCall.actions_performed && selectedCall.actions_performed.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedCall.actions_performed.map((act: any, idx: number) => (
                      <span key={act.id || idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
                        <Zap className="w-3 h-3" /> {act.action_name || act.action_type || 'Action'} ({act.status || 'done'})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat-style Transcript */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">Transcript ({messages.length})</span>
                  <div className="flex items-center gap-2">
                    <input
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      placeholder="Filter transcript text..."
                      className="px-3 py-1 rounded-xl border border-slate-200 text-xs"
                    />
                    <button
                      type="button"
                      disabled={messages.length === 0}
                      onClick={() => {
                        const txt = messages
                          .map((m) => `[${(m.timestamp_ms / 1000).toFixed(1)}s] ${m.speaker.toUpperCase()}: ${m.message}`)
                          .join('\n');
                        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `transcript_${selectedCall.id}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> .txt
                    </button>
                  </div>
                </div>
                <div className="space-y-2.5 max-h-72 overflow-y-auto p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  {filteredMessages.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">No transcript lines recorded for this call yet.</div>
                  ) : (
                    filteredMessages.map((m, idx) => (
                      <div key={m.id || idx} className={`flex items-start gap-2 ${m.speaker === 'ai' ? '' : 'flex-row-reverse'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.speaker === 'ai' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-white'}`}>
                          {m.speaker === 'ai' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        </div>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${m.speaker === 'ai' ? 'bg-white border border-slate-200 text-slate-800' : 'bg-slate-900 text-white'}`}>
                          <div>{m.message}</div>
                          <div className="text-[9px] opacity-60 mt-1">{(m.timestamp_ms / 1000).toFixed(1)}s</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actions & Recording */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                <div className="text-slate-500">
                  Actions executed: <strong>{selectedCall.actions_performed?.length || 0}</strong>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {messages.length > 0 && typeof window !== 'undefined' && 'speechSynthesis' in window && (
                    <VoicePill
                      active={isPlayingSpeech}
                      label={isPlayingSpeech ? 'Stop Audio' : 'Preview Audio'}
                      onClick={() => {
                        if (isPlayingSpeech) {
                          window.speechSynthesis.cancel();
                          setIsPlayingSpeech(false);
                          return;
                        }
                        window.speechSynthesis.cancel();
                        const text = messages.slice(0, 6).map((m) => m.message).join('. ');
                        const utter = new SpeechSynthesisUtterance(text);
                        utter.lang = selectedCall.language || 'en-IN';
                        utter.onend = () => setIsPlayingSpeech(false);
                        utter.onerror = () => setIsPlayingSpeech(false);
                        setIsPlayingSpeech(true);
                        window.speechSynthesis.speak(utter);
                      }}
                      className="!bg-orange-50 hover:!bg-orange-100 !text-orange-800 !border-orange-200"
                    />
                  )}
                  {selectedCall.recording_url ? (
                    (selectedCall.recording_url.startsWith('/api/') ||
                      (selectedCall.recording_url.startsWith('http') &&
                        !selectedCall.recording_url.includes('cdn.trivaana.ai'))) ? (
                      <div className="flex items-center gap-2">
                        <audio controls src={selectedCall.recording_url} className="h-8 max-w-[220px]" />
                        <a
                          href={selectedCall.recording_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold inline-flex items-center gap-1"
                        >
                          <PhoneCall className="w-3.5 h-3.5" /> Open
                        </a>
                      </div>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-[11px] inline-flex items-center gap-1.5">
                        <PhoneCall className="w-3.5 h-3.5 text-orange-600" /> Sandbox Ref: {selectedCall.recording_url.replace('https://cdn.trivaana.ai/', 'sandbox://')}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400">No recording attached</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
