import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import BRAND from '@/lib/brand';
import { WavesBackground } from '@/components/reactbits';
import { Megaphone, Play, Pause, Plus, Upload, CheckCircle2, AlertCircle, Volume2 } from 'lucide-react';

export const VoiceBroadcastPanel: React.FC = () => {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [language, setLanguage] = useState('te-IN');
  const [voiceProvider, setVoiceProvider] = useState('sarvam');
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [isSandbox, setIsSandbox] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadBroadcasts = async () => {
    try {
      const res = await trivaanaApi.getBroadcasts();
      setBroadcasts(res.broadcasts || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      void loadBroadcasts();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const recipients = recipientsRaw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.split(',').map((p) => p.trim());
        return parts.length >= 2 ? { name: parts[0], phone: parts[1] } : { name: 'Subscriber', phone: parts[0] };
      });
    try {
      const res = await trivaanaApi.createBroadcast({
        name,
        message_text: messageText,
        audio_url: audioUrl || undefined,
        language,
        voice_provider: voiceProvider,
        is_sandbox: isSandbox,
        recipients,
      });
      setName('');
      setMessageText('');
      setAudioUrl('');
      setRecipientsRaw('');
      setFeedback({ type: 'success', message: `Broadcast created with ${res.total_recipients} recipients.` });
      loadBroadcasts();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAudio(true);
    setFeedback(null);
    try {
      const res = await trivaanaApi.uploadBroadcastAudio(file);
      setAudioUrl(res.audio_url);
      setFeedback({ type: 'success', message: `Audio uploaded: ${file.name}` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handlePreviewSpeech = () => {
    if ('speechSynthesis' in window && messageText) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(messageText));
    }
  };

  return (
    <div className="space-y-6">
      <WavesBackground className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
          <Megaphone className="w-3.5 h-3.5 text-orange-600" />
          <span>One-Way Voice Broadcast Module</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Voice Broadcast Announcements</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Send one-way TTS or pre-recorded voice announcements with separate DNC scrubbing, delivery tracking, and separate billing.
        </p>
      </WavesBackground>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleCreate} className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-orange-600" /> Create Voice Broadcast
          </h2>
          <input required placeholder="Broadcast Name (e.g. Festival Offer Alert)" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          <div className="grid grid-cols-2 gap-2">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200">
              {BRAND.languages.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
            <select value={voiceProvider} onChange={(e) => setVoiceProvider(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200">
              <option value="sarvam">Sarvam AI</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="openai">OpenAI TTS</option>
            </select>
          </div>
          <textarea required rows={3} placeholder="Announcement text to synthesize..." value={messageText} onChange={(e) => setMessageText(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handlePreviewSpeech} className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-semibold inline-flex items-center gap-1 cursor-pointer">
              <Volume2 className="w-3.5 h-3.5" /> Preview Message Audio
            </button>
            <label className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold inline-flex items-center gap-1 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploadingAudio ? 'Uploading Audio...' : 'Upload Audio (MP3/WAV)'}</span>
              <input type="file" accept=".mp3,.wav,.ogg,audio/*" onChange={handleAudioUpload} className="hidden" />
            </label>
          </div>
          {audioUrl && (
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-mono text-emerald-800 truncate">
              Attached audio: {audioUrl}
            </div>
          )}
          <textarea rows={4} placeholder={"Recipients (Name, +9198XXXXXXXX per line)"} value={recipientsRaw} onChange={(e) => setRecipientsRaw(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono" />
          <label className="flex items-center gap-2 text-amber-800 cursor-pointer">
            <input type="checkbox" checked={isSandbox} onChange={(e) => setIsSandbox(e.target.checked)} />
            <span>Run in Sandbox Simulation Mode</span>
          </label>
          <button type="submit" className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">Create Broadcast</button>
        </form>

        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3">
          <h2 className="font-display text-base font-bold text-[#0f0f14]">Broadcast Campaigns ({broadcasts.length})</h2>
          {broadcasts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e4e4e9] bg-[#f6f6f8]/60 p-8 text-center space-y-2">
              <div className="font-display text-sm font-bold text-[#0f0f14]">No Broadcast Announcements Created Yet</div>
              <p className="text-xs text-[#6e6e7e] max-w-sm mx-auto">
                Enter an announcement script or upload an MP3/WAV file on the left, paste recipients or upload a CSV, and run DNC-scrubbed broadcasts.
              </p>
            </div>
          ) : (
            broadcasts.map((b) => (
              <div key={b.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>{b.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-bold uppercase">{b.status}</span>
                    {Boolean(b.is_sandbox) && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">Sandbox</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {b.language} • Delivered: {b.delivered_count}/{b.total_recipients} • Cost: ₹{(b.total_cost_paise / 100).toFixed(2)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold flex items-center gap-1 cursor-pointer hover:bg-slate-100">
                    <Upload className="w-3 h-3" /> Import Recipients CSV
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const res = await trivaanaApi.uploadBroadcastCsv(b.id, file);
                          setFeedback({ type: 'success', message: `Added ${res.added_count} CSV recipient(s) to ${b.name}.` });
                          loadBroadcasts();
                        } catch (err: any) {
                          setFeedback({ type: 'error', message: err.message });
                        }
                      }}
                    />
                  </label>
                  <button
                    onClick={async () => {
                      const res = await trivaanaApi.startBroadcast(b.id, Boolean(b.is_sandbox));
                      setFeedback({ type: 'success', message: `Processed ${res.processed_count} broadcast recipients.` });
                      loadBroadcasts();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" /> Start
                  </button>
                  <button
                    onClick={async () => {
                      await trivaanaApi.pauseBroadcast(b.id);
                      loadBroadcasts();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Pause className="w-3 h-3" /> Pause
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

