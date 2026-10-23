import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Agent } from '@/types/trivaana';
import BRAND from '@/lib/brand';
import {
  Bot,
  Sparkles,
  Volume2,
  Sliders,
  Check,
  Building2,
  Stethoscope,
  GraduationCap,
  Car,
  Landmark,
  Save,
  Play,
  Square,
} from 'lucide-react';

interface AgentStudioPanelProps {
  initialPreset?: string;
}

const PRESET_ICONS: Record<string, any> = {
  'Real Estate': Building2,
  'Healthcare': Stethoscope,
  'EdTech': GraduationCap,
  'Automotive': Car,
  'Finance': Landmark,
};

export const AgentStudioPanel: React.FC<AgentStudioPanelProps> = ({
  initialPreset,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('te-IN');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await trivaanaApi.getAgents();
        setAgents(res.agents);
        if (res.agents.length > 0) {
          const matched = initialPreset
            ? res.agents.find((a) => a.name.toLowerCase().includes(initialPreset.toLowerCase()))
            : res.agents[0];
          const initial = matched || res.agents[0];
          setSelectedAgent(initial);
          setSystemPrompt(initial.system_prompt);
          setSelectedLanguage(initial.language);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadAgents();
  }, [initialPreset]);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setSystemPrompt(agent.system_prompt);
    setSelectedLanguage(agent.language);
  };

  const handleAuditionVoice = () => {
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis not supported in this browser.');
      return;
    }

    let sampleUtterance = "నమస్కారం! త్రివాణా ఏఐ వాయిస్ స్టూడియో నుండి మాట్లాడుతున్నాను.";
    if (selectedLanguage.startsWith('hi')) {
      sampleUtterance = "नमस्ते! मैं त्रिवणा एआई वॉइस स्टूडियो से बात कर रही हूँ।";
    } else if (selectedLanguage.startsWith('en')) {
      sampleUtterance = "Hello! I am an autonomous calling persona from Trivaana AI Studio.";
    }

    const utterance = new SpeechSynthesisUtterance(sampleUtterance);
    utterance.rate = speechRate;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSavePrompt = () => {
    alert(`Custom prompt configuration saved for ${selectedAgent?.name}!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-3 border border-orange-200">
          <Bot className="w-3.5 h-3.5 text-orange-600" />
          <span>Outpero Industry Persona Tuning</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Multilingual Agent Studio
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Customize dialect personas, objection handling prompts, and natural conversational cadence across 7 Indian regional languages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Preset Selector Cards */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            Turnkey Industry Presets
          </h2>
          {agents.map((agent) => {
            const isSelected = selectedAgent?.id === agent.id;
            const Icon = PRESET_ICONS[agent.vertical] || Bot;
            return (
              <div
                key={agent.id}
                onClick={() => handleSelectAgent(agent)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-orange-50/70 border-orange-300 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isSelected ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{agent.name}</h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {agent.vertical} • {agent.language}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-orange-600"></span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Studio Prompt & Cadence Editor */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {selectedAgent?.name || 'Agent Persona Configuration'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Model: <span className="font-mono text-slate-700">{selectedAgent?.voice_model || 'trivaana-voice-v2.1'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAuditionVoice}
                className="py-2 px-3.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isPlayingAudio ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Audition</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Audition Voice</span>
                  </>
                )}
              </button>

              <button
                onClick={handleSavePrompt}
                className="py-2 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Persona</span>
              </button>
            </div>
          </div>

          {/* Controls: Dialect & Speed */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dialect / Primary Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-orange-500 bg-white"
              >
                {BRAND.languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.nativeName}) - {l.region}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Cadence & Speed
                </label>
                <span className="text-xs font-mono font-bold text-orange-600">
                  {speechRate.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.05"
                value={speechRate}
                onChange={(e) => setSpeechRate(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600 mt-2"
              />
            </div>
          </div>

          {/* System Prompt / Script Box */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                <span>System Directives & Objection Handling Rules</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Supports vernacular tokens & placeholders
              </span>
            </div>
            <textarea
              rows={8}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full p-4 rounded-2xl border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50/50"
              placeholder="Configure autonomous directives..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
