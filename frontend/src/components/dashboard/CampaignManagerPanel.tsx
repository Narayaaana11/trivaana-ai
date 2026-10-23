import React, { useState } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import {
  PhoneForwarded,
  ShieldAlert,
  AlertTriangle,
  Play,
  Square,
  ShieldCheck,
  Clock,
  Zap,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

interface CampaignManagerPanelProps {
  onCampaignUpdated?: () => void;
}

export const CampaignManagerPanel: React.FC<CampaignManagerPanelProps> = ({
  onCampaignUpdated,
}) => {
  const [concurrency, setConcurrency] = useState<number>(5);
  const [maxCalls, setMaxCalls] = useState<number>(10);
  const [bypassTrai, setBypassTrai] = useState<boolean>(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isKilling, setIsKilling] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<any>(null);

  // Check TRAI window (10:00 to 18:00 IST)
  const currentHour = new Date().getHours();
  const isInsideTraiWindow = currentHour >= 10 && currentHour < 18;

  const handleStartCampaign = async () => {
    setIsStarting(true);
    try {
      const res = await trivaanaApi.startCampaign(concurrency, maxCalls, bypassTrai);
      setCampaignStatus(res);
      alert(res.message);
      if (onCampaignUpdated) onCampaignUpdated();
    } catch (err: any) {
      alert(`Failed to start campaign: ${err.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleKillCampaign = async () => {
    setIsKilling(true);
    try {
      const res = await trivaanaApi.killCampaign();
      setCampaignStatus(null);
      alert(res.message);
      if (onCampaignUpdated) onCampaignUpdated();
    } catch (err: any) {
      alert(`Failed to kill campaign: ${err.message}`);
    } finally {
      setIsKilling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-3 border border-orange-200">
          <PhoneForwarded className="w-3.5 h-3.5 text-orange-600" />
          <span>High-Throughput Multi-Line Telecalling</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Outbound Campaign Dialer & TRAI Compliance
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Automate high-speed lead qualification across 1 to 20 concurrent SIP lines with mandatory TRAI regulation enforcement and instant emergency kill switches.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Dialer Controls */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-6">
          <h2 className="text-base font-bold text-slate-900">
            Campaign Configuration
          </h2>

          {/* Concurrency Selector */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-800">
                Simultaneous Calling Lines (Concurrency)
              </label>
              <span className="text-xs font-mono font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                {concurrency} Active Lines
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>1 Line (Gentle)</span>
              <span>10 Lines (High Velocity)</span>
              <span>20 Lines (Fleet)</span>
            </div>
          </div>

          {/* Max Calls Batch Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-800">
                Batch Contact Cap
              </label>
              <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {maxCalls} Contacts
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={maxCalls}
              onChange={(e) => setMaxCalls(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
          </div>

          {/* TRAI Enforcement Gate */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <h4 className="text-xs font-bold text-slate-900">
                  TRAI Regulation Window Gate (10:00 AM - 6:00 PM IST)
                </h4>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isInsideTraiWindow
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {isInsideTraiWindow ? 'Window Open' : 'Calling Suppressed'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Telecom Regulatory Authority of India mandates telemarketing calls may only occur between 10:00 AM and 6:00 PM Indian Standard Time.
            </p>

            <label className="flex items-center gap-2 text-xs text-slate-700 font-medium pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={bypassTrai}
                onChange={(e) => setBypassTrai(e.target.checked)}
                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
              />
              <span>Developer Sandbox Override (Permit test dialing outside legal window)</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleStartCampaign}
              disabled={isStarting}
              className="flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              {isStarting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Launching Dialer...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Outbound Campaign</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Emergency Kill Switch & Telemetry */}
        <div className="lg:col-span-5 space-y-6">
          {/* Emergency Kill Switch Card */}
          <div className="bg-red-50/80 rounded-3xl p-6 border-2 border-red-200 shadow-2xs">
            <div className="flex items-center gap-2 text-red-700 font-bold text-xs mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Safety Protocol</span>
            </div>
            <h3 className="text-base font-extrabold text-red-950 mb-1">
              Emergency Concurrency Kill Switch
            </h3>
            <p className="text-xs text-red-800/80 leading-relaxed mb-4">
              Instantly terminates all active multi-line dialing threads and releases all SIP trunk reservations across all campaigns.
            </p>

            <button
              onClick={handleKillCampaign}
              disabled={isKilling}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isKilling ? 'Aborting Call Threads...' : 'KILL ALL LIVE CAMPAIGNS'}</span>
            </button>
          </div>

          {/* Campaign Telemetry Card */}
          <div className="bg-slate-950 rounded-3xl p-6 text-white border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                Dialer Telemetry
              </span>
              <span className="text-xs font-mono text-emerald-400">
                SIP Trunk: Active
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Configured Concurrency</span>
                <span className="font-mono font-bold text-white">{concurrency} lines</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Campaign Target</span>
                <span className="font-mono font-bold text-white">{maxCalls} prospects</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">NDNC Scrubbing Engine</span>
                <span className="text-emerald-400 font-bold">100% Automated</span>
              </div>
            </div>

            {campaignStatus && (
              <div className="mt-4 p-3 rounded-xl bg-orange-950/80 border border-orange-800 text-xs text-orange-300">
                {campaignStatus.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
