// @chimerai component=ModelProvidersPage version=1.0
// Model Providers Management Page
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface ProviderModel {
  id: string;
  modelId: string;
  name: string;
  capabilities: string[];
}

interface Provider {
  id: string;
  name: string;
  type: string;
  baseUrl?: string;
  status: string;
  isDefault: boolean;
  models: ProviderModel[];
  createdAt: string;
}

interface ProviderFormData {
  name: string;
  type: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}

interface TestResult {
  success: boolean;
  responseTime?: number;
  errorMessage?: string;
}

const PROVIDER_TYPES = [
  { value: 'openai', label: 'OpenAI', placeholder: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic', placeholder: 'https://api.anthropic.com' },
  { value: 'ollama', label: 'Ollama (Local)', placeholder: 'http://localhost:11434' },
  { value: 'groq', label: 'Groq', placeholder: 'https://api.groq.com/openai/v1' },
  { value: 'google', label: 'Google AI', placeholder: '' },
  { value: 'custom', label: 'Custom OpenAI-Compatible', placeholder: '' },
];

const emptyForm: ProviderFormData = { name: 'OpenAI', type: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', defaultModel: '' };

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [editingModels, setEditingModels] = useState<ProviderModel[]>([]);

  const { data: session, status: sessionStatus } = useSession();
  const _roles = (session?.user as any)?.roles ?? [];
  const _hasPerm = (perm: string) => _roles.some((r: any) => (r.permissions ?? []).some((p: string) => p === '*' || p === perm || (p.endsWith(':*') && perm.startsWith(p.slice(0, -2) + ':'))));
  const canRead = _roles.length === 0 || _hasPerm('providers:read') || _hasPerm('admin:providers');
  const canWrite = _roles.length === 0 || _hasPerm('providers:write') || _hasPerm('admin:providers');

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
      if (res.status === 403) { setError("You don't have permission to view providers. Contact your administrator to request the 'providers:read' permission."); return; }
      if (!res.ok) throw new Error('Failed to load providers');
      const data = await res.json();
      setProviders(data.providers || data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (sessionStatus === 'authenticated' && !canRead) { setLoading(false); return; }
    fetchProviders();
  }, [fetchProviders, sessionStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = editingId ? `/api/providers/${editingId}` : '/api/providers';
      const method = editingId ? 'PUT' : 'POST';
      const config: Record<string, string> = {};
      if (formData.apiKey) config.apiKey = formData.apiKey;
      if (formData.baseUrl) config.baseUrl = formData.baseUrl;
      if (formData.defaultModel) config.defaultModel = formData.defaultModel;
      const body: Record<string, any> = {
        name: formData.name,
        type: formData.type,
        config,
      };

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Failed to save provider');
      setShowForm(false);
      setEditingId(null);
      setFormData(emptyForm);
      await fetchProviders();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this provider?')) return;
    try {
      await fetch(`/api/providers/${id}`, { method: 'DELETE' });
      await fetchProviders();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTest = async (id: string) => {
    setTesting(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/providers/${id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [id]: data }));
      // Auto-sync models after successful test
      if (data.success) {
        await handleSync(id);
      }
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { success: false, errorMessage: 'Connection failed' } }));
    } finally {
      setTesting(prev => ({ ...prev, [id]: false }));
    }
  };

  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const handleSync = async (id: string) => {
    setSyncing(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/providers/${id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchProviders();
      }
    } catch {
      // Sync failed silently — models will appear on next manual sync
    } finally {
      setSyncing(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      await fetchProviders();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openEdit = (provider: Provider) => {
    // Parse config safely (PostgreSQL returns JSON object, SQLite returns JSON string)
    const rawConfig = (provider as any).config;
    const providerConfig: { defaultModel?: string } | null =
      typeof rawConfig === 'string' ? (() => { try { return JSON.parse(rawConfig); } catch { return null; } })() : rawConfig || null;
    setFormData({ name: provider.name, type: provider.type, apiKey: '', baseUrl: provider.baseUrl || '', defaultModel: providerConfig?.defaultModel || '' });
    setEditingModels(provider.models || []);
    setEditingId(provider.id);
    setShowForm(true);
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1 dark:text-white">AI Model Providers</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your AI model provider connections</p>
        </div>
        <button onClick={() => {
            if (!canWrite) { setError("You don't have permission to add providers. Contact your administrator to request the 'providers:write' permission."); return; }
            setFormData(emptyForm); setEditingId(null); setEditingModels([]); setShowForm(true);
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          + Add Provider
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">{error}</div>}

      {showForm && (
        <div className="mb-6 p-6 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">{editingId ? 'Edit' : 'Add'} Provider</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Name</label>
                <input type="text" required value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="My OpenAI" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Type</label>
                <select value={formData.type} onChange={e => {
                    const newType = e.target.value;
                    const info = PROVIDER_TYPES.find(t => t.value === newType);
                    setFormData(f => ({
                      ...f,
                      type: newType,
                      name: PROVIDER_TYPES.some(t => t.label === f.name) ? (info?.label ?? f.name) : f.name,
                      baseUrl: info?.placeholder ?? '',
                    }));
                  }}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
                  {PROVIDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">API Key {editingId ? '(leave empty to keep current)' : formData.type === 'ollama' ? '(optional for Ollama)' : ''}</label>
              <input type="password" value={formData.apiKey}
                onChange={e => setFormData(f => ({ ...f, apiKey: e.target.value }))}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder={formData.type === 'ollama' ? '(not required)' : 'sk-...'} required={!editingId && formData.type !== 'ollama'} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Base URL (optional)</label>
              <input type="text" value={formData.baseUrl}
                onChange={e => setFormData(f => ({ ...f, baseUrl: e.target.value }))}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Default Model</label>
              {editingModels.length > 0 ? (
                <select value={formData.defaultModel}
                  onChange={e => setFormData(f => ({ ...f, defaultModel: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
                  <option value="">— Select a model —</option>
                  {editingModels
                    .filter(m => !m.capabilities || m.capabilities.length === 0 || m.capabilities.some(c => ['chat', 'completion'].includes(c)))
                    .map(m => <option key={m.id} value={m.modelId}>{m.name || m.modelId}</option>)}
                </select>
              ) : (
                <input type="text" value={formData.defaultModel}
                  onChange={e => setFormData(f => ({ ...f, defaultModel: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="e.g. gpt-4o-mini" />
              )}
              <p className="text-xs text-gray-400 mt-1">Used when the widget does not specify a model.{editingModels.length === 0 && editingId ? ' Sync models first to see available options.' : ''}</p>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {sessionStatus === 'authenticated' && !canRead ? (
        <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="font-medium text-yellow-800 dark:text-yellow-300">Access denied</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">You don't have permission to view providers. Contact your administrator to request the <code className="font-mono bg-yellow-100 dark:bg-yellow-900 px-1 rounded">providers:read</code> permission.</p>
        </div>
      ) : loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}</div>
      ) : providers.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">No providers configured</p>
          <p>Click "Add Provider" to connect your first AI model provider.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map(provider => (
            <div key={provider.id} className="p-5 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg dark:text-white">{provider.name}</h3>
                  {provider.isDefault && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">Default</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${provider.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                  {provider.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Type: {provider.type}</p>
              {provider.models.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {provider.models.slice(0, 4).map(m => (
                    <span key={m.id} className="text-xs bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">{m.name || m.modelId}</span>
                  ))}
                  {provider.models.length > 4 && <span className="text-xs text-gray-400">+{provider.models.length - 4} more</span>}
                </div>
              )}
              {testResults[provider.id] && (
                <div className={`text-sm p-2 rounded mb-3 ${testResults[provider.id].success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                  {testResults[provider.id].success ? `✓ Connected (${testResults[provider.id].responseTime}ms)` : `✗ ${testResults[provider.id].errorMessage}`}
                </div>
              )}
              <div className="flex gap-2 mt-3 pt-3 border-t dark:border-gray-700">
                <button onClick={() => handleTest(provider.id)} disabled={testing[provider.id]}
                  className="text-sm px-3 py-1 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 disabled:opacity-50">
                  {testing[provider.id] ? 'Testing...' : 'Test'}
                </button>
                <button onClick={() => handleSync(provider.id)} disabled={syncing[provider.id]}
                  className="text-sm px-3 py-1 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 disabled:opacity-50">
                  {syncing[provider.id] ? 'Syncing...' : 'Sync Models'}
                </button>
                <button onClick={() => openEdit(provider)} className="text-sm px-3 py-1 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">Edit</button>
                <button onClick={() => handleToggleStatus(provider.id, provider.status)}
                  className={`text-sm px-3 py-1 border rounded ${provider.status === 'active' ? 'border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' : 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                  {provider.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(provider.id)}
                  className="text-sm px-3 py-1 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
