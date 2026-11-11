import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Send } from 'lucide-react';
import { platformService } from '@/services/platformService';

export const SupportTicketsPanel: React.FC = () => {
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('technical');
  const [priority, setPriority] = useState('medium');

  const { data, isLoading } = useQuery({
    queryKey: ['my-support-tickets'],
    queryFn: () => platformService.listMyTickets(),
  });

  const createMut = useMutation({
    mutationFn: platformService.createSupportTicket,
    onSuccess: () => {
      setSubject('');
      setDescription('');
      qc.invalidateQueries({ queryKey: ['my-support-tickets'] });
    },
  });

  const tickets = data?.tickets || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90">
        <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 mb-1">
          <LifeBuoy className="w-4 h-4" />
          <span>Customer Support &amp; Operations Helpdesk</span>
        </div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Support Tickets</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!subject.trim() || !description.trim()) return;
            createMut.mutate({ subject, description, category, priority });
          }}
          className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs"
        >
          <h2 className="text-sm font-bold text-slate-900">Open Support Ticket</h2>
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (e.g., Exotel SIP Trunk Verification)"
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white">
              <option value="technical">Technical</option>
              <option value="telephony">Telephony / SIP</option>
              <option value="billing">Billing &amp; GST</option>
              <option value="compliance">TRAI / DLT</option>
              <option value="onboarding">Onboarding</option>
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue or request..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
          <button
            type="submit"
            disabled={createMut.isPending}
            className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> {createMut.isPending ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>

        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-2 text-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Your Tickets</h2>
          {isLoading ? (
            <div className="py-10 text-center text-slate-400">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="py-10 text-center text-slate-400">No support tickets opened yet.</div>
          ) : (
            tickets.map((t: any) => (
              <div key={t.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{t.subject}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-semibold uppercase text-[10px]">
                    {t.status}
                  </span>
                </div>
                <p className="text-slate-600">{t.description}</p>
                {t.resolution_notes && (
                  <p className="text-emerald-700 font-medium">Staff note: {t.resolution_notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

