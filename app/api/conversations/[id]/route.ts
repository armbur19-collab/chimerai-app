// @chimerai component=ConversationDetailRoute version=1.0
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createErrorResponse } from '@/lib/api-protection';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuth(request);
  if (!authResult.authorized || !authResult.user) {
    return createErrorResponse(authResult);
  }

  try {
    const conversation = await (prisma as any).conversation.findUnique({
      where: { id: id, userId: authResult.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Failed to fetch conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuth(request);
  if (!authResult.authorized || !authResult.user) {
    return createErrorResponse(authResult);
  }

  try {
    const body = await request.json();

    // Verify ownership
    const existing = await (prisma as any).conversation.findUnique({
      where: { id: id },
    });
    if (!existing || existing.userId !== authResult.user.id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const updated = await (prisma as any).conversation.update({
      where: { id: id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.archived !== undefined && { archived: body.archived }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuth(request);
  if (!authResult.authorized || !authResult.user) {
    return createErrorResponse(authResult);
  }

  try {
    // Verify ownership
    const existing = await (prisma as any).conversation.findUnique({
      where: { id: id },
    });
    if (!existing || existing.userId !== authResult.user.id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    await (prisma as any).conversation.delete({
      where: { id: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
