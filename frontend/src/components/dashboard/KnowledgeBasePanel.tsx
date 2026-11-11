import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Agent, KnowledgeDocument } from '@/types/trivaana';
import { GridScanBackground, ThoughtLine } from '@/components/reactbits';
import { BookOpen, Upload, Globe, Search, Trash2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

export const KnowledgeBasePanel: React.FC = () => {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState('faq');
  const [content, setContent] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAll = async () => {
    try {
      const [dRes, aRes] = await Promise.all([
        trivaanaApi.getKnowledgeDocuments(),
        trivaanaApi.getAgents(),
      ]);
      setDocs(dRes.documents || []);
      setAgents(aRes.agents || []);
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

  const handleAddText = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await trivaanaApi.addKnowledgeText({
        title,
        content,
        source_type: sourceType,
        agent_id: selectedAgentId || undefined,
      });
      setTitle('');
      setContent('');
      setFeedback({ type: 'success', message: `Indexed '${title}' into ${res.chunk_count} vector chunks (${res.embedding_provider}).` });
      loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await trivaanaApi.addKnowledgeUrl({
        url: urlInput,
        agent_id: selectedAgentId || undefined,
      });
      setUrlInput('');
      setFeedback({ type: 'success', message: `Crawled & indexed URL into ${res.chunk_count} vector chunks.` });
      loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    try {
      const res = await trivaanaApi.uploadKnowledgeFile(file, selectedAgentId || undefined);
      setFeedback({ type: 'success', message: `Uploaded '${file.name}' (${res.chunk_count} chunks).` });
      loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await trivaanaApi.searchKnowledge(searchQuery, selectedAgentId || undefined);
      setSearchResults(res.results || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <GridScanBackground className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-2 border border-orange-200">
            <BookOpen className="w-3.5 h-3.5 text-orange-600" />
            <span>Vector Knowledge Base &amp; RAG Retrieval</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Knowledge Base &amp; Grounding</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Upload PDFs, DOCX, TXT, CSV, FAQs, price lists, or website URLs so AI Employees answer accurately without hallucinating.
          </p>
        </div>
        <div className="shrink-0">
          <ThoughtLine
            steps={[
              { title: '1. Parse & Chunk', subtitle: 'Overlap splitting for context', done: true },
              { title: '2. Vectorize', subtitle: 'OpenAI or local embeddings', done: true },
              { title: '3. Ground Voice Turns', subtitle: 'Injected live during calls', done: docs.length > 0 },
            ]}
          />
        </div>
      </GridScanBackground>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Ingest Sources */}
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={handleAddText} className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3 text-xs">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-orange-600" /> Add Text / FAQ / Price List
            </div>
            <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
              <option value="">All Workspace AI Employees (Global KB)</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="Document Title" value={title} onChange={(e) => setTitle(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200" />
              <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200">
                <option value="faq">FAQ</option>
                <option value="pricelist">Price List</option>
                <option value="policy">Business Policy</option>
                <option value="text">Product Info</option>
              </select>
            </div>
            <textarea required rows={4} placeholder="Paste verified business facts, pricing, FAQs..." value={content} onChange={(e) => setContent(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            <button type="submit" className="w-full py-2 rounded-xl bg-orange-600 text-white font-bold cursor-pointer">Ingest & Vectorize</button>
          </form>

          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3 text-xs">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-orange-600" /> Upload File (PDF, DOCX, TXT, CSV)
            </div>
            <input type="file" accept=".pdf,.docx,.txt,.csv" onChange={handleFileUpload} className="w-full text-xs" />

            <form onSubmit={handleAddUrl} className="pt-3 border-t border-slate-100 flex gap-2">
              <input required type="url" placeholder="https://yourbusiness.com/pricing" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-slate-200" />
              <button type="submit" className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-1 cursor-pointer">
                <Globe className="w-3.5 h-3.5" /> Crawl
              </button>
            </form>
          </div>
        </div>

        {/* Right: Documents + Retrieval Sandbox */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3 text-xs">
            <div className="font-bold text-slate-900">Retrieval Testing Sandbox</div>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ask a customer question to verify vector retrieval..." className="flex-1 px-3 py-2 rounded-xl border border-slate-200" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold flex items-center gap-1 cursor-pointer">
                <Search className="w-3.5 h-3.5" /> Search
              </button>
            </form>
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((r) => (
                  <div key={r.chunk_id} className="p-3 rounded-xl bg-orange-50/70 border border-orange-200">
                    <div className="flex justify-between font-bold text-slate-900 mb-1">
                      <span>{r.title}</span>
                      <span className="font-mono text-orange-700">Score: {r.score}</span>
                    </div>
                    <p className="text-slate-700">{r.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#e4e4e9] space-y-2 text-xs">
            <div className="font-display font-bold text-[#0f0f14] pb-2 border-b border-[#e4e4e9]">Indexed Documents ({docs.length})</div>
            {docs.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#e4e4e9] bg-[#f6f6f8]/70 p-6 text-center space-y-1.5">
                <div className="font-bold text-[#0f0f14]">No Knowledge Documents Indexed Yet</div>
                <p className="text-[11px] text-[#6e6e7e]">
                  Paste FAQs, pricing tables, upload PDFs/CSVs, or crawl your website so AI Employees never hallucinate answers.
                </p>
              </div>
            )}
            {docs.map((d) => (
              <div key={d.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{d.title}</div>
                  <div className="text-[11px] text-slate-500">{d.source_type} • {d.chunk_count} chunks • {d.status}</div>
                </div>
                <button
                  onClick={async () => {
                    await trivaanaApi.deleteKnowledgeDocument(d.id);
                    loadAll();
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

