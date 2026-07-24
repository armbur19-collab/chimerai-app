// @chimerai component=InternalProviderIdRoute version=1.0
/**
 * Internal Provider API — Get single provider by ID
 * GET /api/internal/providers/[id]
 *
 * Returns full provider details with DECRYPTED API key.
 * Protected by INTERNAL_API_TOKEN (Bearer token).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

/** SQLite stores Json/String[] as plain String — deserialize at runtime */
const _isSqlite = (process.env.DATABASE_URL || '').startsWith('file:');
function _fromDb(v: any): any { if (!_isSqlite || typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } }

function validateInternalToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected || expected.length < 32) return false;
  return token === expected;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validateInternalToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const provider = await prisma.provider.findUnique({
      where: { id: id },
      include: {
        models: {
          where: { isAvailable: true, isDeprecated: false },
          select: {
            id: true, modelId: true, name: true,
            capabilities: true, contextWindow: true,
            inputCost: true, outputCost: true,
          },
        },
      },
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    let apiKey: string | null = null;
    try {
      if (provider.apiKey) apiKey = decrypt(provider.apiKey);
    } catch {
      console.warn(`Failed to decrypt API key for provider ${provider.id}`);
    }

    return NextResponse.json({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      base_url: provider.baseUrl,
      api_key: apiKey,
      config: _fromDb(provider.config),
      status: provider.status,
      is_default: provider.isDefault,
      priority: provider.priority,
      models: provider.models.map((m: any) => ({
        id: m.id,
        model_id: m.modelId,
        name: m.name,
        capabilities: _fromDb(m.capabilities),
        context_window: m.contextWindow,
        input_cost: m.inputCost,
        output_cost: m.outputCost,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching internal provider:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider', details: error.message },
      { status: 500 }
    );
  }
}
