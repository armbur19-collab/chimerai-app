// @chimerai component=ModelSelector version=2.0
'use client';

import { useMemo } from 'react';

export interface ModelOption {
  id: string;
  modelId: string;
  name: string;
  providerId: string;
  providerType: string;
  contextWindow: number;
  inputCost: number;
  outputCost: number;
  capabilities: string[];
  provider: {
    id: string;
    name: string;
    type: string;
  };
}

interface ModelSelectorProps {
  models: ModelOption[];
  value: string;
  onValueChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ models, value, onValueChange, disabled }: ModelSelectorProps) {
  // Group models by provider
  const grouped = useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};
    for (const model of models) {
      const providerName = model.provider?.name || 'Unknown';
      if (!groups[providerName]) groups[providerName] = [];
      groups[providerName].push(model);
    }
    return groups;
  }, [models]);

  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
      className="h-8 text-xs w-[220px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]"
    >
      <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Select a model</option>
      {Object.entries(grouped).map(([providerName, providerModels]) => (
        <optgroup key={providerName} label={providerName} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold">
          {providerModels.map((model) => (
            <option key={model.id} value={model.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              {model.name}{model.contextWindow >= 100000 ? ` (${Math.round(model.contextWindow / 1000)}k)` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
