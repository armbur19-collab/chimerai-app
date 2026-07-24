// @chimerai component=InternalProviderUsageRoute version=1.0
/**
 * Internal Provider API — Report usage / token consumption
 * POST /api/internal/providers/[id]/usage
 *
 * Called by the Python AI Service after each AI call to track
 * token usage, costs, and credits in the central ApiUsage table.
 * Protected by INTERNAL_API_TOKEN (Bearer token).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function validateInternalToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected || expected.length < 32) return false;
  return token === expected;
}

interface UsagePayload {
  user_id: string;
  model: string;
  endpoint: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
  cost?: number;
  success?: boolean;
  error_message?: string;
  response_time?: number;
}

const TOKENS_PER_CREDIT = 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validateInternalToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: UsagePayload = await request.json();

    if (!body.user_id || !body.model || !body.endpoint) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, model, endpoint' },
        { status: 400 }
      );
    }

    const providerId = id;
    const totalTokens = body.total_tokens ?? (body.prompt_tokens + body.completion_tokens);
    const creditsUsed = Math.ceil(totalTokens / TOKENS_PER_CREDIT);

    // If cost not provided, try to compute from model pricing
    let cost = body.cost ?? 0;
    if (!body.cost && totalTokens > 0) {
      try {
        const model = await prisma.model.findFirst({
          where: { providerId, modelId: body.model },
        });
        if (model) {
          cost =
            (body.prompt_tokens * model.inputCost) / 1_000_000 +
            (body.completion_tokens * model.outputCost) / 1_000_000;
        }
      } catch {
        // Pricing lookup failed — use 0
      }
    }

    const usage = await prisma.apiUsage.create({
      data: {
        userId: body.user_id,
        providerId,
        model: body.model,
        endpoint: body.endpoint,
        promptTokens: body.prompt_tokens,
        completionTokens: body.completion_tokens,
        totalTokens,
        tokensUsed: totalTokens,
        creditsUsed,
        cost,
        success: body.success ?? true,
        errorMessage: body.error_message || null,
        responseTime: body.response_time || 0,
      },
    });

    return NextResponse.json({
      success: true,
      usage_id: usage.id,
      credits_used: creditsUsed,
      cost,
    });
  } catch (error: any) {
    console.error('Error reporting usage:', error);
    return NextResponse.json(
      { error: 'Failed to report usage', details: error.message },
      { status: 500 }
    );
  }
}
