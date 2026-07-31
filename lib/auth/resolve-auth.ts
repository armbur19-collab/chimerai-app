// @chimerai component=ResolveAuth version=2.0
import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { verifyApiKey } from '@/lib/api-key-auth';

export interface AuthContext {
  userId: string;
  email: string;
  authMethod: 'session' | 'api-key';
  scopes?: string[];
}

/**
 * Dual-Auth: Checks NextAuth session first (browser), then API key (widget/external).
 * Returns AuthContext or throws an error with status.
 */
export async function resolveAuth(request: NextRequest): Promise<AuthContext> {
  // 1. Session-Auth (Browser-User)
  const session = await auth();
  if (session?.user?.id) {
    return {
      userId: session.user.id,
      email: session.user.email || '',
      authMethod: 'session',
    };
  }

  // 2. API-Key-Auth (Widget/External)
  const result = await verifyApiKey(request);
  if (result.valid && result.userId) {
    return {
      userId: result.userId,
      email: result.email || '',
      authMethod: 'api-key',
      scopes: result.scopes || [],
    };
  }

  // 3. No Auth — Error
  const error: any = new Error('Unauthorized');
  error.status = 401;
  throw error;
}
