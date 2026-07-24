// @chimerai component=ApiKeysRoute version=1.0
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashApiKey } from '@/lib/api-key-auth';
import crypto from 'crypto';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys = await (prisma as any).apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyHash: true,
      scopes: true,
      revoked: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  // Only return prefix (first 12 chars of hash)
  // Parse scopes from DB string to array for frontend
  const safeKeys = keys.map((k: any) => ({
    ...k,
    scopes: typeof k.scopes === 'string' ? (k.scopes ? k.scopes.split(',') : []) : (k.scopes || []),
    prefix: 'sk_...' + k.keyHash.slice(0, 8),
    keyHash: undefined,
  }));

  return NextResponse.json({ keys: safeKeys });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, scopes = [], expiresInDays } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Validate that requested scopes are a subset of the user's own permissions
  if (scopes.length > 0) {
    try {
      const { getUserPermissions } = await import('@/lib/permissions');
      const userPerms = await getUserPermissions(session.user.id);
      if (!userPerms.includes('*')) {
        const requestedScopes: string[] = Array.isArray(scopes) ? scopes : [scopes];
        const forbidden = requestedScopes.filter((s: string) => !userPerms.includes(s));
        if (forbidden.length > 0) {
          return NextResponse.json(
            { error: `You cannot grant scopes you do not have: ${forbidden.join(', ')}` },
            { status: 403 }
          );
        }
      }
    } catch {
      // RBAC not installed — allow any scopes
    }
  }

  // Generate API key
  const rawKey = 'sk_live_' + crypto.randomBytes(24).toString('hex');
  const keyHash = hashApiKey(rawKey);

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await (prisma as any).apiKey.create({
    data: {
      name,
      keyHash,
      userId: session.user.id,
      // SQLite stores scopes as comma-separated String; PostgreSQL as String[]
      // Detect DB type from DATABASE_URL to pick the right format
      scopes: process.env.DATABASE_URL?.startsWith('file:')
        ? (Array.isArray(scopes) ? scopes.join(',') : (scopes || ''))
        : (Array.isArray(scopes) ? scopes : [scopes || '']),
      expiresAt,
    },
  });

  // Return the full key ONCE — it's never stored/shown again
  return NextResponse.json({ key: rawKey, message: 'Key created. Copy it now — it will not be shown again.' });
}
