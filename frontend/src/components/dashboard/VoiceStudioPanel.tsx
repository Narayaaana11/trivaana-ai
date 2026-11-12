import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Square,
  RefreshCw,
  Star,
  Search,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Gauge,
  Coins,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { trivaanaApi } from '@/lib/trivaana-api';
import type { Agent } from '@/types/trivaana';

interface VoiceStudioPanelProps {
  onAgentUpdated?: () => void;
}

const SHOWCASE_ALIAS_BY_VOICE_ID: Record<string, string> = {
  EXAVITQu4vr4xnSDxMaL: 'Priya (Hindi)',
  CwhRBWXzGAHq8TQ4Fs17: 'Aravind (Telugu)',
  TX3LPaxmHKxFdv7VOQHJ: 'Rohan (Indian English)',
  FGY2WhTYpPnrIDTdsKH5: 'Kavya (Tamil)',
};

const SAMPLE_PHRASES: Record<string, { native: string; romanized: string; codeSwitch: string }> = {
  'en-IN': {
    native: "Hello! Welcome to Trivaana AI. I'm your virtual assistant. How can I help you today?",
    romanized: "Hello! Welcome to Trivaana AI. I'm your virtual assistant. How can I help you today?",
    codeSwitch: 'Namaste! Calling from Hyderabad regarding your ₹14,999 annual health membership renewal.',
  },
  'hi-IN': {
    native: 'नमस्ते! ट्रिवाना एआई में आपका स्वागत है। मैं आपकी वर्चुअल असिस्टेंट हूँ। आज मैं आपकी क्या मदद कर सकती हूँ?',
    romanized: 'Namaste! Trivaana AI mein aapka swagat hai. Aaj main aapki kya madad kar sakti hoon?',
    codeSwitch: 'Hi Rahul ji, aapka ₹4,999 health checkup slot tomorrow morning 10:30 AM ke liye confirm kar dein?',
  },
  'te-IN': {
    native: 'నమస్కారం! ట్రివానా ఏఐకి స్వాగతం. నేను మీ వర్చువల్ అసిస్టెంట్ని. ఈరోజు మీకు ఎలా సహాయం చేయగలను?',
    romanized: 'Namaskaram! Trivaana AI ki swagatham. Eeroju meeku ela sahayam cheyagalanu?',
    codeSwitch: 'Hello sir, mee ₹1.40 Crore East-facing villa brochure WhatsApp lo pampinchaanu. Schedule confirm cheddama?',
  },
  'ta-IN': {
    native: 'வணக்கம்! ட்ரிவானா AI-க்கு உங்களை வரவேற்கிறோம். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?',
    romanized: 'Vanakkam! Trivaana AI-kku ungalai varaverkirom. Indru naan ungalukku eppadi udhava mudiyum?',
    codeSwitch: 'Hello sir, ungal ₹25 Lakh MSME loan offer ready-aa irukku. Tomorrow 11 AM call schedule pannalama?',
  },
  'kn-IN': {
    native: 'ನಮಸ್ಕಾರ! ಟ್ರಿವಾನಾ ಎಐಗೆ ಸ್ವಾಗತ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
    romanized: 'Namaskara! Trivaana AI-ge swagata. Indu nanu nimage hege sahaya madabahudu?',
    codeSwitch: 'Hello sir, Indiranagar clinic-nalli tomorrow 11 AM consultation slot confirm madbeka?',
  },
  'ml-IN': {
    native: 'നമസ്കാരം! ട്രിവാന എഐയിലേക്ക് സ്വാഗതം. ഇന്ന് എനിക്ക് നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?',
    romanized: 'Namaskaram! Trivaana AI-yilekku swagatham. Innu enikku ningale engane sahayikkam?',
    codeSwitch: 'Hello sir, Kochi branch-il tomorrow 10:30 AM appointment confirm cheyyamo?',
  },
  'mr-IN': {
    native: 'नमस्कार! ट्रिवाना एआयमध्ये तुमचे स्वागत आहे. आज मी तुम्हाला कशी मदत करू शकते?',
    romanized: 'Namaskar! Trivaana AI madhye tumche swagat ahe. Aaj mi tumhala kashi madat karu shakte?',
    codeSwitch: 'Hello sir, Pune Baner project-cha ₹95 Lakh floor plan WhatsApp var pathavla ahe.',
  },
  'bn-IN': {
    native: 'নমস্কার! ত্রিভানা এআই-তে আপনাকে স্বাগতম। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
    romanized: 'Nomoshkar! Trivaana AI-te apnake shagotom. Aaj ami apnake kibhabe shahajjo korte pari?',
    codeSwitch: 'Hello sir, Salt Lake clinic-e tomorrow 11 AM dental checkup slot confirm korbo?',
  },
  'gu-IN': {
    native: 'નમસ્તે! ત્રિવાના એઆઈમાં આપનું સ્વાગત છે. આજે હું આપને કેવી રીતે મદદ કરી શકું?',
    romanized: 'Namaste! Trivaana AI ma aapnu swagat chhe. Aaje hu aapne kevi rite madad kari shaku?',
    codeSwitch: 'Hello sir, SG Highway showroom ma tomorrow 4 PM test drive book kariye?',
  },
  'pa-IN': {
    native: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਤ੍ਰਿਵਾਨਾ ਏਆਈ ਵਿੱਚ ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ। ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ?',
    romanized: 'Sat Sri Akal! Trivaana AI vich tuhada swagat hai. Ajj main tuhadi ki madad kar sakdi haan?',
    codeSwitch: 'Hello sir, Mohali office vich kal 11 AM appointment confirm kar daiye?',
  },
  'or-IN': {
    native: 'ନମସ୍କାର! ତ୍ରିଭାନା ଏଆଇକୁ ସ୍ୱାଗତ। ଆଜି ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?',
    romanized: 'Namaskar! Trivaana AI-ku swagata. Aji mun apananku kipari sahajya kariparibi?',
    codeSwitch: 'Hello sir, Bhubaneswar clinic-re tomorrow 10 AM slot confirm kariba ki?',
  },
  'as-IN': {
    native: 'নমস্কাৰ! ত্ৰিভানা এআইলৈ স্বাগতম। আজি মই আপোনাক কেনেকৈ সহায় কৰিব পাৰোঁ?',
    romanized: 'Nomoskar! Trivaana AI-loi swagatom. Aji moi aponak kenekoi xohai koribo paron?',
    codeSwitch: 'Hello sir, Guwahati center-ot tomorrow 11 AM appointment confirm korim ne?',
  },
  'ur-IN': {
    native: 'السلام علیکم! تریوانا اے آئی میں خوش آمدید۔ آج میں آپ کی کیا مدد کر سکتی ہوں؟',
    romanized: 'Assalam-o-Alaikum! Trivaana AI mein khush aamdeed. Aaj main aapki kya madad kar sakti hoon?',
    codeSwitch: 'Hello sir, aapka tomorrow 11 AM consultation slot confirm kar dein?',
  },
};

