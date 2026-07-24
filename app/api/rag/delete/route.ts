// @chimerai component=RagDeleteRoute version=1.0
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8002';

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const res = await fetch(`${AI_SERVICE_URL}/api/rag/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('RAG delete error:', error);
    return NextResponse.json({ error: 'Failed to delete documents' }, { status: 500 });
  }
}
