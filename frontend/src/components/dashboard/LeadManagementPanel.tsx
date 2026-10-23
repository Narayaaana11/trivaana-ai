import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Lead } from '@/types/trivaana';
import {
  Users,
  Compass,
  Upload,
  Search,
  Filter,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Building2,
  Stethoscope,
  GraduationCap,
  Car,
  Landmark,
  Sparkles,
  RefreshCw,
  Plus,
} from 'lucide-react';

interface LeadManagementPanelProps {
  onLeadCallTriggered?: () => void;
}

export const LeadManagementPanel: React.FC<LeadManagementPanelProps> = ({
  onLeadCallTriggered,
}) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // OSM Scout Controls
  const [scoutCity, setScoutCity] = useState('Visakhapatnam');
  const [scoutVertical, setScoutVertical] = useState('Real Estate');
  const [isScouting, setIsScouting] = useState(false);
  const [scoutResultMsg, setScoutResultMsg] = useState<string | null>(null);

  // Manual Add Modal / State
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await trivaanaApi.getLeads(search, statusFilter);
      setLeads(res.leads);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [search, statusFilter]);

  const handleRunOsmScout = async () => {
    setIsScouting(true);
    setScoutResultMsg(null);
    try {
      const res = await trivaanaApi.discoverLeads(scoutCity, scoutVertical, 12);
      setScoutResultMsg(`Discovered & enrolled ${res.leads_added} verified ${scoutVertical} prospects in ${scoutCity}!`);
      await fetchLeads();
    } catch (err: any) {
      alert(`Scout failed: ${err.message}`);
    } finally {
      setIsScouting(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCsv(true);
    try {
      const res = await trivaanaApi.uploadLeadsCsv(file);
      alert(`Successfully imported ${res.leads_imported} leads from CSV.`);
      await fetchLeads();
    } catch (err: any) {
      alert(`CSV Upload failed: ${err.message}`);
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleQuickCall = async (lead: Lead) => {
    try {
      await trivaanaApi.triggerInstantCall(lead.name, lead.phone, lead.vertical, 'te-IN');
      alert(`Instant AI Call dispatched to ${lead.name} (${lead.phone})!`);
      await fetchLeads();
      if (onLeadCallTriggered) onLeadCallTriggered();
    } catch (err: any) {
      alert(`Call failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
            <Compass className="w-3.5 h-3.5 text-orange-600" />
            <span>Autonomous OpenStreetMap Geo-Scouting</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Lead Management & OSM Scout
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Discover real local business prospects across Andhra Pradesh, Telangana, Karnataka, and Maharashtra, or import your existing CSV lists.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploadingCsv ? 'Uploading...' : 'Import CSV'}</span>
            <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Autonomous OSM Scout Interactive Bar */}
      <div className="p-6 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Autonomous OSM Lead Scout</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-950 text-orange-400 border border-orange-800">
                  Geo-Verified
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pulls authentic commercial listings directly from OpenStreetMap geospatial databases.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={scoutCity}
              onChange={(e) => setScoutCity(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
            >
              <option value="Visakhapatnam">Visakhapatnam (AP)</option>
              <option value="Hyderabad">Hyderabad (TS)</option>
              <option value="Bengaluru">Bengaluru (KA)</option>
              <option value="Mumbai">Mumbai (MH)</option>
              <option value="Pune">Pune (MH)</option>
              <option value="Chennai">Chennai (TN)</option>
            </select>

            <select
              value={scoutVertical}
              onChange={(e) => setScoutVertical(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
            >
              <option value="Real Estate">Real Estate Developers</option>
              <option value="Healthcare">Hospitals & Clinics</option>
              <option value="EdTech">Schools & Colleges</option>
              <option value="Automotive">Car Showrooms</option>
              <option value="Finance">Banks & Financial Hubs</option>
            </select>

            <button
              onClick={handleRunOsmScout}
              disabled={isScouting}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              {isScouting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scouting OSM Nodes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run Autonomous Scout</span>
                </>
              )}
            </button>
          </div>
        </div>

        {scoutResultMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{scoutResultMsg}</span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by prospect name, city, or phone..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:border-orange-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
            </select>
          </div>
        </div>

        {/* Leads Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                <th className="pb-3 pl-2">Prospect</th>
                <th className="pb-3">Phone</th>
                <th className="pb-3">Location</th>
                <th className="pb-3">Vertical</th>
                <th className="pb-3">Source</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading CRM leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No leads found matching your search. Run the OSM Scout above to discover new leads!
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 pl-2 font-bold text-slate-900">
                      <div>{lead.name}</div>
                      {lead.notes && (
                        <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">
                          {lead.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 font-mono text-slate-600">{lead.phone}</td>
                    <td className="py-3.5 text-slate-600">{lead.city}</td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[10px]">
                        {lead.vertical}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 font-medium text-[10px]">
                        {lead.source}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                        lead.status === 'qualified'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : lead.status === 'contacted'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right pr-2">
                      <button
                        onClick={() => handleQuickCall(lead)}
                        className="py-1 px-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>Call</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
