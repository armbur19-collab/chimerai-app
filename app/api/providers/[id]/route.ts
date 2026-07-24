// @chimerai component=ProviderIdRoute version=1.0
/**
 * Single Provider API Route
 * GET    /api/providers/[id] — Get provider details
 * PUT    /api/providers/[id] — Full update
 * PATCH  /api/providers/[id] — Partial update
 * DELETE /api/providers/[id] — Delete provider
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

export async function GET(
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
      include: {
        models: { orderBy: { name: 'asc' } },
        health: true,
      },
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...provider,
      apiKey: provider.apiKey ? provider.apiKey.substring(0, 8) + '...' : null,
      config: _fromDb(provider.config),
      tags: _fromDb(provider.tags),
      models: provider.models?.map((m: any) => ({ ...m, capabilities: _fromDb(m.capabilities) })),
    });
  } catch (error: any) {
    console.error('Error fetching provider:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // If setting as default, unset other defaults
    if (body.isDefault) {
      const existing = await prisma.provider.findUnique({ where: { id: id } });
      if (existing) {
        await prisma.provider.updateMany({
          where: { type: existing.type, isDefault: true, NOT: { id: id } },
          data: { isDefault: false },
        });
      }
    }

    // Handle API key update
    const updateData: any = { ...body };
    // Extract baseUrl from config if provided (frontend sends config.baseUrl, not top-level baseUrl)
    if (body.config?.baseUrl !== undefined) {
      updateData.baseUrl = body.config.baseUrl || getDefaultBaseUrl(body.type || '');
    } else if ('baseUrl' in body) {
      updateData.baseUrl = body.baseUrl;
    }
    if (body.config?.apiKey) {
      updateData.apiKey = encrypt(body.config.apiKey);
      updateData.config = _toDb({ ...body.config, apiKey: undefined });
    } else if (body.config) {
      updateData.config = _toDb({ ...body.config, apiKey: undefined });
    }
    if ('tags' in body) updateData.tags = _toDb(body.tags);

    const provider = await prisma.provider.update({
      where: { id: id },
      data: updateData,
      include: { models: true, health: true },
    });

    notifyProviderChange().catch(() => {});

    // Audit log
    await logAuditAction({
      action: 'provider.update',
      userId: session.user.id,
      targetType: 'provider',
      targetId: id,
      metadata: { name: provider.name, type: provider.type },
    });

    return NextResponse.json({ ...provider, apiKey: '***encrypted***' });
  } catch (error: any) {
    console.error('Error updating provider:', error);
    return NextResponse.json(
      { error: 'Failed to update provider', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updateData: any = {};

    // Handle simple field updates
    if ('status' in body) updateData.status = body.status;
    if ('isDefault' in body) updateData.isDefault = body.isDefault;
    if ('priority' in body) updateData.priority = body.priority;
    if ('tags' in body) updateData.tags = _toDb(body.tags);
    if ('name' in body) updateData.name = body.name;
    if ('type' in body) updateData.type = body.type;
    if ('description' in body) updateData.description = body.description;

    // Handle baseUrl
    if ('baseUrl' in body) {
      updateData.baseUrl = body.baseUrl;
    } else if (body.config?.baseUrl !== undefined) {
      updateData.baseUrl = body.config.baseUrl || getDefaultBaseUrl(body.type || '');
    }

    // Handle API key update (encrypted)
    if (body.config?.apiKey) {
      updateData.apiKey = encrypt(body.config.apiKey);
    }

    if (body.config) {
      updateData.config = _toDb({ ...body.config, apiKey: undefined });
    }

    // If setting as default, unset other defaults
    if (body.isDefault) {
      const existing = await prisma.provider.findUnique({ where: { id: id } });
      if (existing) {
        await prisma.provider.updateMany({
          where: { type: existing.type, isDefault: true, NOT: { id: id } },
          data: { isDefault: false },
        });
      }
    }

    const provider = await prisma.provider.update({
      where: { id: id },
      data: updateData,
      include: { models: true, health: true },
    });

    notifyProviderChange().catch(() => {});

    // Audit log
    await logAuditAction({
      action: 'provider.update',
      userId: session.user.id,
      targetType: 'provider',
      targetId: id,
      metadata: { name: provider.name, type: provider.type },
    });

    return NextResponse.json({
      ...provider,
      apiKey: provider.apiKey ? '***encrypted***' : null,
    });
  } catch (error: any) {
    console.error('Error patching provider:', error);
    return NextResponse.json(
      { error: 'Failed to update provider', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.provider.delete({ where: { id: id } });
    notifyProviderChange().catch(() => {});

    // Audit log
    await logAuditAction({
      action: 'provider.delete',
      userId: session.user.id,
      targetType: 'provider',
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting provider:', error);
    return NextResponse.json(
      { error: 'Failed to delete provider', details: error.message },
      { status: 500 }
    );
  }
}
