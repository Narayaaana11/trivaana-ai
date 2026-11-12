import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, ShieldCheck, Scale } from 'lucide-react';

export type LegalDocType = 'terms' | 'privacy' | 'dnd-policy';

interface PublicLegalPageProps {
  docType: LegalDocType;
  onNavigateLegal: (doc: LegalDocType) => void;
  onBackHome: () => void;
  onNavigateContact: () => void;
}

interface LegalMeta {
  company_legal_name: string;
  entity_status: string;
  gstin: string | null;
  jurisdiction: string;
  grievance_officer_name: string;
  grievance_officer_email: string;
}

const DEFAULT_META: LegalMeta = {
  company_legal_name: 'Trivaana AI',
  entity_status: 'pre_incorporation_beta',
  gstin: null,
  jurisdiction: 'Hyderabad, Telangana, India',
  grievance_officer_name: 'Grievance Officer, Trivaana AI',
  grievance_officer_email: 'grievance@trivaana.ai',
};

export const PublicLegalPage: React.FC<PublicLegalPageProps> = ({
  docType,
  onNavigateLegal,
  onBackHome,
  onNavigateContact,
}) => {
  const [meta, setMeta] = useState<LegalMeta>(DEFAULT_META);

  useEffect(() => {
    fetch('/api/public/legal')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.company_legal_name) setMeta(data);
      })
      .catch(() => {});
  }, []);

  const tabs: { id: LegalDocType; label: string }[] = [
    { id: 'terms', label: 'Terms of Service' },
    { id: 'privacy', label: 'Privacy & DPDP Policy' },
    { id: 'dnd-policy', label: 'TRAI DND & DLT Policy' },
  ];

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onNavigateLegal(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                docType === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-amber-700" />
          Indian Entity &amp; Regulatory Notice
        </div>
        <p>
          Operated by <strong>{meta.company_legal_name}</strong> ({meta.entity_status === 'pre_incorporation_beta' ? 'Pre-Incorporation Beta Launch' : meta.entity_status})
          {' · '}Jurisdiction: <strong>{meta.jurisdiction}</strong>
          {' · '}GSTIN: <strong>{meta.gstin || 'Pending GST Registration (Pre-GST Beta)'}</strong>.
        </p>
      </div>

      {docType === 'terms' && (
        <article className="bg-white rounded-3xl p-8 border border-slate-200 space-y-5 text-sm text-slate-700 leading-relaxed">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-600">
            <FileText className="w-4 h-4" /> Terms of Service &amp; Acceptable Use (India)
          </div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">Terms of Service</h1>
          <p>
            By accessing or using {meta.company_legal_name}, you agree to be bound by these Terms under the Indian Contract Act, 1872 and the Information Technology Act, 2000.
          </p>
          <h2 className="font-bold text-slate-900 text-base">1. Lawful Calling &amp; Prohibited Conduct</h2>
          <p>
            Workspaces must only dial contacts with valid consent or legitimate transactional basis. Unsolicited robocalling, spoofing caller IDs, bypassing DND/NCPR suppression, impersonating government or financial authorities, or failing to disclose AI voice assistance where required is strictly prohibited and results in immediate account suspension.
          </p>
          <h2 className="font-bold text-slate-900 text-base">2. Telecom &amp; DLT Responsibility</h2>
          <p>
            Each business customer is responsible for maintaining valid TRAI DLT Principal Entity (PE), Telemarketer (TM), Header, and Template approvals for commercial outreach, and for verifying carrier KYC before live Indian PSTN dialing.
          </p>
          <h2 className="font-bold text-slate-900 text-base">3. Prepaid Credits, Billing &amp; Governing Law</h2>
          <p>
            Connected calls are metered in integer paise with 30-second rounding. Unconnected calls are not billed. Disputes are governed by the laws of India with exclusive jurisdiction in the courts of {meta.jurisdiction}.
          </p>
        </article>
      )}

      {docType === 'privacy' && (
        <article className="bg-white rounded-3xl p-8 border border-slate-200 space-y-5 text-sm text-slate-700 leading-relaxed">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <ShieldCheck className="w-4 h-4" /> Digital Personal Data Protection Act, 2023 (DPDP Act)
          </div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">Privacy &amp; DPDP Compliance Policy</h1>
          <p>
            {meta.company_legal_name} processes workspace account details and customer call logs/transcripts in accordance with the Digital Personal Data Protection Act, 2023 (India) and Information Technology (Reasonable Security Practices and Procedures) Rules.
          </p>
          <h2 className="font-bold text-slate-900 text-base">1. Purpose Limitation &amp; Call Recording Disclosure</h2>
          <p>
            Personal data (names, phone numbers, call transcripts, and consent records) is processed solely for delivering requested AI voice workflows, appointment scheduling, and compliance auditing. Workspaces can enable mandatory call-recording disclosure prompts.
          </p>
          <h2 className="font-bold text-slate-900 text-base">2. Data Principal Rights (Access, Correction &amp; Erasure)</h2>
          <p>
            Individuals may request access, correction, consent withdrawal (DNC opt-out), or erasure of caller memory and personal records at any time.
          </p>
          <h2 className="font-bold text-slate-900 text-base">3. Grievance Officer (IT Rules 2021 &amp; DPDP Act)</h2>
          <p>
            <strong>Officer:</strong> {meta.grievance_officer_name} · <strong>Email:</strong>{' '}
            <a href={`mailto:${meta.grievance_officer_email}`} className="text-orange-600 underline font-semibold">
              {meta.grievance_officer_email}
            </a>{' '}
            ·{' '}
            <button type="button" onClick={onNavigateContact} className="text-orange-600 underline font-semibold cursor-pointer">
              Contact Form
            </button>
          </p>
        </article>
      )}

      {docType === 'dnd-policy' && (
        <article className="bg-white rounded-3xl p-8 border border-slate-200 space-y-5 text-sm text-slate-700 leading-relaxed">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
            <ShieldCheck className="w-4 h-4" /> TRAI TCCCPR 2018 Compliance
          </div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">TRAI DND, NCPR &amp; DLT Policy</h1>
          <p>
            {meta.company_legal_name} enforces technical safeguards aligned with the Telecom Commercial Communications Customer Preference Regulations (TCCCPR), 2018:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Calling Window Guard:</strong> Automated outbound dialing is restricted to 10:00 AM – 6:00 PM IST by default.</li>
            <li><strong>DNC &amp; NCPR Scrubbing:</strong> Every outbound attempt checks workspace DNC suppression, lead opt-out flags, consent revocation logs, and NCPR scrubbing jobs.</li>
            <li><strong>Numbering Series &amp; DLT Registry:</strong> Promotional (140-series) and Service/Transactional (160/DID) categories are separated, with PE/TM/Header/Template review queues.</li>
            <li><strong>Immediate Opt-Out:</strong> Any opt-out request adds the number to the workspace DNC list and halts further automated calls.</li>
          </ul>
        </article>
      )}
    </section>
  );
};

