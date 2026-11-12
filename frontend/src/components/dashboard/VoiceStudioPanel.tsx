import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Volume2,
  Play,
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
} from 'lucide-react';
import { trivaanaApi } from '@/lib/trivaana-api';
import type { Agent } from '@/types/trivaana';

interface VoiceStudioPanelProps {
  onAgentUpdated?: () => void;
}

const SAMPLE_PHRASES: Record<string, { native: string; romanized: string; codeSwitch: string }> = {
  'te-IN': {
    native: 'నమస్కారం అండి! నేను త్రివానా ఏఐ నుండి మాట్లాడుతున్నాను. మీ గేటెడ్ విల్లా విజిట్ శనివారం ఉదయం 10:30కి బుక్ చేయమంటారా?',
    romanized: 'Namaskaram andi! Mee gated villa site visit Saturday morning 10:30 AM ki book cheyamantara?',
    codeSwitch: 'Hello sir, mee ₹1.40 Crore East-facing villa brochure WhatsApp lo pampinchaanu. Schedule confirm cheddama?',
  },
  'hi-IN': {
    native: 'नमस्ते! मैं अपोलो डेंटल क्लिनिक से बोल रही हूँ। क्या कल सुबह 10:30 बजे का आपका अपॉइंटमेंट कन्फर्म कर दूँ?',
    romanized: 'Namaste! Main Apollo Dental Clinic se bol rahi hoon. Kya kal subah 10:30 baje ka appointment confirm kar doon?',
    codeSwitch: 'Hi Rahul ji, aapka ₹4,999 health checkup slot tomorrow morning 10:30 AM ke liye confirm kar dein?',
  },
  'ta-IN': {
    native: 'வணக்கம்! உங்கள் வணிக கடன் தகுதி சரிபார்ப்பை இரண்டு நிமிடங்களில் முடிக்கலாமா?',
    romanized: 'Vanakkam! Ungal business loan eligibility check-ai 2 minutes-il mudikkalama?',
    codeSwitch: 'Hello sir, ungal ₹25 Lakh MSME loan offer ready-aa irukku. Tomorrow 11 AM call schedule pannalama?',
  },
  'en-IN': {
    native: 'Hi there! Calling from Trivaana AI regarding your NEET 2027 scholarship mock test slot this Sunday at 10 AM.',
    romanized: 'Hi there! Calling from Trivaana AI regarding your NEET 2027 scholarship mock test slot this Sunday at 10 AM.',
    codeSwitch: 'Namaste! Calling from Hyderabad regarding your ₹14,999 annual health membership renewal.',
  },
  'kn-IN': {
    native: 'ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಅನ್ನು ನಾಳೆ ಬೆಳಿಗ್ಗೆ 11 ಗಂಟೆಗೆ ನಿಗದಿಪಡಿಸಬಹುದೇ?',
    romanized: 'Namaskara! Nimma appointment-anna nale beligge 11 gantege fix madabahuda?',
    codeSwitch: 'Hello sir, Indiranagar clinic-nalli tomorrow 11 AM consultation slot confirm madbeka?',
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
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [selectedVoice, setSelectedVoice] = useState<any>(null);
  const [compareVoice, setCompareVoice] = useState<any>(null);
  const [qualityProfile, setQualityProfile] = useState<'economy' | 'balanced' | 'premium'>('balanced');
  const [personality, setPersonality] = useState('professional');
  const [speed, setSpeed] = useState(1.0);
  const [testText, setTestText] = useState(SAMPLE_PHRASES['te-IN'].native);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [lastPreviewMeta, setLastPreviewMeta] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadStudio = useCallback(async () => {
    try {
      const [vRes, lRes, mRes, pRes, aRes, uRes, verRes] = await Promise.all([
        trivaanaApi.getVoices({
          language: selectedLang || undefined,
          category: categoryFilter || undefined,
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
  }, [selectedLang, categoryFilter, search, favoritesOnly, selectedVoice, selectedAgentId]);

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

  const handlePreviewVoice = async (voice: any) => {
    if (playingId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(voice.id);
    setFeedback(null);
    try {
      const res = await trivaanaApi.previewVoice({
        voice_id: voice.provider_voice_id,
        provider: voice.provider || 'elevenlabs',
        language: selectedLang,
        text: testText,
        quality_profile: qualityProfile,
        personality,
        speed,
      });
      if (res.status === 'plan_upgrade_required') {
        setPlayingId(null);
        setFeedback({ type: 'error', message: res.message || 'This voice requires a paid ElevenLabs plan.' });
        return;
      }
      if (!res.audio_base64) {
        setPlayingId(null);
        setFeedback({ type: 'error', message: res.message || 'No audio returned by provider.' });
        return;
      }
      setLastPreviewMeta(res);
      const audio = new Audio(`data:${res.content_type || 'audio/mpeg'};base64,${res.audio_base64}`);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      await audio.play();
      trivaanaApi.getVoiceUsage(30).then(setUsage).catch(() => {});
    } catch (err: any) {
      setPlayingId(null);
      setFeedback({ type: 'error', message: err.message || 'Voice preview failed.' });
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
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
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
                        <div className="font-bold text-xs text-slate-900 truncate">{v.name}</div>
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
                        disabled={restricted}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(v);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{isPlaying ? 'Stop' : 'Preview'}</span>
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
              <div className="font-bold text-slate-900">Selected: {selectedVoice.name}</div>
              <div className="text-[11px] text-slate-600 font-mono break-all">ID: {selectedVoice.provider_voice_id}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={selectedVoice.access_status === 'plan_upgrade_required'}
                  onClick={() => handlePreviewVoice(selectedVoice)}
                  className="flex-1 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Synthesize &amp; Play</span>
                </button>
              </div>
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
        <h2 className="text-sm font-extrabold text-slate-900">Discovered ElevenLabs Speech Models ({models.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2 pr-3">Model ID</th>
                <th className="py-2 pr-3">Quality Tier</th>
                <th className="py-2 pr-3">Latency</th>
                <th className="py-2 pr-3">Indian Languages</th>
                <th className="py-2">Max Chars</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {models.map((m) => (
                <tr key={m.model_id}>
                  <td className="py-2 pr-3 font-mono font-semibold text-slate-900">{m.model_id}</td>
                  <td className="py-2 pr-3 capitalize">{m.quality_tier}</td>
                  <td className="py-2 pr-3 capitalize">{m.latency_tier?.replace('_', ' ')}</td>
                  <td className="py-2 pr-3 text-slate-600">{(m.languages || []).filter((l: string) => ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or', 'as', 'ur'].includes(l)).join(', ')}</td>
                  <td className="py-2 tabular-nums">{m.max_chars_subscribed?.toLocaleString() || '10,000'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

