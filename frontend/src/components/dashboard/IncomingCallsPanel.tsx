import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Agent, CallLog } from '@/types/trivaana';
import { RipplesBackground, PillNav } from '@/components/reactbits';
import { PhoneIncoming, PhoneCall, PhoneMissed, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';

interface IncomingCallsPanelProps {
  onNavigateNumbers?: () => void;
  initialSubTab?: 'overview' | 'calls' | 'messages' | 'missed';
}

export const IncomingCallsPanel: React.FC<IncomingCallsPanelProps> = ({
  onNavigateNumbers,
  initialSubTab = 'overview',
}) => {
  const [subTab, setSubTab] = useState<'overview' | 'calls' | 'messages' | 'missed'>(initialSubTab);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [inboundCalls, setInboundCalls] = useState<CallLog[]>([]);
  const [testFrom, setTestFrom] = useState('+919848012345');
  const [testQuery, setTestQuery] = useState('What are the 3BHK villa prices?');
  const [simResult, setSimResult] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAll = async () => {
    try {
      const [nRes, aRes, cRes] = await Promise.all([
        trivaanaApi.getPhoneNumbers(),
        trivaanaApi.getAgents(),
        trivaanaApi.getCalls({ direction: 'inbound' }),
      ]);
      setNumbers(nRes.phone_numbers || []);
      setAgents(aRes.agents || []);
      setInboundCalls(cRes.calls || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const liveMapped = numbers.filter((n) => n.inbound_agent_id).length;

  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const targetNum = numbers[0]?.phone_number;
    if (!targetNum) {
      setFeedback({ type: 'error', message: 'Register a phone number first in Numbers & Channels.' });
      return;
    }
    try {
      const res = await trivaanaApi.simulateInboundCall({
        to_number: targetNum,
        from_number: testFrom,
        initial_query: testQuery,
      });
      setSimResult(res);
      setFeedback({ type: 'success', message: `Inbound call answered by ${res.agent_name} (Call ID: ${res.call_id}).` });
      loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const missedCalls = inboundCalls.filter((c) => ['no-answer', 'missed', 'failed'].includes(c.status) || (c.outcome || '').toLowerCase().includes('callback'));

  return (
    <div className="space-y-6">
      <RipplesBackground className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
              <PhoneIncoming className="w-3.5 h-3.5 text-orange-600" />
              <span>24×7 AI Reception & Inbound Routing</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Incoming Calls</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Assign AI Employees to business numbers, configure after-hours callbacks, recognize returning callers, and test inbound routing.
            </p>
          </div>
          {onNavigateNumbers && (
            <button onClick={onNavigateNumbers} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer shrink-0">
              Manage Numbers ({liveMapped}/{numbers.length} routed)
            </button>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4 overflow-x-auto">
          <PillNav
            layoutGroupId="incomingCallsSubTab"
            activeId={subTab}
            onChange={(id) => setSubTab(id as any)}
            items={[
              { id: 'overview', label: 'Overview', icon: PhoneIncoming },
              { id: 'calls', label: `Calls (${inboundCalls.length})`, icon: PhoneCall },
              { id: 'messages', label: 'Messages', icon: MessageSquare },
              { id: 'missed', label: `Missed callers (${missedCalls.length})`, icon: PhoneMissed },
            ]}
          />
        </div>
      </RipplesBackground>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {subTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Which number rings whom ({liveMapped}/{numbers.length} live)</h2>
            {numbers.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-2xl text-slate-500">No phone numbers configured yet.</div>
            ) : (
              numbers.map((n) => (
                <div key={n.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono font-black text-slate-900">{n.phone_number}</div>
                    <div className="text-[11px] text-slate-500">After-hours: {n.after_hours_mode || 'voicemail_callback'}</div>
                  </div>
                  <select
                    value={n.inbound_agent_id || ''}
                    onChange={async (e) => {
                      await trivaanaApi.updatePhoneNumber(n.id, { inbound_agent_id: e.target.value });
                      loadAll();
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSimulateInbound} className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Hear It Yourself (Browser Inbound Test)</h2>
            <input required placeholder="Caller Phone" value={testFrom} onChange={(e) => setTestFrom(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            <input placeholder="Caller initial question" value={testQuery} onChange={(e) => setTestQuery(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">
              Simulate Incoming Call
            </button>
            {simResult && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-emerald-700">Answered by {simResult.agent_name}</div>
                <div className="text-slate-700">Greeting: {simResult.greeting}</div>
                <div className="text-[11px] text-slate-500">KB hits: {simResult.kb_hits?.length || 0} • Returning caller: {simResult.returning_caller ? 'Yes' : 'No'}</div>
              </div>
            )}
          </form>
        </div>
      )}

      {(subTab === 'calls' || subTab === 'messages' || subTab === 'missed') && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-2 text-xs">
          {(() => {
            const list =
              subTab === 'missed'
                ? missedCalls
                : subTab === 'messages'
                ? inboundCalls.filter((c) => Boolean(c.summary || c.transcript))
                : inboundCalls;
            return list.length === 0 ? (
              <div className="py-10 text-center text-slate-400">No records in this view yet.</div>
            ) : (
              list.map((c) => (
                <div key={c.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{c.contact_name} ({c.phone})</div>
                    <div className="text-[11px] text-slate-500">
                      {subTab === 'messages' ? (c.summary || c.transcript || c.outcome) : `${c.outcome} • ${c.duration}s`}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-600">{c.status}</span>
                </div>
              ))
            );
          })()}
        </div>
      )}
    </div>
  );
};

