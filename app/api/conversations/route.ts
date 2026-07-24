// @chimerai component=ConversationsRoute version=1.0
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createErrorResponse } from '@/lib/api-protection';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);

  if (!authResult.authorized || !authResult.user) {
    return createErrorResponse(authResult);
  }

  try {
    const { searchParams } = new URL(request.url);
    const archived = searchParams.get('archived') === 'true';

    const conversations = await (prisma as any).conversation.findMany({
      where: {
        userId: authResult.user.id,
        archived,
      },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);

  if (!authResult.authorized || !authResult.user) {
    return createErrorResponse(authResult);
  }

  try {
    const body = await request.json();
    const { title, model, metadata } = body;

    const conversation = await (prisma as any).conversation.create({
      data: {
        userId: authResult.user.id,
        title: title || 'New Chat',
        model,
        metadata,
      },
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
