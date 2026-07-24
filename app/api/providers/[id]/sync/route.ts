// @chimerai component=ProviderSyncRoute version=1.0
/**
 * Provider Sync API Route
 * POST /api/providers/[id]/sync — Fetch models from provider API and save to DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

/** SQLite stores Json/String[] as plain String — serialize at runtime */
const _isSqlite = (process.env.DATABASE_URL || '').startsWith('file:');
function _toDb(v: any): any { return _isSqlite && v != null && typeof v !== 'string' ? JSON.stringify(v) : v; }

const KEYLESS_PROVIDERS = ['ollama'];

function getDefaultBaseUrl(type: string): string {
  switch (type) {
    case 'openai':    return 'https://api.openai.com/v1';
    case 'anthropic': return 'https://api.anthropic.com/v1';
    case 'ollama':    return 'http://localhost:11434';
    case 'groq':      return 'https://api.groq.com/openai/v1';
    case 'google':    return 'https://generativelanguage.googleapis.com/v1beta';
    default:          return 'https://api.openai.com/v1';
  }
}

/** Well-known model metadata for cost/context enrichment */
const MODEL_METADATA: Record<string, { contextWindow?: number; inputCost?: number; outputCost?: number; capabilities?: string[] }> = {
  'gpt-4o':                    { contextWindow: 128000, inputCost: 2.5, outputCost: 10, capabilities: ['chat', 'vision'] },
  'gpt-4o-mini':               { contextWindow: 128000, inputCost: 0.15, outputCost: 0.6, capabilities: ['chat'] },
  'gpt-4-turbo':               { contextWindow: 128000, inputCost: 10, outputCost: 30, capabilities: ['chat', 'vision'] },
  'gpt-4':                     { contextWindow: 8192, inputCost: 30, outputCost: 60, capabilities: ['chat'] },
  'gpt-3.5-turbo':             { contextWindow: 16385, inputCost: 0.5, outputCost: 1.5, capabilities: ['chat'] },
  'o1':                        { contextWindow: 200000, inputCost: 15, outputCost: 60, capabilities: ['chat'] },
  'o1-mini':                   { contextWindow: 128000, inputCost: 3, outputCost: 12, capabilities: ['chat'] },
  'o3-mini':                   { contextWindow: 200000, inputCost: 1.1, outputCost: 4.4, capabilities: ['chat'] },
  'text-embedding-3-small':    { contextWindow: 8191, inputCost: 0.02, outputCost: 0, capabilities: ['embedding'] },
  'text-embedding-3-large':    { contextWindow: 8191, inputCost: 0.13, outputCost: 0, capabilities: ['embedding'] },
  'claude-sonnet-4-20250514':  { contextWindow: 200000, inputCost: 3, outputCost: 15, capabilities: ['chat', 'vision'] },
  'claude-3-5-sonnet-20241022':{ contextWindow: 200000, inputCost: 3, outputCost: 15, capabilities: ['chat', 'vision'] },
  'claude-3-haiku-20240307':   { contextWindow: 200000, inputCost: 0.25, outputCost: 1.25, capabilities: ['chat'] },
  'claude-3-opus-20240229':    { contextWindow: 200000, inputCost: 15, outputCost: 75, capabilities: ['chat', 'vision'] },
};

/** Filter: only keep models useful for chat/embedding */
function isUsefulModel(modelId: string, providerType: string): boolean {
  if (providerType === 'ollama') return true;
  if (providerType === 'anthropic') return true;
  if (providerType === 'openai' || providerType === 'groq') {
    if (modelId.startsWith('ft:')) return false;
    if (/^(whisper|tts|dall-e|babbage|davinci|canary)/.test(modelId)) return false;
    return /^(gpt-|o1|o3|o4|text-embedding|chatgpt)/.test(modelId);
  }
  return true;
}

function humanName(modelId: string): string {
  return modelId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
    .replace(/Gpt /g, 'GPT ')
    .replace(/^O1/g, 'O1')
    .replace(/^O3/g, 'O3');
}

async function fetchOpenAIModels(baseUrl: string, apiKey: string) {
  const resp = await fetch(baseUrl + '/models', {
    headers: { Authorization: 'Bearer ' + apiKey },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error('OpenAI API returned ' + resp.status);
  const data = await resp.json();
  return (data.data || []).map((m: any) => ({ modelId: m.id, name: humanName(m.id) }));
}

async function fetchAnthropicModels() {
  // Anthropic has no /models endpoint — return well-known models
  return [
    { modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { modelId: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { modelId: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    { modelId: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  ];
}

async function fetchOllamaModels(baseUrl: string) {
  const resp = await fetch(baseUrl + '/api/tags', { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error('Ollama API returned ' + resp.status);
  const data = await resp.json();
  return (data.models || []).map((m: any) => ({
    modelId: m.name || m.model,
    name: (m.name || m.model).replace(/:latest$/, ''),
  }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const provider = await prisma.provider.findUnique({
      where: { id: id },
      select: { id: true, name: true, type: true, baseUrl: true, apiKey: true },
    });
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // defaultModelAccess not yet in all generated DB schemas — open access by default
    const defaultModelAccess: string[] = [];

    const baseUrl = provider.baseUrl || getDefaultBaseUrl(provider.type);
    const requiresKey = !KEYLESS_PROVIDERS.includes(provider.type);

    let apiKey: string | null = null;
    if (provider.apiKey) {
      try { apiKey = decrypt(provider.apiKey); } catch {
        return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 });
      }
    }
    if (requiresKey && !apiKey) {
      return NextResponse.json({ error: 'No API key configured' }, { status: 400 });
    }

    // Fetch models from provider API
    let rawModels: { modelId: string; name: string }[] = [];
    switch (provider.type) {
      case 'openai':
      case 'groq':
        rawModels = await fetchOpenAIModels(baseUrl, apiKey || '');
        break;
      case 'anthropic':
        rawModels = await fetchAnthropicModels();
        break;
      case 'ollama':
        rawModels = await fetchOllamaModels(baseUrl);
        break;
      default:
        try { rawModels = await fetchOpenAIModels(baseUrl, apiKey || ''); } catch { rawModels = []; }
    }

    // Filter useful models
    const models = rawModels.filter(m => isUsefulModel(m.modelId, provider.type));

    // Upsert models into DB
    let created = 0;
    let updated = 0;
    for (const m of models) {
      const meta = MODEL_METADATA[m.modelId] || {};
      const capabilities = meta.capabilities || ['chat'];
      const existing = await (prisma as any).model.findFirst({
        where: { providerId: provider.id, modelId: m.modelId },
      });
      if (existing) {
        await (prisma as any).model.update({
          where: { id: existing.id },
          data: { name: m.name, isAvailable: true, isDeprecated: false },
        });
        updated++;
      } else {
        await (prisma as any).model.create({
          data: {
            providerId: provider.id,
            modelId: m.modelId,
            name: m.name,
            capabilities: _toDb(capabilities),
            contextWindow: meta.contextWindow || 4096,
            inputCost: meta.inputCost || 0,
            outputCost: meta.outputCost || 0,
            isAvailable: true,
            // Inherit provider default — keeps new models restricted until explicitly opened
            allowedRoles: _toDb(defaultModelAccess),
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      synced: models.length,
      created,
      updated,
      models: models.map(m => m.modelId),
    });
  } catch (error: any) {
    console.error('Error syncing models:', error);
    return NextResponse.json(
      { error: 'Failed to sync models', details: error.message },
      { status: 500 }
    );
  }
}
