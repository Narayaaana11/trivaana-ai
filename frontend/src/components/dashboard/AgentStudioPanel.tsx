import React, { useState, useEffect, useCallback, useRef } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Agent, VoiceProfile, KnowledgeDocument, CallLog } from '@/types/trivaana';
import BRAND from '@/lib/brand';
import { AgentWorkflowCanvas } from './AgentWorkflowCanvas';
import { ThreadsBackground } from '@/components/reactbits';
import {
  Bot,
  Sparkles,
  Save,
  Play,
  Square,
  Plus,
  History,
  RotateCcw,
  BookOpen,
  Zap,
  Webhook,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Send,
  KeyRound,
  Trash2,
  Copy,
  GitCompare,
  GitBranch,
  Loader2,
  Volume2,
} from 'lucide-react';

const SARVAM_V3_DEFAULT_SPEAKER: Record<string, string> = {
  'te-IN': 'shubh',
  'hi-IN': 'priya',
  'en-IN': 'ishita',
  'ta-IN': 'kavya',
  'kn-IN': 'kavitha',
  'ml-IN': 'shruti',
  'mr-IN': 'rupali',
  'bn-IN': 'roopa',
  'gu-IN': 'pooja',
  'pa-IN': 'anand',
  'or-IN': 'shubh',
};

const SARVAM_V4_DEFAULT_SPEAKER: Record<string, string> = {
  'hi-IN': 'shubh_hi_customer',
  'en-IN': 'ishita_en_customer',
  'te-IN': 'kavitha_te_conversation',
  'ta-IN': 'aravind_ta_ads',
  'kn-IN': 'chaitra_kn_conversation',
  'mr-IN': 'nilesh_mr_conversation',
  'bn-IN': 'roopa_bn_conversational',
  'gu-IN': 'pooja_gu_conversational',
  'pa-IN': 'anand_pa_conversation',
};

const SARVAM_SAMPLE_BY_LANG: Record<string, string> = {
  'te-IN': 'నమస్కారం! నేను త్రివాణ ఏఐ నుండి మాట్లాడుతున్నాను. ఈ రోజు మీకు ఎలా సహాయం చేయగలను?',
  'hi-IN': 'नमस्ते! मैं त्रिवान एआई से बोल रही हूँ। आज मैं आपकी किस प्रकार मदद कर सकती हूँ?',
  'en-IN': 'Hello! I am calling from Trivaana AI. How can I assist you today?',
  'ta-IN': 'வணக்கம்! நான் ட்ரிவானா AI-இலிருந்து பேசுகிறேன். இன்று உங்களுக்கு எப்படி உதவ முடியும்?',
  'kn-IN': 'ನಮಸ್ಕಾರ! ನಾನು ತ್ರಿವಾಣ ಎಐ ನಿಂದ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ. ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
  'ml-IN': 'നമസ്കാരം! ഞാൻ ട്രിവാന എഐയിൽ നിന്ന് സംസാരിക്കുകയാണ്. ഇന്ന് എങ്ങനെ സഹായിക്കാം?',
  'mr-IN': 'नमस्कार! मी त्रिवान एआय मधून बोलत आहे. आज मी तुम्हाला कशी मदत करू शकते?',
  'bn-IN': 'নমস্কার! আমি ত্রিভানা এআই থেকে বলছি। আজ আপনাকে কীভাবে সাহায্য করতে পারি?',
  'gu-IN': 'નમસ્તે! હું ત્રિવાના એઆઈમાંથી બોલી રહ્યો છું. આજે હું તમને કેવી રીતે મદદ કરી શકું?',
  'pa-IN': 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤ੍ਰਿਵਾਣਾ ਏਆਈ ਤੋਂ ਬੋਲ ਰਿਹਾ ਹਾਂ। ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?',
  'or-IN': 'ନମସ୍କାର! ମୁଁ ତ୍ରିବାଣା ଏଆଇରୁ କହୁଛି। ଆଜି ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?',
};

const SARVAM_MODEL_OPTIONS = [
  {
    id: 'bulbul:v3' as const,
    name: 'Sarvam Bulbul v3',
    badge: 'Flagship · 11 Languages',
    ttsRate: '₹2.70 – ₹3.00 / 1K chars',
    sttModel: 'saaras:v4 (₹0.41–₹0.49/min)',
    apiPerMin: '₹1.76 – ₹1.99 / min',
    ttsPerMin: '₹1.35 – ₹1.50 / min',
    customerRate: '₹6.50 / min',
    desc: 'Most natural human-like Indian voice quality across all 11 supported languages (37 speakers).',
    supportedLangs: Object.keys(SARVAM_V3_DEFAULT_SPEAKER),
  },
  {
    id: 'bulbul:v4-flash' as const,
    name: 'Sarvam Bulbul v4 Flash',
    badge: 'Ultra-Low Latency · Economy',
    ttsRate: '₹0.85 – ₹1.00 / 1K chars',
    sttModel: 'saaras:v4 (₹0.41–₹0.49/min)',
    apiPerMin: '₹0.84 – ₹0.99 / min',
    ttsPerMin: '₹0.43 – ₹0.50 / min',
    customerRate: '₹6.50 / min',
    desc: 'Fastest role-tuned regional speakers for high-volume customer support (9 languages).',
    supportedLangs: Object.keys(SARVAM_V4_DEFAULT_SPEAKER),
  },
];

interface AgentStudioPanelProps {
  initialPreset?: string;
  initialCreate?: boolean;
}

type AgentSubTab =
  | 'overview'
  | 'configuration'
  | 'prompt'
  | 'workflow'
  | 'voice'
  | 'knowledge'
  | 'actions'
  | 'calling-rules'
  | 'integrations'
  | 'call-history';

