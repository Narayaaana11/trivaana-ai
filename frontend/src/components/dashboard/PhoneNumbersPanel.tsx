import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Agent } from '@/types/trivaana';
import { Hash, Plus, CheckCircle2, AlertCircle, Layers, ShieldCheck, PhoneCall } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export const PhoneNumbersPanel: React.FC = () => {
  const [numbers, setNumbers] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [provider, setProvider] = useState('exotel');
  const [category, setCategory] = useState('service_140_160');
  const [channelCount, setChannelCount] = useState(2);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    try {
      const [nRes, aRes] = await Promise.all([
        trivaanaApi.getPhoneNumbers(),
        trivaanaApi.getAgents(),
      ]);
      setNumbers(nRes.phone_numbers || []);
      setChannels(nRes.channels || []);
      setAgents(aRes.agents || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const handleRegisterNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await trivaanaApi.requestPhoneNumber({
        phone_number: phoneInput,
        provider,
        compliance_category: category,
        channel_count: channelCount,
      });
      setPhoneInput('');
      setFeedback({
        type: res.config_error ? 'error' : 'success',
        message: res.config_error || `Number registered with status: ${res.status} (KYC: ${res.kyc_status}).`,
      });
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white border border-[#e4e4e9] shadow-2xs space-y-4">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#fff7ed] text-[#c2410c] text-xs font-semibold w-fit mb-2 border border-[#fed7aa]">
            <Hash className="w-3.5 h-3.5 text-[#ff5500]" />
            <span>Phone Numbers &amp; Separate Concurrent Channels</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-[#0f0f14] tracking-tight">Phone Numbers, KYC &amp; Channel Capacity</h1>
          <p className="text-xs sm:text-sm text-[#525260] mt-1">
            Manage provider-eligible phone numbers, KYC compliance categories, inbound AI routing, and concurrent calling channels.
          </p>
        </div>

        {/* Outpero-Style Number Plan & KYC Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2 border-t border-[#e4e4e9]">
          <div className="p-3.5 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9]">
            <div className="flex justify-between font-bold text-[#0f0f14]">
              <span>Mobile Virtual (+91)</span>
              <span className="text-[#ff5500] tabular-nums">₹999/mo</span>
            </div>
            <p className="text-[11px] text-[#6e6e7e] mt-1">Instant activation for Exotel, Plivo &amp; Vobiz business outreach.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9]">
            <div className="flex justify-between font-bold text-[#0f0f14]">
              <span>Business Landline / DID</span>
              <span className="text-[#0f0f14] tabular-nums">₹1,499/mo</span>
            </div>
            <p className="text-[11px] text-[#6e6e7e] mt-1">044 / 080 / 040 / 022 regional landline with 160-series trust.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-emerald-900">KYC Verification Guard</div>
              <p className="text-[11px] text-emerald-800 mt-0.5">DLT / Business GSTIN KYC required for live Indian PSTN caller ID.</p>
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleRegisterNumber} className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3 text-xs">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-orange-600" /> Connect Eligible Number
          </div>
          <input required placeholder="Eligible Number (+9180XXXXXXXX)" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
            <option value="exotel">Exotel (India PSTN)</option>
            <option value="plivo">Plivo (India & Global PSTN)</option>
            <option value="vobiz">Vobiz (India SIP/PSTN)</option>
            <option value="twilio">Twilio (Global PSTN)</option>
          </select>
          <button
            type="button"
            onClick={async () => {
              setFeedback(null);
              try {
                const res = await trivaanaApi.verifyPhoneNumbers(provider);
                setFeedback({
                  type: res.verified ? 'success' : 'error',
                  message: res.verified
                    ? `Verified ${res.numbers.length} owned ${provider.toUpperCase()} number(s): ${res.numbers.join(', ') || 'None'}`
                    : res.error || `Could not verify ${provider.toUpperCase()} numbers.`,
                });
              } catch (err: any) {
                setFeedback({ type: 'error', message: err.message });
              }
            }}
            className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
          >
            Sync / Verify Owned {provider.toUpperCase()} Numbers
          </button>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
            <option value="service_140_160">Service / Transactional (160/DID Series)</option>
            <option value="promotional_140">Promotional (140 Series)</option>
            <option value="sandbox_virtual">Sandbox Virtual Testing</option>
          </select>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Concurrent Channels</label>
            <input type="number" min={1} max={100} value={channelCount} onChange={(e) => setChannelCount(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <button type="submit" className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">Register Number</button>
        </form>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3 text-xs">
            <div className="font-bold text-slate-900">Assigned Phone Numbers ({numbers.length})</div>
            {numbers.map((n) => (
              <div key={n.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono font-black text-sm text-slate-900">{n.phone_number}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {n.provider.toUpperCase()} • KYC: <strong>{n.kyc_status}</strong> • Category: {n.compliance_category}
                  </div>
                  {n.config_error && <div className="text-[11px] text-amber-700 mt-1">{n.config_error}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={n.inbound_agent_id || ''}
                    onChange={async (e) => {
                      await trivaanaApi.updatePhoneNumber(n.id, { inbound_agent_id: e.target.value });
                      loadData();
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px]"
                  >
                    <option value="">Unassigned Inbound</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3 text-xs">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-orange-600" /> Concurrent Calling Channel Pools ({channels.length})
            </div>
            {channels.length === 0 && (
              <EmptyState
                compact
                icon={PhoneCall}
                title="No Channel Pools Allocated Yet"
                description="Register a verified business number on the left to provision dedicated concurrent outbound and inbound calling capacity."
              />
            )}
            {channels.map((ch) => (
              <div key={ch.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{ch.provider.toUpperCase()} Channel Pool</div>
                  <div className="text-[11px] text-slate-500">Capacity: {ch.channel_capacity} concurrent calls • Active: {ch.active_calls_count}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] uppercase">{ch.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

