import React, { useState } from 'react';
import { TrivaanaLogo } from '@/components/brand/TrivaanaLogo';
import { AuroraBackground, DecryptedText } from '@/components/reactbits';
import {
  Search,
  ArrowLeft,
  BookOpen,
  Code2,
  Bot,
  PhoneForwarded,
  CreditCard,
  ShieldCheck,
  MessageCircle,
  Copy,
  Check,
} from 'lucide-react';

interface DocsPortalPageProps {
  initialSection?: string;
  onBackToSite: () => void;
  onEnterDashboard: () => void;
  onNavigateContact: () => void;
}

interface DocArticle {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  anchors: string[];
  body: string[];
  codeSnippet?: string;
}

const DOC_ARTICLES: DocArticle[] = [
  {
    id: 'what-trivaana-does',
    group: 'START HERE',
    title: 'Your AI phone employee, explained end to end.',
    subtitle: 'Everything a business owner needs to build, train, and run one — real numbers, worked examples.',
    anchors: ['The three channels', 'How it actually works', 'Language & DND support'],
    body: [
      'Think of a Trivaana AI employee the same way you think of hiring a real phone rep — except it never misses a follow-up, dials in under 30 seconds, and speaks natural Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, and Indian English.',
      'You describe the objective in plain language or start from one of 140+ industry templates. Trivaana compiles your goal into structured greeting rules, qualification steps, JSON extraction fields, Knowledge Base RAG retrieval, and mid-call actions.',
      'Billing is purely pay-for-talk-time in whole integer paise. Unanswered calls cost ₹0, and workspace seats are unlimited.',
    ],
  },
  {
    id: 'creating-first-employee',
    group: 'START HERE',
    title: 'Creating your first AI employee in 3 minutes.',
    subtitle: 'From prompt architect to published production caller with sandbox verification.',
    anchors: ['1. Prompt Architect', '2. Ground with Knowledge Base', '3. Sandbox Test & Publish'],
    body: [
      'Open Home or Your Team and describe the call flow in plain sentences. Include your preferred Indian language and mode (Instant, Bulk, or Inbound).',
      'Attach FAQs, PDF price sheets, or website URLs in Knowledge Base so the employee cites verified inventory and never hallucinates figures.',
      'Test live conversations inside Pre-Publish Agent Sandbox before toggling lifecycle status from draft to published or active.',
    ],
  },
  {
    id: 'going-live-costs',
    group: 'START HERE',
    title: 'Going live: transparent talk-time & number pricing.',
    subtitle: 'Prepaid wallet in INR with automated 18% GST tax invoices (SAC 998313).',
    anchors: ['Standard vs Premium voices', 'Numbers & Concurrent channels', 'GST Invoicing'],
    body: [
      'Standard Indian neural voices (Sarvam & native dialects) are billed at ₹5.00/min connected talk time. Premium voices (ElevenLabs Studio / custom clones) are billed at ₹6.80/min.',
      'Dedicated business phone numbers are ₹649–₹1,499/month depending on virtual mobile vs regional 044/080/040 landline DID, and each concurrent calling channel is ₹649/month.',
      'Every top-up automatically issues a compliant 18% GST SAC 998313 invoice with ITC eligibility.',
    ],
  },
  {
    id: 'api-overview',
    group: 'API DOCUMENTATION',
    title: 'Trivaana REST API & Webhooks Quickstart',
    subtitle: 'Trigger sub-30s AI outbound calls from any CRM, Webflow, Meta Lead Ad, or custom backend.',
    anchors: ['Authentication', 'Instant Lead Intake Endpoint', 'HMAC-SHA256 Webhooks'],
    body: [
      'Authenticate private workspace API calls using a scoped X-API-Key header generated under Developers → API Keys, or post directly to an agent’s Instant Lead Intake URL with X-Intake-Secret.',
      'All call completion events (call.completed, call.not_connected, lead.qualified) are delivered to your HTTPS webhook endpoints signed with HMAC-SHA256 in X-Trivaana-Signature.',
    ],
    codeSnippet: `curl -X POST "https://api.trivaana.ai/api/public/lead-intake/aravind-villas" \\
  -H "Content-Type: application/json" \\
  -H "X-Intake-Secret: trv_live_agent_secret" \\
  -d '{
    "name": "Aman Verma",
    "phone": "+919848012345",
    "city": "Noida",
    "budget": "90L",
    "consent_confirmed": true
  }'

# Response: 202 Accepted
{ "status": "queued", "call_id": "call_instant_9481a", "eta_seconds": 14 }`,
  },
  {
    id: 'compliance-dnd',
    group: 'CALLING CHANNELS',
    title: 'TRAI TCCCPR Calling Window & DND Scrubbing',
    subtitle: 'Built-in statutory safeguards across bulk campaigns and instant callbacks.',
    anchors: ['10 AM – 6 PM IST Enforcement', 'Workspace DNC Ledger', 'Service/Transactional Bypass'],
    body: [
      'Promotional outbound campaigns automatically suppress dials outside permitted TRAI IST hours (configurable in Settings → Compliance) and scrub every contact against your Do-Not-Call list and reusable Suppression Lists.',
      'Transactional/Service callbacks initiated directly from an explicit user lead form require consent_confirmed=true and honor instant opt-out keywords during the call.',
    ],
  },
];

