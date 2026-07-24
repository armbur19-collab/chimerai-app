// @chimerai component=InternalProvidersRoute version=1.0
/**
 * Internal Provider API — List all active providers
 * GET /api/internal/providers
 *
 * Used by the Python AI Service to fetch provider configs + decrypted API keys.
 * Protected by INTERNAL_API_TOKEN (Bearer token).
 *
 * WARNING: Returns DECRYPTED API keys — never expose externally!
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

  if (!expected || expected.length < 32) {
    console.error('INTERNAL_API_TOKEN is not configured or too short');
    return false;
  }

  return token === expected;
}

export async function GET(request: NextRequest) {
  if (!validateInternalToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status') || 'active';

    const providers = await prisma.provider.findMany({
      where: {
        ...(status && { status }),
        ...(type && { type }),
      },
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
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
    });

    const result = providers.map((p: any) => {
      let apiKey: string | null = null;
      try {
        if (p.apiKey) apiKey = decrypt(p.apiKey);
      } catch {
        console.warn(`Failed to decrypt API key for provider ${p.id}`);
      }

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        base_url: p.baseUrl,
        api_key: apiKey,
        config: _fromDb(p.config),
        status: p.status,
        is_default: p.isDefault,
        priority: p.priority,
        models: p.models.map((m: any) => ({
          id: m.id,
          model_id: m.modelId,
          name: m.name,
          capabilities: _fromDb(m.capabilities),
          context_window: m.contextWindow,
          input_cost: m.inputCost,
          output_cost: m.outputCost,
        })),
      };
    });

    return NextResponse.json({ providers: result });
  } catch (error: any) {
    console.error('Error fetching internal providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers', details: error.message },
      { status: 500 }
    );
  }
}
