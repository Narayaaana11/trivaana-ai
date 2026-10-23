import React from 'react';
import { CountUp } from '@/components/reactbits';
import {
  Wallet,
  Users,
  PhoneCall,
  Clock,
  CalendarCheck,
  Zap,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { AnalyticsStats, Tenant, CallLog } from '@/types/trivaana';

interface OverviewPanelProps {
  stats: AnalyticsStats | null;
  tenant: Tenant | null;
  calls: CallLog[];
  onNavigateTab: (tab: any) => void;
  onOpenSimulator: () => void;
}

const HOURLY_CALL_DATA = [
  { time: '10:00', calls: 18, connects: 14, qualified: 6 },
  { time: '11:00', calls: 35, connects: 29, qualified: 12 },
  { time: '12:00', calls: 42, connects: 36, qualified: 15 },
  { time: '13:00', calls: 24, connects: 19, qualified: 7 },
  { time: '14:00', calls: 28, connects: 22, qualified: 9 },
  { time: '15:00', calls: 49, connects: 41, qualified: 18 },
  { time: '16:00', calls: 56, connects: 48, qualified: 22 },
  { time: '17:00', calls: 38, connects: 31, qualified: 14 },
];

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  stats,
  tenant,
  calls,
  onNavigateTab,
  onOpenSimulator,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 text-white shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-md mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Autonomous Telephony Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Trivaana Mission Control
          </h1>
          <p className="text-xs sm:text-sm text-orange-100 mt-1 max-w-xl">
            {tenant?.name || 'Trivaana Enterprise Suite'} • Sub-30s Speed-to-Lead Engine & Multi-Line Vernacular Telecalling.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigateTab('speed-to-lead')}
            className="px-4 py-2.5 rounded-xl bg-white text-orange-600 font-bold text-xs hover:bg-orange-50 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Instant Lead Callback</span>
          </button>
          <button
            onClick={onOpenSimulator}
            className="px-4 py-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-950/60 text-white font-bold text-xs border border-white/20 backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Dialer Sandbox</span>
          </button>
        </div>
      </div>

      {/* 6 Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Metric 1: Wallet Balance */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium">Prepaid Wallet</span>
            <Wallet className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono">
            ₹<CountUp to={stats?.wallet_balance_inr ?? 5000} duration={1} separator="," />
          </div>
          <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 mt-1">
            <ArrowUpRight className="w-2.5 h-2.5" /> Zero Float Drift
          </span>
        </div>

        {/* Metric 2: Total Leads */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium">CRM Leads</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono">
            <CountUp to={stats?.total_leads ?? 24} duration={1} />
          </div>
          <span className="text-[10px] text-slate-500 font-medium block mt-1">
            OSM Scout + Inbound
          </span>
        </div>

        {/* Metric 3: Calls Placed */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium">Calls Placed</span>
            <PhoneCall className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono">
            <CountUp to={stats?.total_calls_placed ?? 18} duration={1} />
          </div>
          <span className="text-[10px] text-emerald-600 font-medium block mt-1">
            91.4% Connect Rate
          </span>
        </div>

        {/* Metric 4: Total Minutes */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium">Connected Talk Time</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono">
            <CountUp to={stats?.total_duration_minutes ?? 42} duration={1} />
            <span className="text-xs font-normal text-slate-500 ml-1">mins</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium block mt-1">
            Avg 2.3 min / call
          </span>
        </div>

        {/* Metric 5: Demos Booked */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium">Demos Booked</span>
            <CalendarCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-600 font-mono">
            <CountUp to={stats?.demos_booked ?? 7} duration={1} />
          </div>
          <span className="text-[10px] text-amber-700 font-medium block mt-1">
            {stats?.demo_conversion_rate ?? '38.9%'} Conversion
          </span>
        </div>

        {/* Metric 6: Turn-Taking Latency */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium">Audio Latency</span>
            <Zap className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono">
            <CountUp to={stats?.turn_taking_latency_ms ?? 420} duration={1} />
            <span className="text-xs font-normal text-slate-500 ml-1">ms</span>
          </div>
          <span className="text-[10px] text-rose-600 font-medium block mt-1">
            Ultra-Low Latency
          </span>
        </div>
      </div>

      {/* Main Content Split: Chart on Left, Fast Speed-to-lead on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Hourly Trajectory Chart */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Today’s Telecalling Velocity & Conversion
              </h2>
              <p className="text-xs text-slate-500">
                Hourly call distribution under TRAI compliant calling window (10:00 AM - 6:00 PM IST)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Total Calls
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Demos Booked
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={HOURLY_CALL_DATA}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff5500" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ff5500" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorQualified" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke="#ff5500"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCalls)"
                />
                <Area
                  type="monotone"
                  dataKey="qualified"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorQualified)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Speed-to-Lead Quick Trigger Card */}
        <div className="lg:col-span-4 bg-slate-950 rounded-3xl p-6 text-white border border-slate-800 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Speed to Lead Engine
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                &lt; 30s SLA
              </span>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              Autonomous Inbound Intercept
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              When a lead fills out your website form or Facebook Ad, Trivaana initiates an outbound phone call before they even close their browser tab.
            </p>

            <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Current Mode:</span>
                <span className="text-emerald-400 font-bold">Autonomous Auto-Dial</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Default Dialect:</span>
                <span className="text-orange-400 font-bold">Telugu (తెలుగు) / Hindi</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Fallback:</span>
                <span className="text-slate-400">WhatsApp Meeting Invite</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={() => onNavigateTab('speed-to-lead')}
              className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Test Live Speed-to-Lead Call</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Telecalling Intelligence Feed */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Live Call Transcripts & Outcomes
            </h2>
            <p className="text-xs text-slate-500">
              Real-time conversational logs with sentiment tagging and WhatsApp confirmation
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('intelligence')}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
          >
            <span>View All Records</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                <th className="pb-3 pl-2">Lead Name</th>
                <th className="pb-3">Phone</th>
                <th className="pb-3">Language</th>
                <th className="pb-3">Duration</th>
                <th className="pb-3">Outcome</th>
                <th className="pb-3">Cost</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {calls.slice(0, 5).map((call) => (
                <tr key={call.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 pl-2 font-bold text-slate-900">{call.contact_name}</td>
                  <td className="py-3.5 font-mono text-slate-500">{call.phone}</td>
                  <td className="py-3.5">
                    <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200/70 font-semibold text-[10px]">
                      {call.language}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono">{call.duration}s</td>
                  <td className="py-3.5">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]">
                      {call.outcome}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono font-bold text-slate-900">
                    ₹{call.cost.toFixed(2)}
                  </td>
                  <td className="py-3.5 text-right pr-2">
                    <button
                      onClick={() => onNavigateTab('intelligence')}
                      className="text-orange-600 hover:text-orange-700 font-semibold text-[11px] cursor-pointer"
                    >
                      Read Transcript →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
