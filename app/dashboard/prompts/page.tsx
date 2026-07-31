// @chimerai component=PromptManagementPage version=4.0
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const PROMPT_CATEGORIES = [
  { value: 'system',  label: 'System Prompt', description: 'Chat conversation behavior' },
  { value: 'rag',     label: 'RAG Template',  description: 'Document context framing' },
  { value: 'widget',  label: 'Widget Prompt', description: 'For embedded chat widget' },
] as const;

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  description?: string;
  content: string;
  variables: string[];
  language: string;
  version: number;
  isActive: boolean;
  isDefault: boolean;
  tags: string[];
  createdBy: string | null;
  visibility: string;
  allowedRoles: string[];
  canEdit?: boolean;
}

interface Role { id: string; name: string; }
interface UserOverride { userId: string; email: string; name: string | null; granted: boolean; }

const EMPTY_FORM = {
  name: '', category: 'system', description: '', content: '',
  language: 'en', tags: '', visibility: 'public', allowedRoles: [] as string[],
};

export default function PromptsPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [current, setCurrent] = useState<PromptTemplate | null>(null);
  const [formData, setFormData] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);

  const { data: session } = useSession();
  const _roles = (session?.user as any)?.roles ?? [];
  const isAdmin = _roles.some((r: any) => (r.permissions ?? []).includes('*'));
  const hasRbac = _roles.length > 0;

  useEffect(() => { fetchTemplates(); }, []);

  useEffect(() => {
    if (hasRbac) {
      fetch('/api/admin/roles').then(r => r.json()).then(d => {
        setAvailableRoles(Array.isArray(d) ? d.map((r: any) => ({ id: r.id, name: r.name })) : []);
      }).catch(() => {});
    }
  }, [hasRbac]);

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/prompts');
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch { console.error('Failed to fetch templates'); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const payload = { ...formData, tags: formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean) };
    const res = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { setError((await res.json()).error || 'Failed to create'); return; }
    setShowCreate(false);
    setFormData(EMPTY_FORM);
    fetchTemplates();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    setError('');
    const payload = { ...formData, tags: formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean) };
    const res = await fetch(`/api/prompts/${current.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { setError((await res.json()).error || 'Failed to update'); return; }
    setShowEdit(false);
    setCurrent(null);
    fetchTemplates();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    const res = await fetch(`/api/prompts/${id}`, { method: 'DELETE' });
    if (res.ok) fetchTemplates();
  }

  async function handleSetDefault(id: string) {
    const res = await fetch(`/api/prompts/${id}/set-default`, { method: 'POST' });
    if (res.ok) fetchTemplates();
  }

  function openEdit(t: PromptTemplate) {
    setCurrent(t);
    setFormData({
      name: t.name,
      category: t.category,
      description: t.description || '',
      content: t.content,
      language: t.language,
      tags: t.tags.join(', '),
      visibility: t.visibility || 'public',
      allowedRoles: t.allowedRoles ?? [],
    });
    setError('');
    setShowEdit(true);
  }

  function getCategoryLabel(v: string) {
    return PROMPT_CATEGORIES.find(c => c.value === v)?.label ?? v;
  }

  const allTags = [...new Set(templates.flatMap(t => t.tags))].sort();

  const filtered = templates.filter(t =>
    (categoryFilter === 'all' || t.category === categoryFilter) &&
    (!selectedTag || t.tags.includes(selectedTag)) &&
    (!searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.description?.toLowerCase().includes(searchQuery.toLowerCase()) || t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Prompt Templates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage system prompts and RAG templates for your AI</p>
        </div>
        <button
          onClick={() => { setFormData(EMPTY_FORM); setError(''); setShowCreate(true); }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium"
        >
          + Create Template
        </button>
      </div>

      <div className="mb-3 flex gap-3">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="all">All Categories</option>
          {PROMPT_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      {allTags.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-gray-500">Tags:</span>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${selectedTag === tag ? 'bg-purple-600 text-white' : 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900'}`}
            >
              {tag}
            </button>
          ))}
          {selectedTag && (
            <button onClick={() => setSelectedTag(null)} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-1">✕ clear</button>
          )}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">No templates found.</div>
      )}

      <div className="space-y-3">
        {filtered.map(template => (
          <div key={template.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">{getCategoryLabel(template.category)}</span>
                  {template.isDefault && <span className="px-2 py-0.5 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 rounded text-xs font-medium">Default</span>}
                  {template.createdBy === null && <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 rounded text-xs">System</span>}
                  {template.visibility === 'private' && <span className="px-2 py-0.5 bg-gray-800 dark:bg-gray-600 text-gray-100 rounded text-xs">Private</span>}
                  {(template.visibility === 'restricted' || template.visibility === 'role_restricted') && (
                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 rounded text-xs">
                      Restricted {template.allowedRoles?.length > 0 ? `(${template.allowedRoles.join(', ')})` : ''}
                    </span>
                  )}
                </div>
                {template.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{template.description}</p>}
                <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded">{template.content}</p>
                {template.variables.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-gray-400 dark:text-gray-500">Variables:</span>
                    {template.variables.map(v => (
                      <span key={v} className="px-1.5 py-0.5 bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 rounded text-xs font-mono">{'{{' + v + '}}'}</span>
                    ))}
                  </div>
                )}
                {template.tags.length > 0 && (
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-gray-400 dark:text-gray-500">Tags:</span>
                    {template.tags.map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 rounded text-xs">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!template.isDefault && (
                  <button
                    onClick={() => handleSetDefault(template.id)}
                    className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                    title="Set as default for this category"
                  >
                    Set Default
                  </button>
                )}
                {template.canEdit && (
                  <>
                    <button onClick={() => openEdit(template)} className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-950">Edit</button>
                    <button onClick={() => handleDelete(template.id)} className="px-2 py-1 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-950">Delete</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <PromptModal
          title="Create Prompt Template"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          submitLabel="Create"
          error={error}
          isAdmin={isAdmin}
          availableRoles={availableRoles}
        />
      )}
      {showEdit && (
        <PromptModal
          title="Edit Prompt Template"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleUpdate}
          onCancel={() => { setShowEdit(false); setCurrent(null); }}
          submitLabel="Save Changes"
          error={error}
          isAdmin={isAdmin}
          availableRoles={availableRoles}
          promptId={current?.id}
        />
      )}
    </div>
  );
}

function PromptModal({
  title, formData, setFormData, onSubmit, onCancel, submitLabel, error,
  isAdmin, availableRoles, promptId,
}: {
  title: string;
  formData: any;
  setFormData: (d: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  error: string;
  isAdmin: boolean;
  availableRoles: Role[];
  promptId?: string;
}) {
  const toggleRole = (roleName: string) => {
    const current: string[] = formData.allowedRoles || [];
    setFormData({
      ...formData,
      allowedRoles: current.includes(roleName)
        ? current.filter((r: string) => r !== roleName)
        : [...current, roleName],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 dark:text-white">{title}</h2>
        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Customer Support Agent" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              {PROMPT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} - {c.description}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
              <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">Use {'{{variable}}'} for dynamic placeholders</span>
            </label>
            <textarea value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} required rows={6} placeholder="You are a helpful assistant..." className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
              <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">Comma-separated, e.g. formal, customer-service</span>
            </label>
            <input type="text" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} placeholder="formal, customer-service, de" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>

          <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Visibility</label>
              <div className="flex gap-4">
                {(['public', 'private', ...(isAdmin ? ['restricted'] : [])] as const).map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value={v}
                      checked={formData.visibility === v}
                      onChange={() => setFormData({ ...formData, visibility: v, allowedRoles: v === 'restricted' ? formData.allowedRoles : [] })}
                      className="accent-gray-700"
                    />
                    <span className="text-sm dark:text-gray-200">
                      <span className="font-medium capitalize">{v}</span>
                      <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                        {v === 'public' ? 'everyone' : v === 'private' ? 'only you' : 'selected roles'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              {formData.visibility === 'restricted' && availableRoles.length > 0 && (
                <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-2">Allowed Roles</p>
                  <div className="flex flex-wrap gap-3">
                    {availableRoles.map(role => (
                      <label key={role.id} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(formData.allowedRoles || []).includes(role.name)}
                          onChange={() => toggleRole(role.name)}
                          className="accent-orange-600"
                        />
                        <span className="text-sm dark:text-gray-200">{role.name}</span>
                      </label>
                    ))}
                  </div>
                  {(formData.allowedRoles || []).length === 0 && (
                    <p className="text-xs text-orange-500 dark:text-orange-400 mt-1">Select at least one role — otherwise no one can see this prompt.</p>
                  )}
                </div>
              )}
            </div>

          {isAdmin && promptId && (
            <UserOverridesSection promptId={promptId} />
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">{submitLabel}</button>
            <button type="button" onClick={onCancel} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserOverridesSection({ promptId }: { promptId: string }) {
  const [overrides, setOverrides] = useState<UserOverride[]>([]);
  const [email, setEmail] = useState('');
  const [granted, setGranted] = useState(true);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/prompts/${promptId}/access`);
      if (res.ok) setOverrides(await res.json());
    } catch {}
  }, [promptId]);

  useEffect(() => { load(); }, [load]);

  async function addOverride() {
    if (!email.trim()) return;
    setAdding(true);
    setErr('');
    const res = await fetch(`/api/prompts/${promptId}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), granted }),
    });
    if (!res.ok) {
      const d = await res.json();
      setErr(d.error || 'Failed to add override');
    } else {
      setEmail('');
      load();
    }
    setAdding(false);
  }

  async function removeOverride(userId: string) {
    await fetch(`/api/prompts/${promptId}/access`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    load();
  }

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
      <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">User Overrides <span className="font-normal text-gray-400 dark:text-gray-500">(allow or deny specific users regardless of role)</span></p>

      {overrides.length > 0 && (
        <div className="space-y-1 mb-3">
          {overrides.map(o => (
            <div key={o.userId} className="flex items-center justify-between py-1 px-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm">
              <span className="text-gray-700 dark:text-gray-200">{o.email || o.name || o.userId}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${o.granted ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
                  {o.granted ? 'allow' : 'deny'}
                </span>
                <button type="button" onClick={() => removeOverride(o.userId)} className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOverride())}
        />
        <select value={granted ? 'allow' : 'deny'} onChange={e => setGranted(e.target.value === 'allow')} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          <option value="allow">Allow</option>
          <option value="deny">Deny</option>
        </select>
        <button type="button" onClick={addOverride} disabled={adding || !email.trim()} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-800 disabled:opacity-50">
          Add
        </button>
      </div>
      {err && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err}</p>}
    </div>
  );
}
