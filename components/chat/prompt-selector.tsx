// @chimerai component=PromptSelector version=1.0
'use client';

import { useState, useEffect } from 'react';

interface PromptOption {
  id: string;
  name: string;
  isDefault: boolean;
}

interface PromptSelectorProps {
  value: string | null;
  onChange: (promptId: string | null) => void;
  /** Filter to this category (default: 'system') */
  category?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Dropdown to select a prompt template for a chat conversation.
 * Usage: <PromptSelector value={promptId} onChange={setPromptId} category="system" />
 */
export function PromptSelector({
  value,
  onChange,
  category = 'system',
  placeholder = 'No system prompt',
  className = '',
}: PromptSelectorProps) {
  const [prompts, setPrompts] = useState<PromptOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/prompts?category=${category}`)
      .then(r => r.json())
      .then(data => setPrompts(Array.isArray(data) ? data : []))
      .catch(() => setPrompts([]))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      disabled={loading}
      className={`px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:opacity-50 ${className}`}
    >
      <option value="">{placeholder}</option>
      {prompts.map(p => (
        <option key={p.id} value={p.id}>
          {p.name}{p.isDefault ? ' (Default)' : ''}
        </option>
      ))}
    </select>
  );
}