const LIFECYCLE_STATES: Array<Agent['status']> = ['draft', 'testing', 'published', 'active', 'paused', 'archived'];

export const AgentStudioPanel: React.FC<AgentStudioPanelProps> = ({ initialPreset, initialCreate }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [subTab, setSubTab] = useState<AgentSubTab>('overview');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Builder form state
  const [formState, setFormState] = useState<Partial<Agent>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Prompt generation, versions & compare
  const [promptBrief, setPromptBrief] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [compareLeftId, setCompareLeftId] = useState<string>('');
  const [compareRightId, setCompareRightId] = useState<string>('');
  const [copiedScript, setCopiedScript] = useState(false);

  // Voice library
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<string>('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Agent KB, Actions, Calls
  const [kbDocs, setKbDocs] = useState<KnowledgeDocument[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [agentCalls, setAgentCalls] = useState<CallLog[]>([]);
  const [newAction, setNewAction] = useState({ name: '', action_type: 'custom_api', description: '', endpoint: '' });

  // Intake secret display
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);

  // Inline test sandbox & eval scorecard
  const [testInput, setTestInput] = useState('');
  const [testHistory, setTestHistory] = useState<Array<{ sender: 'ai' | 'caller'; text: string }>>([]);
  const [isTestingTurn, setIsTestingTurn] = useState(false);
  const [evalReport, setEvalReport] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // New agent modal
  const [showCreateModal, setShowCreateModal] = useState(Boolean(initialCreate));
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentIndustry, setNewAgentIndustry] = useState('Real Estate');
  const [newAgentLang, setNewAgentLang] = useState('te-IN');
  const [newAgentModel, setNewAgentModel] = useState<'bulbul:v3' | 'bulbul:v4-flash'>('bulbul:v3');
  const [newAgentBrief, setNewAgentBrief] = useState('');
  const [auditioningModel, setAuditioningModel] = useState<string | null>(null);
  const [playingModelId, setPlayingModelId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadAgentDetails = useCallback(async (agentId: string, lang?: string) => {
    try {
      const [verRes, voiceRes, kbRes, actRes, callRes] = await Promise.all([
        trivaanaApi.getPromptVersions(agentId).catch(() => ({ versions: [] })),
        trivaanaApi.getVoices({ language: lang }).catch(() => ({ voices: [] })),
        trivaanaApi.getKnowledgeDocuments(agentId).catch(() => ({ documents: [] })),
        trivaanaApi.getAgentActions(agentId).catch(() => ({ actions: [] })),
        trivaanaApi.getCalls({ agent_id: agentId }).catch(() => ({ calls: [] })),
      ]);
      setVersions(verRes.versions || []);
      setVoices(voiceRes.voices || []);
      setKbDocs(kbRes.documents || []);
      setActions(actRes.actions || []);
      setAgentCalls(callRes.calls || []);
    } catch {
      // Non-blocking detail fetch
    }
  }, []);

  const selectAgent = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setFormState({ ...agent });
    setRotatedSecret(null);
    setEvalReport(null);
    setTestHistory(agent.greeting_message ? [{ sender: 'ai', text: agent.greeting_message }] : []);
    void loadAgentDetails(agent.id, agent.language);
  }, [loadAgentDetails]);

  const loadAgents = useCallback(async (keepId?: string) => {
    try {
      setLoading(true);
      const res = await trivaanaApi.getAgents();
      setAgents(res.agents || []);
      if (res.agents?.length) {
        const target =
          (keepId && res.agents.find((a) => a.id === keepId)) ||
          (initialPreset && res.agents.find((a) => a.name.toLowerCase().includes(initialPreset.toLowerCase()))) ||
          res.agents[0];
        selectAgent(target);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [initialPreset, selectAgent]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadAgents();
    }, 0);
    return () => clearTimeout(id);
  }, [loadAgents]);

  const handleSaveAgent = async () => {
    if (!selectedAgent) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const updated = await trivaanaApi.updateAgent(selectedAgent.id, formState);
      setSelectedAgent(updated);
      setFormState({ ...updated });
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setFeedback({ type: 'success', message: `Saved configuration (v${updated.current_version || 1}) to database.` });
      loadAgentDetails(updated.id, updated.language);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setFeedback(null);
    try {
      const gen = await trivaanaApi.generateAgentPrompt({
        description: newAgentBrief || `AI voice employee for ${newAgentIndustry}`,
        employee_name: newAgentName,
        industry: newAgentIndustry,
        language: newAgentLang,
      });
      const cfg = gen.config;
      const chosenSpeaker =
        newAgentModel === 'bulbul:v4-flash'
          ? SARVAM_V4_DEFAULT_SPEAKER[newAgentLang] || 'shubh_hi_customer'
          : SARVAM_V3_DEFAULT_SPEAKER[newAgentLang] || 'shubh';
      const created = await trivaanaApi.createAgent({
        name: newAgentName,
        vertical: newAgentIndustry,
        language: newAgentLang,
        provider: 'sarvam',
        tts_model_id: newAgentModel,
        voice_id: chosenSpeaker,
        greeting_message: cfg.greeting,
        personality: cfg.personality,
        system_prompt: cfg.system_prompt,
        questions: cfg.question_sequence,
        extraction_schema: cfg.data_extraction_schema,
        qualification_criteria: cfg.qualification_logic,
        escalation_conditions: cfg.escalation_conditions,
        call_ending_conditions: cfg.call_ending_behaviour,
        never_say: cfg.safety_restrictions,
        structured_config: cfg,
        status: 'draft',
      });
      setShowCreateModal(false);
      setNewAgentName('');
      setNewAgentBrief('');
      setRotatedSecret(created.intake_secret);
      setFeedback({ type: 'success', message: `Created AI Employee '${newAgentName}' (${gen.generation_mode}).` });
      await loadAgents(created.agent_id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePromptInEditor = async () => {
    if (!promptBrief.trim() || !selectedAgent) return;
    setIsGenerating(true);
    setFeedback(null);
    try {
      const res = await trivaanaApi.generateAgentPrompt({
        description: promptBrief,
        employee_name: formState.name || selectedAgent.name,
        business_name: formState.business_name || 'Our Business',
        industry: formState.vertical || selectedAgent.vertical,
        designation: formState.designation || 'AI Voice Specialist',
        language: formState.language || selectedAgent.language,
        call_direction: formState.call_direction || 'outbound',
      });
      const cfg = res.config;
      setFormState((prev) => ({
        ...prev,
        system_prompt: cfg.system_prompt,
        personality: cfg.personality,
        greeting_message: cfg.greeting,
        questions: cfg.question_sequence,
        extraction_schema: cfg.data_extraction_schema,
        qualification_criteria: cfg.qualification_logic,
        escalation_conditions: cfg.escalation_conditions,
        call_ending_conditions: cfg.call_ending_behaviour,
        never_say: cfg.safety_restrictions,
        structured_config: cfg,
      }));
      setFeedback({
        type: 'success',
        message: `Generated structured configuration (${res.generation_mode}). Review below and click Save Configuration.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLifecycleChange = async (newStatus: string) => {
    if (!selectedAgent) return;
    try {
      await trivaanaApi.updateAgentLifecycle(selectedAgent.id, newStatus);
      setFeedback({ type: 'success', message: `AI Employee status updated to '${newStatus}'.` });
      await loadAgents(selectedAgent.id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const stopAuditionAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
    setPlayingModelId(null);
  };

  const handleAuditionSarvamModel = async (
    modelId: 'bulbul:v3' | 'bulbul:v4-flash',
    lang: string,
    customText?: string,
    speakerOverride?: string,
  ) => {
    if (playingModelId === modelId) {
      stopAuditionAudio();
      return;
    }
    stopAuditionAudio();
    const speaker =
      speakerOverride ||
      (modelId === 'bulbul:v4-flash'
        ? SARVAM_V4_DEFAULT_SPEAKER[lang] || 'shubh_hi_customer'
        : SARVAM_V3_DEFAULT_SPEAKER[lang] || 'shubh');
    const text = customText?.trim() || SARVAM_SAMPLE_BY_LANG[lang] || SARVAM_SAMPLE_BY_LANG['en-IN'];
    setAuditioningModel(modelId);
    try {
      const res = await trivaanaApi.previewVoice({
        provider: 'sarvam',
        model_id: modelId,
        voice_id: speaker,
        language: lang,
        text,
        speed: formState.speech_rate || 1.0,
      });
      if (!res.audio_base64) {
        setFeedback({ type: 'error', message: res.message || `No audio returned for ${modelId}.` });
        return;
      }
      const audio = new Audio(`data:${res.content_type || 'audio/mpeg'};base64,${res.audio_base64}`);
      audioRef.current = audio;
      setPlayingModelId(modelId);
      audio.onended = () => stopAuditionAudio();
      audio.onerror = () => {
        setFeedback({ type: 'error', message: `Failed to play ${modelId} sample.` });
        stopAuditionAudio();
      };
      await audio.play();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || `Sarvam ${modelId} preview failed.` });
    } finally {
      setAuditioningModel(null);
    }
  };

  const handleAuditionVoice = async () => {
    if (isPlayingAudio) {
      stopAuditionAudio();
      return;
    }
    stopAuditionAudio();
    const lang = formState.language || 'te-IN';
    const sample = formState.greeting_message || SARVAM_SAMPLE_BY_LANG[lang] || 'Namaskaram! Welcome to Trivaana AI.';
    const provider = formState.provider || 'sarvam';
    const modelId = provider === 'sarvam' ? (formState as any).tts_model_id || 'bulbul:v3' : undefined;
    try {
      const res = await trivaanaApi.previewVoice({
        voice_id: formState.voice_id || 'shubh',
        provider,
        model_id: modelId,
        language: lang,
        text: sample,
        speed: formState.speech_rate || 1.0,
        stability: formState.stability || 0.6,
      });
      if (res.audio_base64) {
        const audio = new Audio(`data:${res.content_type || 'audio/mpeg'};base64,${res.audio_base64}`);
        audioRef.current = audio;
        setIsPlayingAudio(true);
        audio.onended = () => stopAuditionAudio();
        await audio.play();
        return;
      }
      setFeedback({ type: 'error', message: res.message || 'No audio returned by provider.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Voice preview failed.' });
    }
  };

  const handleRunEvalScorecard = async () => {
    if (!selectedAgent) return;
    setIsEvaluating(true);
    try {
      const report = await trivaanaApi.evaluateAgent(selectedAgent.id);
      setEvalReport(report);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Evaluation scorecard failed.' });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSendTestTurn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || !testInput.trim()) return;
    const msg = testInput.trim();
    setTestInput('');
    const priorHistory = [...testHistory];
    const nextHist = [...testHistory, { sender: 'caller' as const, text: msg }];
    setTestHistory(nextHist);
    setIsTestingTurn(true);
    try {
      const res = await trivaanaApi.testAgentTurn(selectedAgent.id, msg, priorHistory);
      setTestHistory((prev) => [...prev, { sender: 'ai', text: res.reply }]);
    } catch (err: any) {
      setTestHistory((prev) => [...prev, { sender: 'ai', text: `Error: ${err.message}` }]);
    } finally {
      setIsTestingTurn(false);
    }
  };

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || !newAction.name.trim()) return;
    try {
      await trivaanaApi.createAgentAction(selectedAgent.id, {
        name: newAction.name,
        action_type: newAction.action_type,
        description: newAction.description || `Execute ${newAction.action_type}`,
        config: newAction.endpoint ? { endpoint: newAction.endpoint, method: 'POST' } : {},
      });
      setNewAction({ name: '', action_type: 'custom_api', description: '', endpoint: '' });
      loadAgentDetails(selectedAgent.id, selectedAgent.language);
      setFeedback({ type: 'success', message: 'During-call AI action added.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const SUB_TABS: { id: AgentSubTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'configuration', label: 'Configuration' },
    { id: 'prompt', label: 'Prompt & Versions' },
    { id: 'workflow', label: 'Visual Call Flow' },
    { id: 'voice', label: 'Voice' },
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'actions', label: 'Actions' },
    { id: 'calling-rules', label: 'Calling Rules' },
    { id: 'integrations', label: 'Intake & Webhooks' },
    { id: 'call-history', label: 'Call History' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <ThreadsBackground className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
              <Bot className="w-3.5 h-3.5 text-orange-600" />
              <span>No-Code AI Employee Builder</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              AI Employees &amp; Prompt Architect
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Create AI employees from natural language, manage prompt versions, assign voices, attach Knowledge Bases, and test before publishing.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create AI Employee</span>
          </button>
        </div>
      </ThreadsBackground>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: AI Employee List */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 pb-2 border-b border-slate-100">
            Workspace AI Employees ({agents.length})
          </div>
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading AI employees...</div>
          ) : agents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No AI employees yet. Click Create AI Employee.</div>
          ) : (
            agents.map((ag) => {
              const isSelected = selectedAgent?.id === ag.id;
              return (
                <button
                  key={ag.id}
                  onClick={() => selectAgent(ag)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected ? 'bg-orange-50/80 border-orange-400 shadow-2xs' : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900 truncate">{ag.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      ag.status === 'active' || ag.status === 'published'
                        ? 'bg-emerald-100 text-emerald-700'
                        : ag.status === 'paused' || ag.status === 'archived'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {ag.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <span>{ag.language}</span>
                    <span>•</span>
                    <span className="truncate">{ag.vertical}</span>
                    <span>•</span>
                    <span>v{ag.current_version || 1}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: 9 Sub-pages for Selected AI Employee */}
        {selectedAgent && (
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-6">
            {/* Sub-tab navigation */}
            <div className="flex flex-wrap gap-1.5 pb-4 border-b border-slate-100">
              {SUB_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSubTab(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    subTab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {subTab === 'overview' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{selectedAgent.name}</h2>
                    <p className="text-xs text-slate-500">
                      {selectedAgent.designation || 'AI Voice Specialist'} • {selectedAgent.business_name || 'Workspace'} • {selectedAgent.call_direction || 'outbound'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Lifecycle:</span>
                    <select
                      value={selectedAgent.status}
                      onChange={(e) => handleLifecycleChange(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold capitalize"
                    >
                      {LIFECYCLE_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                    {selectedAgent.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => handleLifecycleChange('archived')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 text-[11px] font-bold cursor-pointer"
                        title="Archive AI Employee (preserves call & transcript history)"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[11px] text-slate-500">Language</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedAgent.language}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[11px] text-slate-500">Voice Provider</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5 uppercase">{selectedAgent.provider || 'sarvam'}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[11px] text-slate-500">KB Documents</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{kbDocs.length}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[11px] text-slate-500">Configured Actions</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{actions.length}</div>
                  </div>
                </div>

                {/* Grounded Agent Test Sandbox */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-400" /> Pre-Publish Agent Sandbox
                    </span>
                    <span className="text-[10px] text-slate-400">Uses current prompt + Knowledge Base</span>
                  </div>
                  <div className="p-4 bg-slate-50 space-y-2.5 max-h-60 overflow-y-auto">
                    {testHistory.map((m, idx) => (
                      <div key={idx} className={`flex ${m.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-xs ${m.sender === 'ai' ? 'bg-white border border-slate-200 text-slate-800' : 'bg-orange-600 text-white'}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendTestTurn} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                    <input
                      type="text"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Test a customer question (e.g., What is the 3BHK pricing?)..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={isTestingTurn}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isTestingTurn ? '...' : 'Send'}</span>
                    </button>
                  </form>
                </div>

                {/* Safety & Multilingual Evaluation Scorecard */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900">Safety & Multilingual Guardrail Scorecard</div>
                      <div className="text-[11px] text-slate-500">Validates Telugu/Hindi/English routing, opt-out compliance, and human handoff</div>
                    </div>
                    <button
                      type="button"
                      disabled={isEvaluating}
                      onClick={handleRunEvalScorecard}
                      className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold cursor-pointer disabled:opacity-60"
                    >
                      {isEvaluating ? 'Running Eval...' : 'Run Eval Scorecard'}
                    </button>
                  </div>
                  {evalReport && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${evalReport.ready_for_publish ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {evalReport.ready_for_publish ? 'Ready to Publish' : 'Needs Review'}
                        </span>
                        <span className="font-bold text-slate-800">{evalReport.passed}/{evalReport.total} Passed ({Math.round((evalReport.pass_rate || 0) * 100)}%)</span>
                        <span className="text-slate-500">p95 Latency: {evalReport.p95_latency_ms}ms</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {(evalReport.results || []).map((item: any) => (
                          <div key={item.case} className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <span className="font-mono text-[11px] text-slate-700">{item.case}</span>
                            <span className={`font-bold text-[10px] ${item.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {item.passed ? 'PASS' : 'FAIL'} ({item.detected_language})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {subTab === 'configuration' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Employee Name</label>
                    <input value={formState.name || ''} onChange={(e) => setFormState({ ...formState, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Business Name</label>
                    <input value={formState.business_name || ''} onChange={(e) => setFormState({ ...formState, business_name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Industry Vertical</label>
                    <input value={formState.vertical || ''} onChange={(e) => setFormState({ ...formState, vertical: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Designation</label>
                    <input value={formState.designation || ''} onChange={(e) => setFormState({ ...formState, designation: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Call Direction</label>
                    <select value={formState.call_direction || 'outbound'} onChange={(e) => setFormState({ ...formState, call_direction: e.target.value as any })} className="w-full px-3 py-2 rounded-xl border border-slate-200">
                      <option value="outbound">Outbound</option>
                      <option value="inbound">Inbound</option>
                      <option value="both">Inbound & Outbound</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Speaking Style</label>
                    <input value={formState.speaking_style || ''} onChange={(e) => setFormState({ ...formState, speaking_style: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                  </div>
                </div>
                <div className="text-xs space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Objective & Calling Purpose</label>
                    <input value={formState.objective || ''} onChange={(e) => setFormState({ ...formState, objective: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Greeting Message</label>
                    <textarea rows={2} value={formState.greeting_message || ''} onChange={(e) => setFormState({ ...formState, greeting_message: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Qualification Criteria</label>
                    <textarea rows={2} value={formState.qualification_criteria || ''} onChange={(e) => setFormState({ ...formState, qualification_criteria: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Call-Ending Conditions</label>
                      <textarea rows={2} value={formState.call_ending_conditions || ''} onChange={(e) => setFormState({ ...formState, call_ending_conditions: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Escalation Conditions</label>
                      <textarea rows={2} value={formState.escalation_conditions || ''} onChange={(e) => setFormState({ ...formState, escalation_conditions: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Things AI Must Never Say (comma-separated)</label>
                    <input
                      value={(formState.never_say || []).join(', ')}
                      onChange={(e) => setFormState({ ...formState, never_say: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>
                <button onClick={handleSaveAgent} disabled={isSaving} className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-2 cursor-pointer">
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            )}

            {subTab === 'prompt' && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 space-y-3">
                  <div className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                    <span>AI Prompt Generation Engine (Natural Language → Structured JSON)</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={promptBrief}
                      onChange={(e) => setPromptBrief(e.target.value)}
                      placeholder="e.g., Call real estate leads, ask budget, location, timeline, and schedule a site visit..."
                      className="flex-1 px-3 py-2 rounded-xl border border-orange-200 bg-white text-xs"
                    />
                    <button
                      onClick={handleGeneratePromptInEditor}
                      disabled={isGenerating}
                      className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold cursor-pointer shrink-0"
                    >
                      {isGenerating ? 'Generating...' : 'Generate Prompt'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">System Prompt (v{selectedAgent.current_version || 1})</label>
                  <textarea
                    rows={8}
                    value={formState.system_prompt || ''}
                    onChange={(e) => setFormState({ ...formState, system_prompt: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-mono"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={handleSaveAgent} disabled={isSaving} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-2 cursor-pointer">
                    <Save className="w-4 h-4" />
                    <span>Save New Prompt Version</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const scriptPayload = {
                        name: formState.name || selectedAgent.name,
                        vertical: formState.vertical || selectedAgent.vertical,
                        language: formState.language || selectedAgent.language,
                        greeting_message: formState.greeting_message ?? selectedAgent.greeting_message,
                        system_prompt: formState.system_prompt ?? selectedAgent.system_prompt,
                        structured_config: selectedAgent.structured_config || {},
                      };
                      await navigator.clipboard?.writeText(JSON.stringify(scriptPayload, null, 2));
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedScript ? 'Copied Script JSON!' : 'Copy Script JSON'}</span>
                  </button>
                </div>

                {/* Version History & Side-by-Side Compare */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-500" />
                    <span>Version History ({versions.length})</span>
                  </div>
                  {versions.map((v) => (
                    <div key={v.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900">v{v.version_number}</span>
                        <span className="text-slate-500 ml-2">{v.change_note}</span>
                      </div>
                      <button
                        onClick={async () => {
                          await trivaanaApi.restorePromptVersion(selectedAgent.id, v.id);
                          setFeedback({ type: 'success', message: `Restored prompt from v${v.version_number}.` });
                          loadAgents(selectedAgent.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    </div>
                  ))}

                  {versions.length >= 2 && (
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3 mt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <GitCompare className="w-4 h-4 text-orange-600" /> Side-by-Side Version Compare
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          <select
                            value={compareLeftId || versions[1]?.id || ''}
                            onChange={(e) => setCompareLeftId(e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                          >
                            {versions.map((v) => (
                              <option key={v.id} value={v.id}>v{v.version_number}</option>
                            ))}
                          </select>
                          <span className="text-slate-400">vs</span>
                          <select
                            value={compareRightId || versions[0]?.id || ''}
                            onChange={(e) => setCompareRightId(e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                          >
                            {versions.map((v) => (
                              <option key={v.id} value={v.id}>v{v.version_number}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                        {(() => {
                          const left = versions.find((v) => v.id === (compareLeftId || versions[1]?.id));
                          const right = versions.find((v) => v.id === (compareRightId || versions[0]?.id));
                          return (
                            <>
                              <div className="p-3 rounded-xl bg-white border border-slate-200 max-h-48 overflow-auto whitespace-pre-wrap text-slate-700">
                                <div className="font-sans font-bold text-slate-500 mb-1">v{left?.version_number}</div>
                                {left?.system_prompt || ''}
                              </div>
                              <div className="p-3 rounded-xl bg-white border border-orange-200 max-h-48 overflow-auto whitespace-pre-wrap text-slate-800">
                                <div className="font-sans font-bold text-orange-600 mb-1">v{right?.version_number}</div>
                                {right?.system_prompt || ''}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {subTab === 'workflow' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 text-orange-600" />
                    <span>Interactive Visual Call Flow ({selectedAgent.name})</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Click + Add Node or drag blocks, then Save Flow</span>
                </div>
                <AgentWorkflowCanvas
                  key={selectedAgent.id}
                  agentName={selectedAgent.name}
                  initialGraph={(selectedAgent.structured_config as any)?.flow_graph}
                  onSaveGraph={async (graph) => {
                    const nextConfig = {
                      ...(selectedAgent.structured_config || {}),
                      flow_graph: graph,
                    };
                    const updated = await trivaanaApi.updateAgent(selectedAgent.id, {
                      structured_config: nextConfig,
                    });
                    setSelectedAgent(updated);
                    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
                    setFeedback({ type: 'success', message: 'Visual call flow saved to AI Employee.' });
                  }}
                />
              </div>
            )}

            {subTab === 'voice' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Preferred Language</label>
                    <select
                      value={formState.language || 'te-IN'}
                      onChange={(e) => {
                        const lang = e.target.value;
                        setFormState({ ...formState, language: lang });
                        trivaanaApi.getVoices({ language: lang }).then((r) => setVoices(r.voices || [])).catch(() => {});
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    >
                      {BRAND.languages.map((l) => (
                        <option key={l.code} value={l.code}>{l.name} ({l.nativeName})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Gender Filter</label>
                    <select value={voiceGenderFilter} onChange={(e) => setVoiceGenderFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
                      <option value="">All Genders</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Speaking Speed ({formState.speech_rate || 1.0}x)</label>
                    <input
                      type="range"
                      min="0.6"
                      max="1.5"
                      step="0.05"
                      value={formState.speech_rate || 1.0}
                      onChange={(e) => setFormState({ ...formState, speech_rate: Number(e.target.value) })}
                      className="w-full accent-orange-600 mt-2"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {voices
                    .filter((v) => !voiceGenderFilter || v.gender === voiceGenderFilter)
                    .map((v) => {
                      const active = formState.voice_id === v.provider_voice_id && formState.provider === v.provider;
                      return (
                        <div
                          key={v.id}
                          onClick={() => setFormState({ ...formState, provider: v.provider, voice_id: v.provider_voice_id, voice_model: v.name, voice_gender: v.gender })}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer ${
                            active ? 'bg-orange-50 border-orange-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>{v.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">{v.provider}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                v.verified_status === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {v.verified_status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{v.language} • {v.gender} • {v.description}</div>
                          </div>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const res = await trivaanaApi.testVoiceProfile(v.id);
                              setFeedback({ type: res.verified ? 'success' : 'error', message: res.message || res.error || `Voice test result: ${res.status}` });
                              loadAgentDetails(selectedAgent.id, formState.language);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold cursor-pointer"
                          >
                            Test Provider
                          </button>
                        </div>
                      );
                    })}
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Voice Provider</label>
                    <select
                      value={formState.provider || 'sarvam'}
                      onChange={(e) => setFormState({ ...formState, provider: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="sarvam">Sarvam AI (Bulbul v3 / v4-flash)</option>
                      <option value="elevenlabs">ElevenLabs</option>
                      <option value="openai">OpenAI TTS</option>
                      <option value="indicf5">IndicF5 Self-Hosted</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Quality / Cost Profile</label>
                    <select
                      value={(formState as any).quality_profile || 'balanced'}
                      onChange={(e) => setFormState({ ...formState, quality_profile: e.target.value } as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="economy">Economy (Lowest Cost)</option>
                      <option value="balanced">Balanced (Default)</option>
                      <option value="premium">Premium (Highest Fidelity)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Voice Personality</label>
                    <select
                      value={(formState as any).voice_personality || 'professional'}
                      onChange={(e) => setFormState({ ...formState, voice_personality: e.target.value } as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="conversational">Conversational</option>
                      <option value="warm">Warm</option>
                      <option value="energetic">Energetic</option>
                      <option value="calm">Calm</option>
                      <option value="formal">Formal</option>
                      <option value="sales_oriented">Sales-Oriented</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Custom Voice / Speaker ID</label>
                    <input
                      value={formState.voice_id || ''}
                      onChange={(e) => setFormState({ ...formState, voice_id: e.target.value })}
                      placeholder="e.g. EXAVITQu4vr4xnSDxMaL or shubh / priya"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  {(formState.provider || 'sarvam') === 'sarvam' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Sarvam TTS Model</label>
                      <select
                        value={(formState as any).tts_model_id || 'bulbul:v3'}
                        onChange={(e) => {
                          const nextModel = e.target.value as 'bulbul:v3' | 'bulbul:v4-flash';
                          const lang = formState.language || 'te-IN';
                          const defaultSpk =
                            nextModel === 'bulbul:v4-flash'
                              ? SARVAM_V4_DEFAULT_SPEAKER[lang] || 'shubh_hi_customer'
                              : SARVAM_V3_DEFAULT_SPEAKER[lang] || 'shubh';
                          setFormState({ ...formState, tts_model_id: nextModel, voice_id: defaultSpk } as any);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono"
                      >
                        <option value="bulbul:v3">bulbul:v3 (₹1.76–₹1.99/min API · 11 Languages)</option>
                        <option value="bulbul:v4-flash">bulbul:v4-flash (₹0.84–₹0.99/min API · Low-Latency)</option>
                      </select>
                    </div>
                  )}
                </div>

                {(formState.provider || 'sarvam') === 'sarvam' && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-50/60 to-white border border-orange-200/80 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                          <Volume2 className="w-4 h-4 text-orange-600" />
                          <span>Compare Sarvam Models &amp; Per-Minute Budget ({formState.language || 'te-IN'})</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Audition how each Sarvam TTS model speaks in {formState.language || 'te-IN'} and compare live per-minute cost (TTS + saaras:v4 STT).
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
                        Customer Rate: ₹6.50 / min
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {SARVAM_MODEL_OPTIONS.map((m) => {
                        const lang = formState.language || 'te-IN';
                        const isSupported = m.supportedLangs.includes(lang);
                        const isChosen = ((formState as any).tts_model_id || 'bulbul:v3') === m.id;
                        const isListening = playingModelId === m.id;
                        const isLoading = auditioningModel === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              if (!isSupported) return;
                              const defaultSpk =
                                m.id === 'bulbul:v4-flash'
                                  ? SARVAM_V4_DEFAULT_SPEAKER[lang] || 'shubh_hi_customer'
                                  : SARVAM_V3_DEFAULT_SPEAKER[lang] || 'shubh';
                              setFormState({ ...formState, provider: 'sarvam', tts_model_id: m.id, voice_id: defaultSpk } as any);
                            }}
                            className={`p-3.5 rounded-2xl border transition flex flex-col justify-between gap-2.5 ${
                              !isSupported
                                ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                                : isChosen
                                  ? 'bg-white border-orange-500 ring-2 ring-orange-200 cursor-pointer'
                                  : 'bg-white border-slate-200 hover:border-orange-300 cursor-pointer'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-extrabold text-slate-900 text-xs">{m.name}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-bold">
                                  {m.id}
                                </span>
                              </div>
                              <div className="text-[10px] font-semibold text-slate-500">{m.badge}</div>
                              <p className="text-[11px] text-slate-600">{m.desc}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px]">
                              <div>
                                <div className="text-slate-500">Sarvam API / min</div>
                                <div className="font-extrabold text-slate-900">{m.apiPerMin}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">TTS Rate</div>
                                <div className="font-bold text-slate-800">{m.ttsPerMin}</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <button
                                type="button"
                                disabled={!isSupported || isLoading}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAuditionSarvamModel(m.id, lang, formState.greeting_message);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : isListening ? (
                                  <Square className="w-3 h-3" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                                <span>{isLoading ? 'Loading...' : isListening ? 'Stop Sample' : `Listen ${m.id}`}</span>
                              </button>
                              <span className={`text-[10px] font-bold ${isChosen ? 'text-orange-600' : 'text-slate-500'}`}>
                                {!isSupported ? `Not available for ${lang}` : isChosen ? '✓ Selected' : 'Click to select'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button onClick={handleAuditionVoice} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                    {isPlayingAudio ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlayingAudio ? 'Stop Preview' : 'Preview Voice'}</span>
                  </button>
                  <button onClick={handleSaveAgent} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold flex items-center gap-1.5 cursor-pointer">
                    <Save className="w-3.5 h-3.5" /> Save Voice Settings
                  </button>
                </div>
              </div>
            )}

            {subTab === 'knowledge' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-orange-600" />
                    <span>Attached Knowledge Base Documents ({kbDocs.length})</span>
                  </div>
                </div>
                {kbDocs.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl text-slate-500">
                    No Knowledge Base documents attached. Add documents in the Knowledge Base tab.
                  </div>
                ) : (
                  kbDocs.map((d) => (
                    <div key={d.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{d.title}</div>
                        <div className="text-[11px] text-slate-500">{d.source_type} • {d.chunk_count} vector chunks • {d.status}</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">{d.status}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {subTab === 'actions' && (
              <div className="space-y-4 text-xs">
                <form onSubmit={handleAddAction} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-orange-600" /> Add During-Call AI Action
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      required
                      placeholder="Action Name (e.g., book_site_visit)"
                      value={newAction.name}
                      onChange={(e) => setNewAction({ ...newAction, name: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white"
                    />
                    <select
                      value={newAction.action_type}
                      onChange={(e) => setNewAction({ ...newAction, action_type: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="google_calendar">Google Calendar</option>
                      <option value="whatsapp_template">WhatsApp Cloud API Template</option>
                      <option value="google_sheets">Google Sheets</option>
                      <option value="custom_api">Custom REST API</option>
                      <option value="call_transfer">Human Call Transfer</option>
                      <option value="caller_memory">Caller Memory</option>
                    </select>
                  </div>
                  <input
                    placeholder="Description / When should AI invoke this?"
                    value={newAction.description}
                    onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  />
                  {newAction.action_type === 'custom_api' && (
                    <input
                      placeholder="HTTPS Endpoint URL (https://...)"
                      value={newAction.endpoint}
                      onChange={(e) => setNewAction({ ...newAction, endpoint: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                    />
                  )}
                  <button type="submit" className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">
                    Add Action
                  </button>
                </form>

                <div className="space-y-2">
                  {actions.map((a) => (
                    <div key={a.id} className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{a.name} <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 ml-1">{a.action_type}</span></div>
                        <div className="text-[11px] text-slate-500">{a.description}</div>
                      </div>
                      <button
                        onClick={async () => {
                          await trivaanaApi.deleteAgentAction(selectedAgent.id, a.id);
                          loadAgentDetails(selectedAgent.id, selectedAgent.language);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {subTab === 'calling-rules' && (
              <div className="space-y-4 text-xs">
                <label className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formState.recording_disclosure_enabled ?? true)}
                    onChange={(e) => setFormState({ ...formState, recording_disclosure_enabled: e.target.checked })}
                  />
                  <div>
                    <div className="font-bold text-slate-900">Mandatory Recording & AI Disclosure</div>
                    <div className="text-[11px] text-slate-500">Plays automated recording disclosure at start of call for TRAI/legal compliance.</div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formState.caller_memory_enabled ?? false)}
                    onChange={(e) => setFormState({ ...formState, caller_memory_enabled: e.target.checked })}
                  />
                  <div>
                    <div className="font-bold text-slate-900">Opt-In Returning Caller Memory</div>
                    <div className="text-[11px] text-slate-500">Recognize returning callers and recall prior preferences/appointments (tenant-isolated & deletable).</div>
                  </div>
                </label>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Human Escalation Transfer Number</label>
                  <input
                    value={formState.transfer_number || ''}
                    onChange={(e) => setFormState({ ...formState, transfer_number: e.target.value })}
                    placeholder="+91XXXXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <button onClick={handleSaveAgent} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">
                  Save Calling Rules
                </button>
              </div>
            )}

            {subTab === 'integrations' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 text-white space-y-2">
                  <div className="font-bold text-orange-400 flex items-center gap-1.5">
                    <Webhook className="w-4 h-4" /> Public Instant Lead Intake Endpoint
                  </div>
                  <div className="font-mono text-[11px] bg-slate-900 p-2.5 rounded-xl border border-slate-800 break-all">
                    POST /api/public/lead-intake/{selectedAgent.slug || selectedAgent.id}
                  </div>
                  {rotatedSecret && (
                    <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-700 font-mono text-[11px] text-emerald-300">
                      New Intake Secret (copy now): {rotatedSecret}
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      const res = await trivaanaApi.rotateIntakeSecret(selectedAgent.id);
                      setRotatedSecret(res.intake_secret);
                      setFeedback({ type: 'success', message: 'Rotated public lead intake secret.' });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Generate / Rotate Intake Secret
                  </button>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Post-Call Webhook Override URL</label>
                  <input
                    value={formState.post_call_webhook_url || ''}
                    onChange={(e) => setFormState({ ...formState, post_call_webhook_url: e.target.value })}
                    placeholder="https://hooks.yourcrm.com/trivaana-call"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <button onClick={handleSaveAgent} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer">
                  Save Webhook Settings
                </button>
              </div>
            )}

            {subTab === 'call-history' && (
              <div className="space-y-2 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                  <PhoneCall className="w-4 h-4 text-orange-600" />
                  <span>Calls Handled by {selectedAgent.name} ({agentCalls.length})</span>
                </div>
                {agentCalls.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl text-slate-500">No calls recorded for this AI Employee yet.</div>
                ) : (
                  agentCalls.map((c) => (
                    <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{c.contact_name} ({c.phone})</div>
                        <div className="text-[11px] text-slate-500">{c.direction} • {c.duration}s • {c.outcome}</div>
                      </div>
                      <span className="font-mono font-bold text-slate-900">₹{c.cost.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create AI Employee Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={handleCreateEmployee} className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Create New AI Employee</h3>
              <button type="button" onClick={() => { stopAuditionAudio(); setShowCreateModal(false); }} className="text-xs text-slate-500 cursor-pointer">Cancel</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Employee Name</label>
                <input required value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="e.g. Kavya — Hyderabad Real Estate Advisor" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Industry</label>
                  <input value={newAgentIndustry} onChange={(e) => setNewAgentIndustry(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Language</label>
                  <select
                    value={newAgentLang}
                    onChange={(e) => {
                      const nextLang = e.target.value;
                      setNewAgentLang(nextLang);
                      if (newAgentModel === 'bulbul:v4-flash' && !SARVAM_V4_DEFAULT_SPEAKER[nextLang]) {
                        setNewAgentModel('bulbul:v3');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    {BRAND.languages.map((l) => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-orange-600" />
                    <span>Select Sarvam AI Voice Model &amp; Per-Minute Budget</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-600">Billing: ₹6.50 / min</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SARVAM_MODEL_OPTIONS.map((m) => {
                    const isSupported = m.supportedLangs.includes(newAgentLang);
                    const isSelected = newAgentModel === m.id;
                    const isListening = playingModelId === m.id;
                    const isLoading = auditioningModel === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => isSupported && setNewAgentModel(m.id)}
                        className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                          !isSupported
                            ? 'bg-white/60 border-slate-200 opacity-55 cursor-not-allowed'
                            : isSelected
                              ? 'bg-white border-orange-500 ring-2 ring-orange-200 cursor-pointer'
                              : 'bg-white border-slate-200 hover:border-orange-300 cursor-pointer'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900">{m.name}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-bold">{m.id}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{m.badge}</div>
                          <div className="mt-1.5 text-[10px] text-slate-700 font-semibold">
                            API Stack: <span className="text-slate-900 font-extrabold">{m.apiPerMin}</span> <span className="text-slate-400">({m.ttsPerMin} TTS + STT)</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={!isSupported || isLoading}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAuditionSarvamModel(m.id, newAgentLang);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                          >
                            {isLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : isListening ? (
                              <Square className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                            <span>{isLoading ? 'Loading...' : isListening ? 'Stop' : 'Listen Sample'}</span>
                          </button>
                          <span className={`text-[10px] font-bold ${isSelected ? 'text-orange-600' : 'text-slate-400'}`}>
                            {!isSupported ? `Use bulbul:v3 for ${newAgentLang}` : isSelected ? '✓ Selected' : 'Select'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Describe the Job in Ordinary Language</label>
                <textarea
                  required
                  rows={4}
                  value={newAgentBrief}
                  onChange={(e) => setNewAgentBrief(e.target.value)}
                  placeholder="Create an AI employee who calls real estate leads, asks about property preferences, budget, location, purchase timeline, and schedules a site visit."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
            >
              {isGenerating ? 'Generating Configuration...' : 'Generate AI Employee & Save Draft'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
