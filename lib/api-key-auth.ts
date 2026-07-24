// @chimerai component=ApiKeyAuthLib version=1.1
/**
 * API Key Authentication Middleware for ChimerAI
 */

import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { createHash } from 'crypto';

export interface ApiKeyResult {
  valid: boolean;
  userId?: string;
  email?: string;
  error?: string;
  keyName?: string;
  scopes?: string[];
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export function generateApiKey(): string {
  const randomBytes = createHash('sha256')
    .update(Math.random().toString() + Date.now().toString())
    .digest('hex')
    .slice(0, 32);

  return `sk_live_${randomBytes}`;
}

/**
 * Checks if the given scopes include the required scope.
 * Supports wildcards: ['*'] matches everything, ['chat:*'] matches 'chat:send'.
 * Empty scopes array = unrestricted (backward-compatible).
 */
export function hasScope(scopes: string[], required: string): boolean {
  if (scopes.length === 0) return true;       // No scope = everything allowed
  if (scopes.includes('*')) return true;       // Super-wildcard
  if (scopes.includes(required)) return true;  // Exact match

  // Category wildcard: 'chat:*' matches 'chat:send'
  const requiredParts = required.split(':');
  for (const scope of scopes) {
    if (scope.endsWith(':*')) {
      const prefix = scope.slice(0, -1);
      if (required.startsWith(prefix)) return true;
    }
  }

  return false;
}

export async function verifyApiKey(request: NextRequest): Promise<ApiKeyResult> {
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  let apiKey: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7);
  } else if (apiKeyHeader) {
    apiKey = apiKeyHeader;
  }

  if (!apiKey) {
    return {
      valid: false,
      error: 'No API key provided',
    };
  }

  if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
    return {
      valid: false,
      error: 'Invalid API key format',
    };
  }

  try {
    const keyHash = hashApiKey(apiKey);
    const dbKey = await (prisma as any).apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!dbKey) {
      return {
        valid: false,
        error: 'Invalid API key',
      };
    }

    if (dbKey.revoked) {
      return {
        valid: false,
        error: 'API key has been revoked',
      };
    }

    // Check expiry
    if (dbKey.expiresAt && new Date(dbKey.expiresAt) < new Date()) {
      return {
        valid: false,
        error: 'API key has expired',
      };
    }

    // Update last used timestamp
    await (prisma as any).apiKey.update({
      where: { keyHash },
      data: { lastUsedAt: new Date() },
    });

    // Parse scopes: stored as comma-separated string in SQLite
    const rawScopes = dbKey.scopes || '';
    const scopeList = typeof rawScopes === 'string'
      ? (rawScopes ? rawScopes.split(',').map((s: string) => s.trim()) : [])
      : rawScopes;

    return {
      valid: true,
      userId: dbKey.user.id,
      email: dbKey.user.email || '',
      keyName: dbKey.name,
      scopes: scopeList,
    };
  } catch (error) {
    console.error('API key verification error:', error);
    return {
      valid: false,
      error: 'API key verification failed',
    };
  }
}