export const VoiceStudioPanel: React.FC<VoiceStudioPanelProps> = ({ onAgentUpdated }) => {
  const [voices, setVoices] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [personalities, setPersonalities] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [verifyStatus, setVerifyStatus] = useState<any>(null);

  const [selectedLang, setSelectedLang] = useState('te-IN');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [accentFilter, setAccentFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [selectedVoice, setSelectedVoice] = useState<any>(null);
  const [compareVoice, setCompareVoice] = useState<any>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>('auto');
  const [qualityProfile, setQualityProfile] = useState<'economy' | 'balanced' | 'premium'>('balanced');
  const [personality, setPersonality] = useState('professional');
  const [speed, setSpeed] = useState(1.0);
  const [testText, setTestText] = useState(SAMPLE_PHRASES['te-IN'].native);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [synthesizingId, setSynthesizingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [nowPlayingInfo, setNowPlayingInfo] = useState<{ voiceName: string; modelId: string } | null>(null);
  const [lastPreviewMeta, setLastPreviewMeta] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadStudio = useCallback(async () => {
    try {
      const [vRes, lRes, mRes, pRes, aRes, uRes, verRes] = await Promise.all([
        trivaanaApi.getVoices({
          language: selectedLang || undefined,
          category: categoryFilter || undefined,
          gender: genderFilter || undefined,
          accent: accentFilter || undefined,
          model_id: selectedModelId !== 'auto' ? selectedModelId : undefined,
          search: search || undefined,
          favorites_only: favoritesOnly || undefined,
        }),
        trivaanaApi.getVoiceLanguages(),
        trivaanaApi.getVoiceModels(),
        trivaanaApi.getVoicePersonalities(),
        trivaanaApi.getAgents(),
        trivaanaApi.getVoiceUsage(30),
        trivaanaApi.verifyElevenLabs(),
      ]);
      const list = vRes.voices || [];
      setVoices(list);
      setLanguages(lRes.languages || []);
      setModels(mRes.models || []);
      setPersonalities(pRes.personalities || []);
      setAgents(aRes.agents || []);
      setUsage(uRes);
      setVerifyStatus(verRes);
      if (list.length > 0 && !selectedVoice) {
        const firstAvail = list.find((v: any) => v.access_status !== 'plan_upgrade_required') || list[0];
        setSelectedVoice(firstAvail);
      }
      if ((aRes.agents || []).length > 0 && !selectedAgentId) {
        setSelectedAgentId(aRes.agents[0].id);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load Voice Studio.' });
    } finally {
      setLoading(false);
    }
  }, [selectedLang, categoryFilter, genderFilter, accentFilter, selectedModelId, search, favoritesOnly, selectedVoice, selectedAgentId]);

  useEffect(() => {
    loadStudio();
  }, [loadStudio]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleSyncCatalog = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await trivaanaApi.syncVoiceCatalog();
      setFeedback({
        type: res.synced ? 'success' : 'error',
        message: res.synced
          ? `Synced ${res.voices_synced} ElevenLabs voices and ${res.models_synced} speech models.`
          : res.reason || 'ElevenLabs sync skipped.',
      });
      await loadStudio();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Catalog sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingId(null);
    setIsPaused(false);
    setNowPlayingInfo(null);
  };

  const togglePauseResume = () => {
    if (!audioRef.current) return;
    if (isPaused) {
      audioRef.current.play().then(() => setIsPaused(false)).catch(() => {
        setFeedback({ type: 'error', message: 'Unable to resume audio playback.' });
      });
    } else {
      audioRef.current.pause();
      setIsPaused(true);
    }
  };

  const handlePreviewVoice = async (voice: any, modelOverride?: string) => {
    if (playingId === voice.id && !modelOverride) {
      stopPlayback();
      return;
    }
    stopPlayback();
    setSynthesizingId(voice.id);
    setFeedback(null);
    const modelToUse = modelOverride || (selectedModelId !== 'auto' ? selectedModelId : undefined);
    try {
      const res = await trivaanaApi.previewVoice({
        voice_id: voice.provider_voice_id,
        provider: voice.provider || 'elevenlabs',
        language: selectedLang,
        text: testText,
        quality_profile: qualityProfile,
        personality,
        model_id: modelToUse,
        speed,
      });
      if (res.status === 'plan_upgrade_required') {
        setFeedback({ type: 'error', message: res.message || 'This voice requires a paid ElevenLabs plan.' });
        return;
      }
      if (!res.audio_base64) {
        setFeedback({ type: 'error', message: res.message || 'No audio returned by ElevenLabs.' });
        return;
      }
      setLastPreviewMeta(res);
      setNowPlayingInfo({ voiceName: voice.name, modelId: res.model_used || modelToUse || 'eleven_v4_turbo' });
      const audio = new Audio(`data:${res.content_type || 'audio/mpeg'};base64,${res.audio_base64}`);
      audioRef.current = audio;
      setPlayingId(voice.id);
      setIsPaused(false);
      audio.onended = () => stopPlayback();
      audio.onerror = () => {
        setFeedback({ type: 'error', message: `Audio element failed to decode ElevenLabs output for ${voice.name}.` });
        stopPlayback();
      };
      await audio.play();
      trivaanaApi.getVoiceUsage(30).then(setUsage).catch(() => {});
    } catch (err: any) {
      stopPlayback();
      setFeedback({ type: 'error', message: err.message || 'Voice preview failed.' });
    } finally {
      setSynthesizingId(null);
    }
  };

  const handleToggleFavorite = async (voice: any) => {
    try {
      await trivaanaApi.toggleFavoriteVoice(voice.id, !voice.is_favorite);
      setVoices((prev) => prev.map((v) => (v.id === voice.id ? { ...v, is_favorite: !v.is_favorite } : v)));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Could not update favorite.' });
    }
  };

  const handleAssignToAgent = async () => {
    if (!selectedVoice || !selectedAgentId) return;
    try {
      const pCfg = personalities.find((p) => p.id === personality);
      await trivaanaApi.updateAgent(selectedAgentId, {
        provider: selectedVoice.provider || 'elevenlabs',
        voice_id: selectedVoice.provider_voice_id,
        voice_profile_id: selectedVoice.id,
        voice_model: selectedVoice.name,
        voice_gender: selectedVoice.gender,
        language: selectedLang,
        quality_profile: qualityProfile,
        voice_personality: personality,
        speech_rate: speed,
        voice_stability: pCfg?.stability ?? 0.55,
        voice_similarity: pCfg?.similarity_boost ?? 0.78,
        voice_style: pCfg?.style ?? 0.05,
        change_note: `Assigned ${selectedVoice.name} (${qualityProfile}/${personality}) from Voice Studio`,
      });
      setFeedback({
        type: 'success',
        message: `Assigned "${selectedVoice.name}" (${qualityProfile} · ${personality}) to selected AI Employee.`,
      });
      onAgentUpdated?.();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to assign voice to AI Employee.' });
    }
  };

  const activeLangInfo = languages.find((l) => l.code === selectedLang);
  const samplePack = SAMPLE_PHRASES[selectedLang] || SAMPLE_PHRASES['en-IN'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-orange-600" />
            <span>Voice Studio &amp; ElevenLabs Indian Catalog</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live ElevenLabs voice discovery, 13 Indian languages, Economy/Balanced/Premium cost profiles, and AI Employee assignment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {verifyStatus && (
            <span
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border ${
                verifyStatus.connected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {verifyStatus.connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span>
                {verifyStatus.connected
                  ? `ElevenLabs Connected (${verifyStatus.tts_models_count || 0} TTS models)`
                  : verifyStatus.reason || 'Not connected'}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSyncCatalog}
            disabled={syncing}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Refresh Catalogue'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Usage & Cost Metering Telemetry Strip */}
      {usage && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90">
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-orange-600" /> 30-Day Characters
            </div>
            <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">{usage.total_characters?.toLocaleString() || 0}</div>
            <div className="text-[10px] text-slate-400">Billed: {usage.billed_characters?.toLocaleString() || 0} chars</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90">
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> TTS Cache Hit Rate
            </div>
            <div className="text-xl font-black text-emerald-700 mt-1 tabular-nums">{usage.cache_hit_rate_pct ?? 0}%</div>
            <div className="text-[10px] text-slate-400">{usage.cache_hits || 0} / {usage.total_requests || 0} requests cached</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90">
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-600" /> Estimated TTS Cost
            </div>
            <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">₹{Number(usage.estimated_cost_inr || 0).toFixed(2)}</div>
            <div className="text-[10px] text-slate-400">Avg latency: {usage.avg_latency_ms || 0} ms</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90">
            <div className="text-[11px] text-slate-500 font-semibold">Active Language Model</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1 font-mono truncate">
              {qualityProfile === 'economy'
                ? activeLangInfo?.recommended_economy_model || 'eleven_flash_v2_5'
                : qualityProfile === 'premium'
                ? activeLangInfo?.recommended_premium_model || 'eleven_v4'
                : activeLangInfo?.recommended_balanced_model || 'eleven_v4_turbo'}
            </div>
            <div className="text-[10px] text-slate-400 capitalize">{qualityProfile} profile · {selectedLang}</div>
          </div>
        </div>
      )}

      {/* Filters & Controls */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div>
          <label htmlFor="vs-language" className="block font-bold text-slate-700 mb-1">Indian Language (13)</label>
          <select
            id="vs-language"
            value={selectedLang}
            onChange={(e) => {
              const lang = e.target.value;
              setSelectedLang(lang);
              const p = SAMPLE_PHRASES[lang];
              if (p) setTestText(p.native);
            }}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.native})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vs-search" className="block font-bold text-slate-700 mb-1">Search Voices</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="vs-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, accent, ID..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200"
            />
          </div>
        </div>
        <div>
          <label htmlFor="vs-category" className="block font-bold text-slate-700 mb-1">Category</label>
          <select
            id="vs-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
          >
            <option value="">All Categories</option>
            <option value="premade">Premade (Included)</option>
            <option value="professional">Professional Library</option>
            <option value="cloned">Custom Cloned</option>
          </select>
        </div>
        <div>
          <label htmlFor="vs-gender" className="block font-bold text-slate-700 mb-1">Gender</label>
          <select
            id="vs-gender"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
          >
            <option value="">All Genders</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
        <div>
          <label htmlFor="vs-accent" className="block font-bold text-slate-700 mb-1">Accent</label>
          <select
            id="vs-accent"
            value={accentFilter}
            onChange={(e) => setAccentFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
          >
            <option value="">All Accents</option>
            <option value="american">American</option>
            <option value="british">British</option>
            <option value="australian">Australian</option>
            <option value="indian">Indian</option>
            <option value="standard">Standard</option>
          </select>
        </div>
        <div>
          <label htmlFor="vs-model" className="block font-bold text-slate-700 mb-1">ElevenLabs TTS Model</label>
          <select
            id="vs-model"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono"
          >
            <option value="auto">Auto (By Quality Profile)</option>
            {models
              .filter((m) => m.can_do_tts !== false && m.availability_status !== 'restricted')
              .map((m) => {
                const iso = selectedLang.split('-')[0].toLowerCase();
                const langOk = (m.languages || []).includes(iso);
                return (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_id} {!langOk ? `(Unsupported for ${selectedLang})` : ''}
                  </option>
                );
              })}
          </select>
        </div>
        <div>
          <label htmlFor="vs-profile" className="block font-bold text-slate-700 mb-1">Quality / Cost Profile</label>
          <select
            id="vs-profile"
            value={qualityProfile}
            onChange={(e) => setQualityProfile(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
          >
            <option value="economy">Economy (Lowest Cost)</option>
            <option value="balanced">Balanced (Default)</option>
            <option value="premium">Premium (Highest Fidelity)</option>
          </select>
        </div>
        <div>
          <label htmlFor="vs-personality" className="block font-bold text-slate-700 mb-1">Voice Personality</label>
          <select
            id="vs-personality"
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
          >
            {personalities.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Voice Library */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200/90 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">
              Discovered Voices ({voices.length})
            </h2>
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer border ${
                favoritesOnly ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>Favorites Only</span>
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading ElevenLabs &amp; Indian voice catalog...</div>
          ) : voices.length === 0 ? (
            <div className="py-10 text-center space-y-2 text-xs text-slate-500">
              <p>No voices matched your filters yet. Click &ldquo;Refresh Catalogue&rdquo; to sync live ElevenLabs voices.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
              {voices.map((v) => {
                const isSelected = selectedVoice?.id === v.id;
                const isPlaying = playingId === v.id;
                const restricted = v.access_status === 'plan_upgrade_required';
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVoice(v)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                      isSelected ? 'bg-orange-50/70 border-orange-400' : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 truncate">{v.name}</span>
                          {SHOWCASE_ALIAS_BY_VOICE_ID[v.provider_voice_id] && (
                            <span className="px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[9px] font-bold">
                              Showcase: {SHOWCASE_ALIAS_BY_VOICE_ID[v.provider_voice_id]}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">{v.provider_voice_id}</div>
                      </div>
                      <button
                        type="button"
                        aria-label={v.is_favorite ? 'Remove from favorites' : 'Save to favorites'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(v);
                        }}
                        className="p-1 rounded-lg hover:bg-white cursor-pointer"
                      >
                        <Star className={`w-3.5 h-3.5 ${v.is_favorite ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-semibold text-slate-700 uppercase">
                        {v.provider}
                      </span>
                      {v.category && (
                        <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 capitalize">
                          {v.category}
                        </span>
                      )}
                      {v.accent && (
                        <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 capitalize">
                          {v.accent}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold ${
                          restricted ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {restricted ? 'Paid Plan Required' : 'Available'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
                      <button
                        type="button"
                        disabled={restricted || synthesizingId === v.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(v);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        {synthesizingId === v.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isPlaying ? (
                          <Square className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        <span>{synthesizingId === v.id ? 'Generating...' : isPlaying ? 'Stop' : 'Play'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCompareVoice(v);
                        }}
                        className="text-[11px] font-semibold text-orange-600 hover:underline cursor-pointer"
                      >
                        Compare
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Test Bench & AI Employee Assignment */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-4 text-xs">
          <h2 className="text-sm font-extrabold text-slate-900">Speech Test Bench &amp; Assignment</h2>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-700">Quick Script Presets</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setTestText(samplePack.native)} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold cursor-pointer">
                Native Script
              </button>
              <button type="button" onClick={() => setTestText(samplePack.romanized)} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold cursor-pointer">
                Romanised
              </button>
              <button type="button" onClick={() => setTestText(samplePack.codeSwitch)} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold cursor-pointer">
                Code-Switch
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="vs-test-text" className="block font-bold text-slate-700 mb-1">
              Test Utterance ({testText.length} chars)
            </label>
            <textarea
              id="vs-test-text"
              rows={3}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 leading-relaxed"
            />
          </div>

          <div>
            <label htmlFor="vs-speed" className="block font-bold text-slate-700 mb-1">
              Speaking Speed ({speed.toFixed(2)}x)
            </label>
            <input
              id="vs-speed"
              type="range"
              min="0.7"
              max="1.2"
              step="0.02"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-orange-600"
            />
          </div>

          {selectedVoice && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900">
                Selected: {selectedVoice.name}
                {SHOWCASE_ALIAS_BY_VOICE_ID[selectedVoice.provider_voice_id]
                  ? ` (${SHOWCASE_ALIAS_BY_VOICE_ID[selectedVoice.provider_voice_id]})`
                  : ''}
              </div>
              <div className="text-[11px] text-slate-600 font-mono break-all">
                ID: {selectedVoice.provider_voice_id} · Model: {selectedModelId === 'auto' ? `Auto (${qualityProfile})` : selectedModelId}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={selectedVoice.access_status === 'plan_upgrade_required' || synthesizingId === selectedVoice.id}
                  onClick={() => handlePreviewVoice(selectedVoice)}
                  className="flex-1 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  {synthesizingId === selectedVoice.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>{synthesizingId === selectedVoice.id ? 'Generating...' : 'Generate & Play'}</span>
                </button>
                {playingId && (
                  <>
                    <button
                      type="button"
                      onClick={togglePauseResume}
                      className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopPlayback}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </button>
                  </>
                )}
              </div>
              {nowPlayingInfo && (
                <div className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-2.5 py-1.5">
                  {isPaused ? 'Paused' : 'Playing'}: {nowPlayingInfo.voiceName} · <span className="font-mono">{nowPlayingInfo.modelId}</span>
                </div>
              )}
            </div>
          )}

          {compareVoice && (
            <div className="p-3 rounded-2xl bg-orange-50/50 border border-orange-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Compare: {compareVoice.name}</span>
                <button
                  type="button"
                  disabled={compareVoice.access_status === 'plan_upgrade_required'}
                  onClick={() => handlePreviewVoice(compareVoice)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold cursor-pointer disabled:opacity-40"
                >
                  Play Compare
                </button>
              </div>
            </div>
          )}

          {lastPreviewMeta && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
              <div className="font-bold">Last Synthesis Telemetry</div>
              <div>Model: <span className="font-mono">{lastPreviewMeta.model_used}</span></div>
              <div>Latency: {lastPreviewMeta.latency_ms} ms · Cache hit: {String(lastPreviewMeta.cache_hit)}</div>
              <div>Estimated cost: ₹{((lastPreviewMeta.estimated_cost_paise || 0) / 100).toFixed(2)}</div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 space-y-2">
            <label htmlFor="vs-assign-agent" className="font-bold text-slate-700 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-orange-600" />
              <span>Assign Voice to AI Employee</span>
            </label>
            <select
              id="vs-assign-agent"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.language})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedVoice || !selectedAgentId}
              onClick={handleAssignToAgent}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer disabled:opacity-40"
            >
              Save Voice to AI Employee
            </button>
          </div>
        </div>
      </div>

      {/* Model Discovery Reference Table */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900">Discovered ElevenLabs Speech Models ({models.length})</h2>
          <span className="text-[11px] text-slate-500">Select a compatible model to audition with the active voice &amp; language</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3">Status ({selectedLang})</th>
                <th className="py-2 pr-3">Capabilities</th>
                <th className="py-2 pr-3">Indian Languages</th>
                <th className="py-2 pr-3">Max Chars</th>
                <th className="py-2">Test</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {models.map((m) => {
                const iso = selectedLang.split('-')[0].toLowerCase();
                const langSupported = (m.languages || []).includes(iso);
                const canTts = m.can_do_tts !== false && m.availability_status !== 'restricted';
                const statusBadge = !canTts
                  ? { label: 'Restricted / Non-TTS', cls: 'bg-red-100 text-red-700' }
                  : !langSupported
                  ? { label: `Unsupported (${selectedLang})`, cls: 'bg-slate-100 text-slate-600' }
                  : m.experimental
                  ? { label: 'Experimental', cls: 'bg-amber-100 text-amber-800' }
                  : { label: 'Available', cls: 'bg-emerald-100 text-emerald-700' };
                return (
                  <tr key={m.model_id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-mono font-semibold text-slate-900">{m.model_id}</div>
                      <div className="text-[11px] text-slate-500">{m.name}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-[11px] text-slate-600">
                      {[
                        canTts ? 'TTS' : null,
                        m.streaming_supported ? 'Streaming' : null,
                        m.low_latency_suitable ? 'Low Latency' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {(m.languages || [])
                        .filter((l: string) => ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or', 'as', 'ur'].includes(l))
                        .join(', ') || '—'}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{m.max_chars_subscribed?.toLocaleString() || '10,000'}</td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        disabled={!canTts || !langSupported || !selectedVoice}
                        onClick={() => {
                          setSelectedModelId(m.model_id);
                          if (selectedVoice) handlePreviewVoice(selectedVoice, m.model_id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold cursor-pointer disabled:opacity-40"
                      >
                        Listen
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

