import React, { useState, useEffect, useCallback } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Lead } from '@/types/trivaana';
import { RubberSegment, SwipeToast } from '@/components/reactbits';
import {
  Users,
  Upload,
  Search,
  PhoneCall,
  Plus,
  RefreshCw,
  Ban,
  ClipboardPaste,
  LayoutGrid,
  List as ListIcon,
  Columns3,
  Flame,
  SlidersHorizontal,
  X,
  Calendar,
} from 'lucide-react';

interface LeadManagementPanelProps {
  onLeadCallTriggered?: () => void;
}

const LEAD_VIEWS = [
  { id: 'all', label: 'All Leads' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'interested', label: 'Interested' },
  { id: 'not_interested', label: 'Not Interested' },
  { id: 'callback_required', label: 'Callback Required' },
  { id: 'converted', label: 'Converted' },
  { id: 'do_not_call', label: 'Do Not Call' },
];

export const LeadManagementPanel: React.FC<LeadManagementPanelProps> = ({
  onLeadCallTriggered,
}) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [leadView, setLeadView] = useState('all');
  const [displayMode, setDisplayMode] = useState<'list' | 'pipeline' | 'cards' | 'priority'>('list');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [filterCity, setFilterCity] = useState('');
  const [filterVertical, setFilterVertical] = useState('');
  const [filterConsent, setFilterConsent] = useState<'all' | 'opted_in' | 'dnc'>('all');
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add lead modal & paste modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', email: '', city: 'Hyderabad', vertical: 'Real Estate', notes: '' });
  const [pasteText, setPasteText] = useState('');
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvPendingFile, setCsvPendingFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({
    name: '',
    phone: '',
    email: '',
    city: '',
    vertical: '',
    notes: '',
  });

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await trivaanaApi.getLeads(search, leadView);
      setLeads(res.leads || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [search, leadView]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchLeads();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchLeads]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await trivaanaApi.createLead(newLead);
      setShowAddModal(false);
      setNewLead({ name: '', phone: '', email: '', city: 'Hyderabad', vertical: 'Real Estate', notes: '' });
      setFeedback({ type: 'success', message: 'Contact created and verified.' });
      fetchLeads();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handlePasteImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const consentConfirmed = Boolean(
      (e.currentTarget.elements.namedItem('consent_confirmed') as HTMLInputElement | null)?.checked
    );
    const lines = pasteText.split('\n').map((l) => l.trim()).filter(Boolean);
    const contacts = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return parts.length >= 2 ? { name: parts[0], phone: parts[1], city: parts[2] || 'Hyderabad' } : { name: 'Contact', phone: parts[0] };
    });
    try {
      const res = await trivaanaApi.bulkPasteLeads(contacts, undefined, consentConfirmed);
      setShowPasteModal(false);
      setPasteText('');
      setFeedback({ type: 'success', message: `Imported ${res.imported_count} contacts (${res.rejected_count} rejected/duplicates).` });
      fetchLeads();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const sample = await file.slice(0, 8192).text();
      const lines = sample.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const splitLine = (line: string) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const headers = lines[0] ? splitLine(lines[0]) : [];
      const preview = lines.slice(1, 4).map(splitLine);
      const findMatch = (candidates: string[]) =>
        headers.find((h) => candidates.includes(h.toLowerCase())) || '';
      setCsvHeaders(headers);
      setCsvPreviewRows(preview);
      setCsvMapping({
        name: findMatch(['name', 'full_name', 'fullname', 'contact_name', 'lead_name']),
        phone: findMatch(['phone', 'mobile', 'phone_number', 'contact', 'tel', 'number']),
        email: findMatch(['email', 'e-mail', 'mail']),
        city: findMatch(['city', 'location', 'region']),
        vertical: findMatch(['vertical', 'industry', 'category']),
        notes: findMatch(['notes', 'comment', 'remarks']),
      });
      setCsvPendingFile(file);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const confirmCsvUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!csvPendingFile) return;
    const consentConfirmed = Boolean(
      (e.currentTarget.elements.namedItem('consent_confirmed') as HTMLInputElement | null)?.checked
    );
    setIsUploadingCsv(true);
    setFeedback(null);
    try {
      const cleanMap: Record<string, string> = {};
      Object.entries(csvMapping).forEach(([target, source]) => {
        if (source) cleanMap[target] = source;
      });
      const res = await trivaanaApi.uploadLeadsCsv(csvPendingFile, cleanMap, consentConfirmed);
      const imported = res.imported_count ?? 0;
      const rejected = res.rejected_count ?? 0;
      setFeedback({
        type: imported > 0 ? 'success' : 'error',
        message: `Imported ${imported} lead(s) from CSV. ${rejected} invalid or duplicate row(s) rejected.`,
      });
      setCsvPendingFile(null);
      fetchLeads();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const openLeadDrawer = async (leadId: string) => {
    setDetailLoading(true);
    try {
      const [det, tl] = await Promise.all([
        trivaanaApi.getLeadDetail(leadId),
        trivaanaApi.getLeadTimeline(leadId).catch(() => null),
      ]);
      setSelectedLeadDetail({
        ...det,
        timeline: tl?.timeline || det?.timeline || [],
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (filterCity && !(lead.city || '').toLowerCase().includes(filterCity.toLowerCase())) return false;
    if (filterVertical && !(lead.vertical || '').toLowerCase().includes(filterVertical.toLowerCase())) return false;
    if (filterConsent === 'opted_in' && lead.opt_out) return false;
    if (filterConsent === 'dnc' && !lead.opt_out) return false;
    return true;
  });

  const handleQuickCall = async (lead: Lead) => {
    setFeedback(null);
    try {
      const res = await trivaanaApi.triggerInstantCall({
        name: lead.name,
        phone: lead.phone,
        vertical: lead.vertical,
        language: 'te-IN',
        is_sandbox: true,
      });
      setFeedback({ type: 'success', message: `Sandbox call ${res.call_id} initiated for ${lead.name}.` });
      if (onLeadCallTriggered) onLeadCallTriggered();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
            <Users className="w-3.5 h-3.5 text-orange-600" />
            <span>CRM Lead & Contact Management</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Leads, Lists & Consent Status
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Import CSVs, paste contact lists, segment by qualification stage, and enforce Do-Not-Call opt-outs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={() => setShowAddModal(true)} className="px-3.5 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Contact
          </button>
          <button onClick={() => setShowPasteModal(true)} className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <ClipboardPaste className="w-3.5 h-3.5" /> Paste Contacts
          </button>
          <label className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploadingCsv ? 'Uploading...' : 'Import CSV'}</span>
            <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
          </label>
        </div>
      </div>

      {feedback && (
        <SwipeToast type={feedback.type} message={feedback.message} />
      )}

      {/* Lead Views Filter Tabs + Search */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-4">
        <RubberSegment
          layoutId="leadStageFilter"
          items={LEAD_VIEWS}
          activeId={leadView}
          onChange={setLeadView}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, or city..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: 'list', label: 'List', icon: ListIcon },
                { id: 'pipeline', label: 'Pipeline', icon: Columns3 },
                { id: 'cards', label: 'Cards', icon: LayoutGrid },
                { id: 'priority', label: 'Priority', icon: Flame },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDisplayMode(id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                  displayMode === id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              showMoreFilters ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>More filters</span>
          </button>
          <button onClick={fetchLeads} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer">
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {showMoreFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <input
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              placeholder="Filter by city (e.g. Hyderabad)"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
            />
            <input
              value={filterVertical}
              onChange={(e) => setFilterVertical(e.target.value)}
              placeholder="Filter by vertical (e.g. BFSI)"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
            />
            <select
              value={filterConsent}
              onChange={(e) => setFilterConsent(e.target.value as 'all' | 'opted_in' | 'dnc')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
            >
              <option value="all">All Consent Statuses</option>
              <option value="opted_in">Opted In Only</option>
              <option value="dnc">DNC / Opted Out Only</option>
            </select>
          </div>
        )}

        {displayMode === 'pipeline' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {(['new', 'contacted', 'interested', 'converted'] as const).map((stage) => {
              const items = filteredLeads.filter((l) => (l.lead_status || 'new') === stage);
              return (
                <div key={stage} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between font-bold uppercase text-[11px] text-slate-600">
                    <span>{stage.replace('_', ' ')}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200">{items.length}</span>
                  </div>
                  {items.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => openLeadDrawer(lead.id)}
                      className="p-3 rounded-xl bg-white border border-slate-200 hover:border-orange-300 cursor-pointer space-y-1"
                    >
                      <div className="font-bold text-slate-900">{lead.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{lead.phone}</div>
                      <div className="text-[10px] text-slate-400">{lead.city} • {lead.vertical}</div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="text-[11px] text-slate-400 py-4 text-center">No contacts</div>}
                </div>
              );
            })}
          </div>
        ) : displayMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => openLeadDrawer(lead.id)}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-orange-300 cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{lead.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${lead.opt_out ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {lead.opt_out ? 'DNC' : 'Opted In'}
                  </span>
                </div>
                <div className="font-mono text-slate-700">{lead.phone}</div>
                <div className="text-[11px] text-slate-500">{lead.city} • {lead.vertical} • Stage: {lead.lead_status || 'new'}</div>
              </div>
            ))}
          </div>
        ) : displayMode === 'priority' ? (
          <div className="space-y-2 text-xs">
            {[...filteredLeads]
              .sort((a, b) => {
                const rank = (s?: string) => (s === 'interested' ? 0 : s === 'callback_required' ? 1 : s === 'new' ? 2 : 3);
                return rank(a.lead_status) - rank(b.lead_status);
              })
              .map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => openLeadDrawer(lead.id)}
                  className="p-3.5 rounded-2xl border border-slate-200 hover:border-orange-300 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{lead.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 uppercase font-bold">
                        {lead.lead_status || 'new'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">{lead.phone} • {lead.city}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickCall(lead);
                    }}
                    disabled={Boolean(lead.opt_out)}
                    className="px-3 py-1.5 rounded-xl bg-orange-600 text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Call Now
                  </button>
                </div>
              ))}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                <th className="py-3 px-2">Contact</th>
                <th className="py-3 px-2">Phone</th>
                <th className="py-3 px-2">City / Vertical</th>
                <th className="py-3 px-2">Stage</th>
                <th className="py-3 px-2">Consent</th>
                <th className="py-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading contacts...</td></tr>
              ) : filteredLeads.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">No contacts match this view.</td></tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} onClick={() => openLeadDrawer(lead.id)} className="hover:bg-slate-50/70 cursor-pointer">
                    <td className="py-3 px-2">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{lead.name}</span>
                        {typeof lead.lead_score === 'number' && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                              lead.qualification_tier === 'hot'
                                ? 'bg-orange-100 text-orange-800'
                                : lead.qualification_tier === 'warm'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {lead.lead_score}/100
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{lead.source}</div>
                    </td>
                    <td className="py-3 px-2 font-mono text-slate-800">{lead.phone}</td>
                    <td className="py-3 px-2 text-slate-600">{lead.city} • {lead.vertical}</td>
                    <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.lead_status || 'new'}
                        onChange={async (e) => {
                          await trivaanaApi.updateLead(lead.id, { lead_status: e.target.value as any });
                          fetchLeads();
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="interested">Interested</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="callback_required">Callback Required</option>
                        <option value="converted">Converted</option>
                        <option value="do_not_call">Do Not Call</option>
                      </select>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        lead.opt_out ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {lead.opt_out ? 'DNC / Opted Out' : 'Opted In'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleQuickCall(lead)}
                        disabled={Boolean(lead.opt_out)}
                        className="px-2.5 py-1 rounded-lg bg-orange-600 text-white text-[11px] font-bold disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <PhoneCall className="w-3 h-3" /> Call
                      </button>
                      <button
                        onClick={async () => {
                          await trivaanaApi.toggleLeadOptOut(lead.id, !lead.opt_out);
                          fetchLeads();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Ban className="w-3 h-3" /> {lead.opt_out ? 'Re-enable' : 'DNC'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateLead} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-3 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Add Contact</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-500 cursor-pointer">Close</button>
            </div>
            <input required placeholder="Full Name" value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            <input required placeholder="Phone (+919848012345)" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            <input placeholder="Email (optional)" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="City" value={newLead.city} onChange={(e) => setNewLead({ ...newLead, city: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200" />
              <input placeholder="Vertical" value={newLead.vertical} onChange={(e) => setNewLead({ ...newLead, vertical: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200" />
            </div>
            <textarea rows={2} placeholder="Notes" value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">Save Contact</button>
          </form>
        </div>
      )}

      {/* Paste Contacts Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handlePasteImport} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-3 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Paste Contacts (Name, Phone, City)</h3>
              <button type="button" onClick={() => setShowPasteModal(false)} className="text-slate-500 cursor-pointer">Close</button>
            </div>
            <textarea
              required
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Rahul,+919848011111,Hyderabad\nPriya,+919848022222,Bengaluru"}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
            />
            <label className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 cursor-pointer">
              <input type="checkbox" name="consent_confirmed" className="mt-0.5" />
              <span>I confirm these contacts gave prior opt-in consent for automated outreach (TRAI compliance).</span>
            </label>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold cursor-pointer">Import Pasted Contacts</button>
          </form>
        </div>
      )}

      {/* CSV Column Mapper Modal */}
      {csvPendingFile && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={confirmCsvUpload} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Map CSV Columns</h3>
                <p className="text-[11px] text-slate-500">{csvPendingFile.name} • {csvHeaders.length} column(s) detected</p>
              </div>
              <button type="button" onClick={() => setCsvPendingFile(null)} className="text-slate-500 cursor-pointer">Close</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['phone', 'name', 'email', 'city', 'vertical', 'notes'] as const).map((field) => (
                <label key={field} className="space-y-1">
                  <span className="font-bold text-slate-700 capitalize">{field} {field === 'phone' ? '*' : ''}</span>
                  <select
                    required={field === 'phone'}
                    value={csvMapping[field] || ''}
                    onChange={(e) => setCsvMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">-- Skip / Auto --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {csvPreviewRows.length > 0 && (
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 overflow-x-auto">
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Sample Preview</div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-slate-500">
                      {csvHeaders.slice(0, 5).map((h) => <th key={h} className="pr-3 pb-1">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreviewRows.map((row, idx) => (
                      <tr key={idx} className="border-t border-slate-200/70">
                        {row.slice(0, 5).map((cell, cidx) => <td key={cidx} className="pr-3 py-1 text-slate-700">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <label className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 cursor-pointer">
              <input type="checkbox" name="consent_confirmed" className="mt-0.5" />
              <span>I confirm these CSV contacts gave prior opt-in consent for outreach; unchecked rows remain pending consent verification.</span>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCsvPendingFile(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={isUploadingCsv} className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">
                {isUploadingCsv ? 'Importing...' : 'Import Mapped CSV'}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Contact Detail Drawer */}
      {(selectedLeadDetail || detailLoading) && (() => {
        const detailLead = selectedLeadDetail?.lead || selectedLeadDetail;
        const callHistory = selectedLeadDetail?.call_history || selectedLeadDetail?.calls || [];
        const consentHistory = selectedLeadDetail?.consent_history || selectedLeadDetail?.consents || [];
        return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end">
          <div className="w-full max-w-md bg-white h-full overflow-y-auto p-6 shadow-2xl space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">{detailLead?.name || 'Contact Details'}</h3>
                <p className="font-mono text-slate-500">{detailLead?.phone}</p>
              </div>
              <button onClick={() => setSelectedLeadDetail(null)} className="p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center text-slate-400">Loading contact history...</div>
            ) : detailLead?.id && (
              <>
                <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div><span className="text-slate-400 block">City</span><strong>{detailLead.city || '—'}</strong></div>
                  <div><span className="text-slate-400 block">Vertical</span><strong>{detailLead.vertical || '—'}</strong></div>
                  <div><span className="text-slate-400 block">Status</span><strong className="uppercase">{detailLead.lead_status}</strong></div>
                  <div><span className="text-slate-400 block">Consent</span><strong>{detailLead.opt_out ? 'DNC' : 'Opted In'}</strong></div>
                </div>

                {detailLead.tags && detailLead.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {detailLead.tags.map((tg: string) => (
                      <span key={tg} className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">{tg}</span>
                    ))}
                  </div>
                )}

                {detailLead.follow_up_at && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-900">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>Follow-up scheduled: {detailLead.follow_up_at}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="font-bold text-slate-700 uppercase text-[11px]">Call History ({callHistory.length})</div>
                  {callHistory.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 text-slate-400 text-center">No calls recorded yet.</div>
                  ) : (
                    callHistory.map((c: any) => (
                      <div key={c.id} className="p-3 rounded-xl border border-slate-200 space-y-1">
                        <div className="flex justify-between font-bold">
                          <span>{c.outcome || c.status}</span>
                          <span className="text-slate-500">{c.duration_seconds ?? c.duration_sec ?? 0}s</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{c.summary || 'No summary'}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-700 uppercase text-[11px]">
                    Unified Activity Timeline ({(selectedLeadDetail?.timeline || []).length})
                  </div>
                  {(selectedLeadDetail?.timeline || []).length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 text-slate-400 text-center">No timeline events recorded yet.</div>
                  ) : (
                    (selectedLeadDetail?.timeline || []).map((ev: any) => (
                      <div key={ev.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{ev.title}</span>
                          <span className="text-[10px] uppercase text-orange-700">{ev.status}</span>
                        </div>
                        {ev.detail && <div className="text-[11px] text-slate-600">{ev.detail}</div>}
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-700 uppercase text-[11px]">Consent Ledger ({consentHistory.length})</div>
                  {consentHistory.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 text-slate-400 text-center">No explicit consent logs.</div>
                  ) : (
                    consentHistory.map((cn: any) => (
                      <div key={cn.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                        <span className="font-semibold">{cn.consent_purpose || cn.consent_type}</span>
                        <span className="uppercase font-bold text-emerald-700">{cn.consent_status || cn.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
};
