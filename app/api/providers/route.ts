// @chimerai component=ProviderCrudRoute version=1.0
/**
 * Provider CRUD API Route
 * GET  /api/providers — List all providers
 * POST /api/providers — Create new provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { notifyProviderChange } from '@/lib/notify-provider-change';
import { logAuditAction } from '@/lib/audit';

/** SQLite stores Json/String[] as plain String — serialize/deserialize at runtime */
const _isSqlite = (process.env.DATABASE_URL || '').startsWith('file:');
function _toDb(v: any): any { return _isSqlite && v != null && typeof v !== 'string' ? JSON.stringify(v) : v; }
function _fromDb(v: any): any { if (!_isSqlite || typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } }

/** Provider types that work without an API key (e.g. local services) */
const KEYLESS_PROVIDERS = ['ollama'];

function getDefaultBaseUrl(type: string): string | null {
  switch (type) {
    case 'openai':    return 'https://api.openai.com/v1';
    case 'anthropic': return 'https://api.anthropic.com/v1';
    case 'ollama':    return 'http://localhost:11434';
    case 'groq':      return 'https://api.groq.com/openai/v1';
    case 'google':    return 'https://generativelanguage.googleapis.com/v1beta';
    default:          return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check: providers:read OR admin:providers (graceful fallback when RBAC not installed)
    if (session.user.id) {
      try {
        const { requirePermission } = await import('@/lib/permissions');
        const canRead = await requirePermission(session.user.id, 'providers:read')
          || await requirePermission(session.user.id, 'admin:providers');
        if (!canRead) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
      } catch {
        // RBAC not installed — allow all authenticated users
      }
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    const providers = await prisma.provider.findMany({
      where: {
        ...(type && { type }),
        ...(status && { status }),
      },
      include: {
        models: {
          where: { isAvailable: true, isDeprecated: false },
          select: {
            id: true,
            modelId: true,
            name: true,
            capabilities: true,
            contextWindow: true,
            inputCost: true,
            outputCost: true,
          },
        },
        health: true,
      },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }, { name: 'asc' }],
    });

    // Don't expose encrypted API keys in list view
    // Deserialize JSON-string fields (SQLite stores Json/String[] as plain String)
    const sanitized = providers.map((p: any) => ({
      ...p,
      apiKey: p.apiKey ? '***encrypted***' : null,
      config: _fromDb(p.config),
      tags: _fromDb(p.tags),
      models: p.models?.map((m: any) => ({ ...m, capabilities: _fromDb(m.capabilities) })),
    }));

    return NextResponse.json(sanitized);
  } catch (error: any) {
    console.error('Error fetching providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check: providers:write
    if (session.user.id) {
      try {
        const { requirePermission } = await import('@/lib/permissions');
        const canWrite = await requirePermission(session.user.id, 'providers:write');
        if (!canWrite) {
          return NextResponse.json(
            { error: 'You do not have permission to create providers.' },
            { status: 403 }
          );
        }
      } catch {
        // RBAC not installed — allow write
      }
    }

    const body = await request.json();

    // Validate API key based on provider type
    const requiresKey = !KEYLESS_PROVIDERS.includes(body.type);
    if (requiresKey && !body.config?.apiKey) {
      return NextResponse.json(
        { error: 'API key is required for this provider type' },
        { status: 400 }
      );
    }

    // Key verschluesseln wenn vorhanden, sonst null (nicht leerer String!)
    const encryptedKey = body.config?.apiKey ? encrypt(body.config.apiKey) : null;

    // Resolve baseUrl
    const resolvedBaseUrl = body.config?.baseUrl || getDefaultBaseUrl(body.type);

    // If setting as default, unset other defaults of same type
    if (body.isDefault) {
      await prisma.provider.updateMany({
        where: { type: body.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await prisma.provider.create({
      data: {
        name: body.name,
        type: body.type,
        description: body.description,
        baseUrl: resolvedBaseUrl,
        apiKey: encryptedKey,
        config: _toDb({ ...body.config, apiKey: undefined }),
        status: 'active',
        isDefault: body.isDefault || false,
        priority: body.priority || 0,
        tags: _toDb(body.tags || []),
        createdBy: session.user.id,
      },
      include: { models: true, health: true },
    });

    // Notify AI service to invalidate cache
    notifyProviderChange().catch(() => {});

    // Audit log
    await logAuditAction({
      action: 'provider.create',
      userId: session.user.id,
      targetType: 'provider',
      targetId: provider.id,
      metadata: { name: provider.name, type: provider.type },
    });

    return NextResponse.json(
      { ...provider, apiKey: '***encrypted***' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating provider:', error);
    return NextResponse.json(
      { error: 'Failed to create provider', details: error.message },
      { status: 500 }
    );
  }
}
