// @chimerai component=ApiProtectionLib version=1.0
/**
 * API Protection & Authorization Utilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from './auth';
import { prisma } from './prisma';

export interface AuthResult {
  authorized: boolean;
  user?: { id: string; email: string };
  error?: { code: string; message: string; statusCode: number };
}

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authorized: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
      },
    };
  }

  return {
    authorized: true,
    user: {
      id: session.user.id as string,
      email: session.user.email as string,
    },
  };
}

export async function requireModelPermission(
  request: NextRequest,
  modelId: string  // Model.id (cuid) or Model.modelId ("gpt-4") — both accepted
): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authorized: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 },
    };
  }

  try {
    // Support both internal cuid and provider model id (e.g. "gpt-4")
    const model = await prisma.model.findFirst({
      where: { OR: [{ id: modelId }, { modelId: modelId }] },
      select: { id: true, allowedRoles: true },
    });

    if (!model) {
      return {
        authorized: false,
        error: { code: 'NOT_FOUND', message: `Model '${modelId}' not found`, statusCode: 404 },
      };
    }

    // allowedRoles is stored as a JSON string ("[]" or '["role1"]') — parse before use
    const allowedRoles: string[] = (() => {
      const raw = (model as any).allowedRoles;
      if (Array.isArray(raw)) return raw;
      try { return JSON.parse(raw || '[]'); } catch { return []; }
    })();

    if (allowedRoles.length > 0) {
      const userRoles = await prisma.userRole.findMany({
        where: { userId: session.user.id },
        include: { role: { select: { name: true } } },
      });
      const roleNames = userRoles.map(ur => ur.role.name);
      const hasRole = allowedRoles.some(r => roleNames.includes(r));

      if (!hasRole) {
        return {
          authorized: false,
          error: {
            code: 'FORBIDDEN',
            message: `Your role does not have access to model '${modelId}'`,
            statusCode: 403,
          },
        };
      }
    }

    return { authorized: true, user: { id: session.user.id as string, email: session.user.email as string } };

  } catch (error) {
    // Fail-open: DB error must not lock out all users
    console.error('[requireModelPermission] DB error:', error);
    return { authorized: true, user: { id: session.user.id as string, email: session.user.email as string } };
  }
}

export async function requireCredits(
  request: NextRequest,
  estimatedTokens: number
): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authorized: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
      },
    };
  }

  try {
    const user = await (prisma as any).user.findUnique({
      where: { id: session.user.id },
      select: { credits: true },
    });

    const requiredCredits = Math.ceil(estimatedTokens / 100);

    if (!user || user.credits < requiredCredits) {
      return {
        authorized: false,
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: 'Insufficient credits for this operation',
          statusCode: 402,
        },
      };
    }
  } catch (error) {
    console.error('Credits check error:', error);
  }

  return {
    authorized: true,
    user: {
      id: session.user.id as string,
      email: session.user.email as string,
    },
  };
}

export function createErrorResponse(authResult: AuthResult) {
  return NextResponse.json(
    {
      error: {
        code: authResult.error?.code || 'ERROR',
        message: authResult.error?.message || 'Unknown error',
      },
    },
    { status: authResult.error?.statusCode || 500 }
  );
}

export async function trackApiUsage(
  userId: string,
  endpoint: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  success: boolean,
  errorMessage?: string
) {
  try {
    await (prisma as any).apiUsageLog.create({
      data: {
        userId,
        endpoint,
        model,
        inputTokens,
        outputTokens,
        success,
        errorMessage,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to track API usage:', error);
  }
}
