// @chimerai component=V1ModelsRoute version=1.0
import { NextRequest, NextResponse } from 'next/server';
import { resolveAuth } from '@/lib/auth/resolve-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await resolveAuth(request);
    } catch (error: any) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: error.status || 401 });
    }

    // API-Key scope check: requires 'chat' or '*' scope
    if (auth.authMethod === 'api-key' && auth.scopes) {
      const hasChat = auth.scopes.includes('chat') || auth.scopes.includes('*') || auth.scopes.length === 0;
      if (!hasChat) {
        return NextResponse.json({ error: 'Insufficient scope. Required: chat' }, { status: 403 });
      }
    }

    const models = await (prisma as any).model.findMany({
      where: {
        provider: {
          status: 'active',
        },
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [
        { provider: { priority: 'asc' } },
        { name: 'asc' },
      ],
    });

    const result = models.map((m: any) => ({
      id: m.id,
      modelId: m.modelId,
      name: m.name,
      providerId: m.providerId,
      providerType: m.provider.type,
      contextWindow: m.contextWindow || 0,
      inputCost: m.inputCost || 0,
      outputCost: m.outputCost || 0,
      capabilities: m.capabilities || [],
      provider: m.provider,
    }));

    // Filter to chat-capable models only (exclude embedding-only models)
    const chatModels = result.filter((m: any) => {
      const caps = Array.isArray(m.capabilities)
        ? m.capabilities
        : (() => { try { return JSON.parse(m.capabilities || '[]'); } catch { return []; } })();
      return caps.includes('chat') || caps.includes('vision') || caps.length === 0;
    });

    return NextResponse.json(chatModels);
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}
