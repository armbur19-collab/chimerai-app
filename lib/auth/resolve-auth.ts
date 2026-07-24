// @chimerai component=ResolveAuth version=1.0-no-auth
// No-Auth mode: returns a local dev user without session checks.
import { NextRequest } from 'next/server';

export interface AuthContext {
  userId: string;
  email: string;
  authMethod: 'session' | 'api-key';
  scopes?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resolveAuth(_request: NextRequest): Promise<AuthContext> {
  return {
    userId: 'local-dev',
    email: 'local@localhost',
    authMethod: 'session',
  };
}