export const DocsPortalPage: React.FC<DocsPortalPageProps> = ({
  initialSection = 'what-trivaana-does',
  onBackToSite,
  onEnterDashboard,
  onNavigateContact,
}) => {
  const [selectedId, setSelectedId] = useState(
    DOC_ARTICLES.some((a) => a.id === initialSection) ? initialSection : 'what-trivaana-does'
  );
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const filtered = DOC_ARTICLES.filter((a) =>
    `${a.title} ${a.subtitle} ${a.body.join(' ')}`.toLowerCase().includes(search.toLowerCase())
  );
  const article = DOC_ARTICLES.find((a) => a.id === selectedId) || DOC_ARTICLES[0];

  const handleCopySnippet = () => {
    if (!article.codeSnippet) return;
    navigator.clipboard?.writeText(article.codeSnippet).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-white text-[#0f0f14] flex">
      {/* Left Alabaster Docs Sidebar Matching docs.outpero.com */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[#f6f6f8] border-r border-[#e4e4e9] flex-col justify-between p-4">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <button type="button" onClick={onBackToSite} className="cursor-pointer">
              <TrivaanaLogo size={28} showText={true} subtitle="" />
            </button>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]">
              Docs
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {['START HERE', 'CALLING CHANNELS', 'API DOCUMENTATION'].map((grp) => (
              <div key={grp} className="space-y-1">
                <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#8a8a98]">
                  {grp}
                </div>
                {filtered
                  .filter((a) => a.group === grp)
                  .map((a, idx) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center gap-2 ${
                        selectedId === a.id
                          ? 'bg-white text-[#0f0f14] font-bold border border-[#e4e4e9] shadow-2xs'
                          : 'text-[#525260] hover:bg-[#ebebf0]'
                      }`}
                    >
                      {grp === 'START HERE' && (
                        <span className="w-4 h-4 rounded-full bg-[#ff5500] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                      )}
                      <span className="truncate">{a.title.replace(/\.$/, '')}</span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-[#e4e4e9] space-y-1.5 text-xs">
          <button
            type="button"
            onClick={() => setSelectedId('api-overview')}
            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#ebebf0] font-semibold text-[#ff5500] flex items-center gap-2 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" /> API documentation
          </button>
          <button
            type="button"
            onClick={onNavigateContact}
            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#ebebf0] font-medium text-[#525260] flex items-center gap-2 cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Still stuck? Contact us
          </button>
        </div>
      </aside>

      {/* Center Content + Top Search Header */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-[#e4e4e9] px-4 sm:px-8 flex items-center justify-between gap-4 bg-white sticky top-0 z-20">
          <button
            type="button"
            onClick={onBackToSite}
            className="md:hidden inline-flex items-center gap-1.5 text-xs font-bold text-[#0f0f14]"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </button>

          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 text-[#8a8a98] absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documentation & API guides..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9] text-xs focus:outline-none focus:border-[#ff5500]"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToSite}
              className="px-3.5 py-2 rounded-xl border border-[#e4e4e9] hover:bg-[#f6f6f8] text-xs font-semibold cursor-pointer hidden sm:inline-flex"
            >
              Public Site
            </button>
            <button
              type="button"
              onClick={onEnterDashboard}
              className="px-4 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ea580c] text-white text-xs font-bold cursor-pointer"
            >
              Back to app
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <article className="lg:col-span-9 space-y-6">
            <AuroraBackground className="rounded-3xl bg-gradient-to-b from-[#fff7ed]/80 to-[#f6f6f8] border border-[#e4e4e9] p-6 sm:p-8 space-y-6">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#ff5500] inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> HELP CENTRE
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0f0f14] tracking-tight mt-1">
                  {article.title}
                </h1>
                <p className="text-xs sm:text-sm text-[#525260] mt-2">{article.subtitle}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-white border border-[#e4e4e9]">
                  <PhoneForwarded className="w-4 h-4 text-[#ff5500] mb-1.5" />
                  <div className="font-display text-xl font-extrabold">3</div>
                  <div className="text-[11px] text-[#6e6e7e]">Calling channels</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#e4e4e9]">
                  <Bot className="w-4 h-4 text-indigo-600 mb-1.5" />
                  <div className="font-display text-xl font-extrabold">7</div>
                  <div className="text-[11px] text-[#6e6e7e]">Indian languages</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#e4e4e9]">
                  <CreditCard className="w-4 h-4 text-emerald-600 mb-1.5" />
                  <div className="font-display text-xl font-extrabold">₹5–₹6.8</div>
                  <div className="text-[11px] text-[#6e7e]">Per connected min</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#e4e4e9]">
                  <ShieldCheck className="w-4 h-4 text-amber-600 mb-1.5" />
                  <div className="font-display text-xl font-extrabold">₹649</div>
                  <div className="text-[11px] text-[#6e6e7e]">Channel / month</div>
                </div>
              </div>
            </AuroraBackground>

            <div className="space-y-4 text-sm text-[#3f3f4e] leading-relaxed">
              {article.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {article.codeSnippet && (
              <div className="rounded-2xl bg-[#121019] text-white p-5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2.5">
                  <span className="font-mono-code text-[#ff8547]">
                    <DecryptedText text="X-Intake-Secret · HTTPS POST" />
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySnippet}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy snippet'}</span>
                  </button>
                </div>
                <pre className="font-mono-code text-xs text-slate-200 overflow-x-auto leading-relaxed">
                  {article.codeSnippet}
                </pre>
              </div>
            )}
          </article>

          <aside className="hidden lg:block lg:col-span-3 space-y-2 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a98]">
              ON THIS PAGE
            </div>
            <ul className="space-y-2 border-l border-[#e4e4e9] pl-3 text-[#525260]">
              {article.anchors.map((anc) => (
                <li key={anc} className="font-medium hover:text-[#0f0f14]">{anc}</li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
};

