// @chimerai component=RagClearRoute version=1.0
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8002';

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch(`${AI_SERVICE_URL}/api/rag/clear`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('RAG clear error:', error);
    return NextResponse.json({ error: 'Failed to clear documents' }, { status: 500 });
  }
}
