import React, { useState, useEffect, useCallback } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Agent, AnalyticsStats } from '@/types/trivaana';
import { padDailySeries } from '@/lib/charts';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarChart3, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

export const AnalyticsPanel: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [days, setDays] = useState(30);
  const [agentId, setAgentId] = useState('');
  const [direction, setDirection] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const [sRes, aRes] = await Promise.all([
        trivaanaApi.getAnalytics({
          days,
          agent_id: agentId || undefined,
          direction: direction || undefined,
        }),
        trivaanaApi.getAgents(),
      ]);
      setStats(sRes);
      setAgents(aRes.agents || []);
    } finally {
      setLoading(false);
    }
  }, [days, agentId, direction]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadAnalytics();
    }, 0);
    return () => clearTimeout(id);
  }, [loadAnalytics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
            <BarChart3 className="w-3.5 h-3.5 text-orange-600" />
            <span>Database-Driven Analytics & Reporting</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Calling Performance & Spend</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <option value="">All AI Employees</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={direction} onChange={(e) => setDirection(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <option value="">All Directions</option>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
          <button onClick={loadAnalytics} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overview KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9]"><div className="text-[#6e6e7e]">Total Calls</div><div className="font-display text-2xl font-extrabold tabular-nums mt-1 text-[#0f0f14]">{stats?.total_calls_placed ?? 0}</div></div>
        <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9]"><div className="text-[#6e6e7e]">Connection Rate</div><div className="font-display text-2xl font-extrabold text-emerald-600 tabular-nums mt-1">{stats?.connection_rate_pct ?? 0}%</div></div>
        <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9]"><div className="text-[#6e6e7e]">Interested Leads</div><div className="font-display text-2xl font-extrabold text-[#ff5500] tabular-nums mt-1">{stats?.interested_leads ?? 0}</div></div>
        <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9]"><div className="text-[#6e6e7e]">Total Usage Spend</div><div className="font-display text-2xl font-extrabold tabular-nums mt-1 text-[#0f0f14]">₹{(stats?.total_usage_inr ?? 0).toFixed(2)}</div></div>
      </div>

      {/* Connected vs Unanswered Chart */}
      <div className="bg-white rounded-2xl p-6 border border-[#e4e4e9]">
        <h2 className="font-display text-base font-bold text-[#0f0f14] mb-4">Connected vs Unanswered Calls (Daily)</h2>
        {!stats?.daily_series || stats.daily_series.length === 0 ? (
          <EmptyState
            compact
            icon={BarChart3}
            title="No Call Records Match These Filters"
            description="Adjust the date window, AI Employee, or call direction filter to inspect daily connect telemetry."
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={padDailySeries(stats.daily_series)} maxBarSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f5" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a8a98' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8a8a98' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="connected" name="Connected" fill="#16a34a" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="unanswered" name="Unanswered" fill="#94a3b8" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* AI Employee & Language Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">AI Employee Performance</h3>
          {(stats?.agent_performance || []).map((ap) => (
            <div key={ap.agent_id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
              <div>
                <div className="font-bold text-slate-900">{ap.agent_name}</div>
                <div className="text-[11px] text-slate-500">{ap.language} • {ap.status}</div>
              </div>
              <div className="text-right font-mono">
                <div className="font-bold">{ap.total_calls} calls</div>
                <div className="text-[11px] text-emerald-700">{ap.connected_calls} connected</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Outcome & Language Breakdown</h3>
          <div className="space-y-2">
            {(stats?.outcome_distribution || []).map((o) => (
              <div key={o.outcome} className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="font-semibold text-slate-800">{o.outcome}</span>
                <span className="font-mono font-bold">{o.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

