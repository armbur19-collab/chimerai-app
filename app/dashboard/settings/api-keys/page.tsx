// @chimerai component=ApiKeyManagementPage version=2.0
'use client';

import { useState, useEffect, useCallback } from 'react';

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  revoked: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const SCOPE_TEMPLATES: Record<string, string[]> = {
  'Chat Widget': ['chat'],
  'Chat + RAG': ['chat', 'rag'],
  'Read-Only': ['read'],
  'Full Access': ['*'],
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['chat']);
  const [newKeyExpDays, setNewKeyExpDays] = useState(90);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/api-keys');
      if (!res.ok) throw new Error('Failed to load keys');
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setError(null);
    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: newKeyScopes,
          expiresInDays: newKeyExpDays > 0 ? newKeyExpDays : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create key');
      }
      const data = await res.json();
      setCreatedKey(data.key);
      setNewKeyName('');
      setNewKeyScopes(['chat']);
      setNewKeyExpDays(90);
      setShowCreate(false);
      fetchKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/v1/api-keys/' + id, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke key');
      fetchKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const embedCode = (prefix: string) => `<!-- ChimerAI Chat Widget -->
<script src="${appUrl}/widget/chat.js"><\/script>
<div id="chimerai-chat" style="width: 400px; height: 600px;"></div>
<script>
  ChimerAI.mount('#chimerai-chat', {
    apiKey: '${prefix}...',  // Use your full API key
    endpoint: '${appUrl}',
    theme: 'auto',
  });
<\/script>`;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">API Keys</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage API keys for external integrations and widgets.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
        >
          + Create Key
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}

      {/* Created Key Banner — shown ONCE */}
      {createdKey && (
        <div className="p-4 mb-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
          <p className="font-semibold text-green-800 dark:text-green-300 mb-2">
            🔑 API Key Created — Copy it now! It won't be shown again.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm break-all font-mono dark:text-gray-200">
              {createdKey}
            </code>
            <button
              onClick={() => copyToClipboard(createdKey)}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded transition-colors text-sm"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-2 text-sm text-green-700 dark:text-green-400 underline hover:opacity-70"
          >
            I've copied it, dismiss
          </button>
        </div>
      )}

      {/* Create Key Dialog */}
      {showCreate && (
        <div className="p-5 mb-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-base font-semibold mb-3 dark:text-white">Create New API Key</h3>

          <label className="block mb-1 text-sm font-medium dark:text-gray-300">Name</label>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. My Blog Widget"
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded mb-3 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />

          <label className="block mb-1 text-sm font-medium dark:text-gray-300">Scope Template</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {Object.entries(SCOPE_TEMPLATES).map(([label, scopes]) => (
              <button
                key={label}
                onClick={() => setNewKeyScopes(scopes)}
                className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                  JSON.stringify(newKeyScopes) === JSON.stringify(scopes)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="block mb-1 text-sm font-medium dark:text-gray-300">
            Expiration (days, 0 = never)
          </label>
          <input
            type="number"
            value={newKeyExpDays}
            onChange={(e) => setNewKeyExpDays(Number(e.target.value))}
            min={0}
            className="w-28 p-2 border border-gray-300 dark:border-gray-600 rounded mb-4 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newKeyName.trim()}
              className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded transition-colors font-medium"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-5 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 dark:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keys Table */}
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-base mb-1">No API keys yet.</p>
          <p className="text-sm">Create one to embed ChimerAI chat in external websites.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Key</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scopes</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Used</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expires</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {keys.map((k) => (
                <tr key={k.id} className={`${k.revoked ? 'opacity-50' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}>
                  <td className="px-3 py-2.5 text-sm dark:text-gray-200">{k.name}</td>
                  <td className="px-3 py-2.5 text-xs font-mono dark:text-gray-300">{k.prefix}...</td>
                  <td className="px-3 py-2.5 text-xs dark:text-gray-300">
                    {k.scopes.length > 0
                      ? k.scopes.map((s) => (
                          <span key={s} className="inline-block mr-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                            {s}
                          </span>
                        ))
                      : <span className="text-gray-400">unrestricted</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                    {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-3 py-2.5">
                    {k.revoked ? (
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">Revoked</span>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setShowEmbed(showEmbed === k.id ? null : k.id)}
                          className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          title="Embed code"
                        >
                          {'</>'}
                        </button>
                        <button
                          onClick={() => handleRevoke(k.id)}
                          className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                    {showEmbed === k.id && (
                      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                        <p className="text-xs font-medium mb-1.5 dark:text-gray-300">Embed Code:</p>
                        <pre className="text-[11px] whitespace-pre-wrap bg-gray-900 text-gray-200 p-3 rounded overflow-auto">
                          {embedCode(k.prefix)}
                        </pre>
                        <button
                          onClick={() => copyToClipboard(embedCode(k.prefix))}
                          className="mt-1.5 px-3 py-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
