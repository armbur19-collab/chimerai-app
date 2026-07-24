// @chimerai component=RagQueryRoute version=1.2
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8002';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check: rag:use
    try {
      const { requirePermission } = await import('@/lib/permissions');
      const canQuery = await requirePermission(session.user.id, 'rag:use');
      if (!canQuery) {
        return NextResponse.json(
          { error: 'You do not have permission to query documents.' },
          { status: 403 }
        );
      }
    } catch {
      // RBAC not installed — allow query
    }

    const body = await request.json();

    // Load default RAG prompt template if one exists
    let system_prompt: string | undefined;
    try {
      const tmpl = body.promptId
        ? await (prisma as any).promptTemplate.findFirst({ where: { id: body.promptId, isActive: true } })
        : await (prisma as any).promptTemplate.findFirst({ where: { category: 'rag', isDefault: true, isActive: true } });
      if (tmpl) system_prompt = tmpl.content;
    } catch { /* promptTemplate table may not exist — continue without */ }

    const res = await fetch(`${AI_SERVICE_URL}/api/rag/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        user_id: session.user.id,
        ...(system_prompt ? { system_prompt } : {}),
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('RAG query error:', error);
    return NextResponse.json({ error: 'Failed to query documents' }, { status: 500 });
  }
}
