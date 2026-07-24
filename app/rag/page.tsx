// @chimerai component=RagPage version=1.1
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface VectorStats {
  total_vectors: number;
  dimension: number;
  index_type: string;
}

interface UploadedDoc {
  name: string;
  type: string;
  size: number;
  chunks: number;
  status: 'uploading' | 'processing' | 'indexed' | 'error';
  progress: number;
  error?: string;
  chunkIds?: number[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ text: string; score: number; metadata: Record<string, any> }>;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function RagPage() {
  const [tab, setTab] = useState<'documents' | 'chat'>('documents');

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
    <div className="container mx-auto py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">RAG Pipeline</h1>
      <p className="text-muted-foreground mb-6">Upload documents and chat with your knowledge base</p>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button onClick={() => setTab('documents')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${tab === 'documents' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          📄 Documents
        </button>
        <button onClick={() => setTab('chat')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${tab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          💬 Chat with Docs
        </button>
      </div>

      {tab === 'documents' ? <DocumentsTab /> : <ChatTab />}
    </div>
    </div>
  );
}

// ─── Documents Tab ──────────────────────────────────────────────────────────
function DocumentsTab() {
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/rag/stats');
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  // Documents are grouped from FAISS chunk metadata (no separate document
  // registry), so reload the list on mount to survive page refreshes.
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/rag/documents');
      if (!res.ok) return;
      const data = await res.json();
      const loaded: UploadedDoc[] = (data.documents || []).map((d: any) => ({
        name: d.filename,
        type: d.content_type || 'unknown',
        size: 0,
        chunks: d.chunk_count,
        status: 'indexed' as const,
        progress: 100,
        chunkIds: d.chunk_ids,
      }));
      setDocs(loaded);
    } catch {}
  }, []);

  useEffect(() => { fetchStats(); fetchDocuments(); }, [fetchStats, fetchDocuments]);

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const doc: UploadedDoc = {
        name: file.name,
        type: file.type || file.name.split('.').pop() || 'unknown',
        size: file.size,
        chunks: 0,
        status: 'uploading',
        progress: 30,
      };
      setDocs(prev => [...prev, doc]);

      // Embedding can take a while for larger files (batched requests to the
      // model), so creep the bar toward 90% while waiting instead of sitting
      // frozen at 60% — real progress isn't available without backend streaming.
      const progressTimer = setInterval(() => {
        setDocs(prev => prev.map(d =>
          d.name === file.name && d.status === 'processing' && d.progress < 90
            ? { ...d, progress: d.progress + 5 }
            : d
        ));
      }, 800);

      try {
        setDocs(prev => prev.map(d => d.name === file.name ? { ...d, status: 'processing', progress: 60 } : d));

        const formData = new FormData();
        formData.append('files', file);

        const res = await fetch('/api/rag', {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        const fileResult = result.files?.find((f: any) => f.filename === file.name);

        if (!res.ok || fileResult?.status === 'error') {
          const message = fileResult?.error || result.error || result.detail || `Upload failed (HTTP ${res.status})`;
          setDocs(prev => prev.map(d =>
            d.name === file.name ? { ...d, status: 'error', progress: 0, error: message } : d
          ));
        } else {
          setDocs(prev => prev.map(d =>
            d.name === file.name
              ? { ...d, status: 'indexed', progress: 100, chunks: fileResult?.chunks ?? result.added ?? 1, chunkIds: fileResult?.chunk_ids }
              : d
          ));
        }
        fetchStats();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error — request failed.';
        setDocs(prev => prev.map(d => d.name === file.name ? { ...d, status: 'error', progress: 0, error: message } : d));
      } finally {
        clearInterval(progressTimer);
      }
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all documents from the vector store?')) return;
    try {
      await fetch('/api/rag/clear', { method: 'DELETE' });
      setDocs([]);
      fetchStats();
    } catch {}
  };

  const handleDeleteDoc = async (doc: UploadedDoc) => {
    if (!doc.chunkIds?.length) return;
    if (!confirm(`Delete "${doc.name}" (${doc.chunkIds.length} chunks)?`)) return;
    try {
      await fetch('/api/rag/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_ids: doc.chunkIds }),
      });
      setDocs(prev => prev.filter(d => d !== doc));
      fetchStats();
    } catch {}
  };

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 border rounded-lg bg-card"><p className="text-sm text-muted-foreground">Total Vectors</p><p className="text-2xl font-bold">{stats.total_vectors}</p></div>
          <div className="p-4 border rounded-lg bg-card"><p className="text-sm text-muted-foreground">Dimension</p><p className="text-2xl font-bold">{stats.dimension}</p></div>
          <div className="p-4 border rounded-lg bg-card"><p className="text-sm text-muted-foreground">Index Type</p><p className="text-2xl font-bold">{stats.index_type}</p></div>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-6 ${dragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/30 hover:border-muted-foreground/50'}`}>
        <p className="text-lg mb-1">📁 Drop files here or click to browse</p>
        <p className="text-sm text-muted-foreground">Supports .pdf, .txt, .md, .docx — Max 10 MB</p>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.md,.docx" className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)} />
      </div>

      {/* Document List */}
      {docs.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex justify-between items-center p-3 bg-muted border-b">
            <span className="font-medium">{docs.length} document(s)</span>
            <button onClick={handleClearAll} className="text-sm text-red-600 hover:text-red-700">Clear All</button>
          </div>
          {docs.map((doc, i) => (
            <div key={i} className="flex items-center justify-between p-3 border-b last:border-b-0">
              <div className="flex-1">
                <p className="font-medium text-sm">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.size > 0 ? `${(doc.size / 1024).toFixed(1)} KB • ` : ''}{doc.chunks} chunks
                </p>
                {(doc.status === 'uploading' || doc.status === 'processing') && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5 w-full max-w-xs">
                    <div
                      className="h-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${doc.progress}%` }}
                    />
                  </div>
                )}
                {doc.status === 'error' && doc.error && (
                  <p className="text-xs text-red-600 mt-1">{doc.error}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                  doc.status === 'indexed' ? 'bg-green-100 text-green-700' :
                  doc.status === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>{doc.status}</span>
                {doc.status === 'indexed' && doc.chunkIds?.length ? (
                  <button onClick={() => handleDeleteDoc(doc)} title="Delete document"
                    className="text-xs text-red-600 hover:text-red-700">🗑</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chat Tab ───────────────────────────────────────────────────────────────
function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ragPrompts, setRagPrompts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    fetch('/api/prompts?category=rag')
      .then(r => r.ok ? r.json() : [])
      .then(data => Array.isArray(data) ? setRagPrompts(data) : null)
      .catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setLoading(true);

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, k: 3, ...(selectedPromptId ? { promptId: selectedPromptId } : {}) }),
      });
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.choices?.[0]?.message?.content || data.answer || 'No answer found.',
        sources: data.rag_metadata?.documents || [],
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Failed to get response.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 border rounded-lg bg-muted/50">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg mb-1">💬 Chat with your documents</p>
            <p className="text-sm">Upload documents in the Documents tab first, then ask questions here.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                  {msg.sources.map((s, j) => (
                    <div key={j} className="text-xs bg-muted rounded p-2 mb-1">
                      <span className="font-medium">{Math.round(s.score * 100)}% match</span>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2">{s.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start"><div className="bg-card border rounded-lg px-4 py-2 text-muted-foreground">Thinking...</div></div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Prompt selector (only shown when rag templates exist) */}
      {ragPrompts.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">RAG Prompt:</span>
          <select
            value={selectedPromptId}
            onChange={e => setSelectedPromptId(e.target.value)}
            className="flex-1 px-2 py-1 border rounded text-sm bg-background"
          >
            <option value="">Default</option>
            {ragPrompts.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask a question about your documents..."
          className="flex-1 px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={handleSend} disabled={loading || !input.trim()}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  );
}
