import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Sparkles,
  Bot,
  User,
  Send,
  Zap,
  Volume2,
  X,
} from 'lucide-react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Agent } from '@/types/trivaana';
import { Dialog } from '@/components/ui/Dialog';
import { BorderBeam } from '@/components/motion';

interface LiveCallSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveCallSimulatorModal: React.FC<LiveCallSimulatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastLatency, setLastLatency] = useState<any>(null);
  const [reasoningMode, setReasoningMode] = useState<string>('');
  const [conversation, setConversation] = useState<{ sender: 'ai' | 'caller'; text: string }[]>([]);

  useEffect(() => {
    if (isOpen && trivaanaApi.isAuthenticated()) {
      trivaanaApi.getAgents().then((res) => {
        setAgents(res.agents || []);
        if (res.agents?.length && !selectedAgentId) {
          setSelectedAgentId(res.agents[0].id);
        }
      }).catch(() => {});
    }
  }, [isOpen, selectedAgentId]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = selectedAgent?.speech_rate || 1.0;
      window.speechSynthesis.speak(u);
    }
  };

  const handleStartCall = () => {
    setCallStatus('calling');
    setConversation([]);
    setLastLatency(null);

    setTimeout(() => {
      setCallStatus('connected');
      const greeting =
        selectedAgent?.greeting_message ||
        `Hello! This is ${selectedAgent?.name || 'Trivaana AI'} calling from ${selectedAgent?.business_name || 'Trivaana'}. Please note this sandbox session may be recorded. How can I help you today?`;
      setConversation([{ sender: 'ai', text: greeting }]);
      speakText(greeting);
    }, 500);
  };

  const handleSendTurn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    const msg = inputText.trim();
    setInputText('');
    const nextHistory = [...conversation, { sender: 'caller' as const, text: msg }];
    setConversation(nextHistory);
    setSending(true);

    try {
      if (selectedAgentId && trivaanaApi.isAuthenticated()) {
        const res = await trivaanaApi.runPipelineTurn({
          agent_id: selectedAgentId,
          message: msg,
          history: nextHistory,
          synthesize_audio: true,
        });
        setLastLatency(res.latency);
        setReasoningMode(res.reasoning_mode);
        setConversation((prev) => [...prev, { sender: 'ai', text: res.reply_text }]);
        if (res.audio_base64) {
          const audio = new Audio(`data:audio/mpeg;base64,${res.audio_base64}`);
          audio.play().catch(() => speakText(res.reply_text));
        } else {
          speakText(res.reply_text);
        }
      } else {
        const fallback = 'Sign in and select an AI Employee to test grounded Knowledge Base + OpenAI + TTS responses.';
        setConversation((prev) => [...prev, { sender: 'ai', text: fallback }]);
      }
    } catch (err: any) {
      setConversation((prev) => [...prev, { sender: 'ai', text: `Pipeline error: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  };

  const handleBargeIn = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const handleEndCall = () => {
    handleBargeIn();
    setCallStatus('idle');
    setConversation([]);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} variant="dark" maxWidthClass="max-w-3xl" noPadding>
      <div className="relative bg-slate-950 w-full overflow-hidden text-white flex flex-col md:flex-row">
        <BorderBeam size={220} duration={12} borderWidth={1} colorFrom="#ff5500" colorTo="#fbbf24" />
        {/* Left: Agent & Controls */}
        <div className="w-full md:w-72 p-6 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Voice Pipeline Tester
              </span>
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 font-semibold px-2 py-0.5 rounded-full">
                Sandbox (₹0.00)
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                Select AI Employee
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                {agents.length === 0 ? (
                  <option value="">Demo Sandbox Persona</option>
                ) : (
                  agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.language})
                    </option>
                  ))
                )}
              </select>
            </div>

            {lastLatency && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                <div className="font-bold text-slate-300 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-orange-400" /> Measured Pipeline Latency
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Reasoning ({reasoningMode}):</span>
                  <span className="font-mono text-white">{lastLatency.llm_ms}ms</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>TTS Synthesis:</span>
                  <span className="font-mono text-white">{lastLatency.tts_ms}ms</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Total Turn:</span>
                  <span className="font-mono">{lastLatency.total_ms}ms</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {callStatus === 'idle' ? (
              <button
                onClick={handleStartCall}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Start Interactive Test</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleBargeIn}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Simulate Barge-In (Interrupt AI)</span>
                </button>
                <button
                  onClick={handleEndCall}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Test Session</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: Live Conversation Transcript */}
        <div className="flex-1 flex flex-col h-[460px]">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">
                {selectedAgent?.name || 'Interactive AI Conversation Sandbox'}
              </div>
              <div className="text-[11px] text-slate-400">
                Status: <span className="text-emerald-400 font-semibold capitalize">{callStatus}</span> • Grounded with Knowledge Base
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-950">
            {conversation.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs px-6">
                Click "Start Interactive Test" to speak/chat with your configured AI Employee using its prompt, Knowledge Base, and voice settings.
              </div>
            ) : (
              conversation.map((turn, idx) => (
                <div key={idx} className={`flex items-start gap-2.5 ${turn.sender === 'ai' ? '' : 'flex-row-reverse'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${turn.sender === 'ai' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                    {turn.sender === 'ai' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${turn.sender === 'ai' ? 'bg-slate-900 border border-slate-800 text-slate-100' : 'bg-orange-600 text-white'}`}>
                    {turn.text}
                  </div>
                </div>
              ))
            )}
          </div>

          {callStatus === 'connected' && (
            <form onSubmit={handleSendTurn} className="p-4 border-t border-slate-800 flex items-center gap-2 bg-slate-900/50">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type caller response (e.g., What is the 3BHK price?)..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? '...' : 'Send'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </Dialog>
  );
};
