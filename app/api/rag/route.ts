// @chimerai component=RagUploadRoute version=1.0
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8002';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check: rag:upload
    try {
      const { requirePermission } = await import('@/lib/permissions');
      const canUpload = await requirePermission(session.user.id, 'rag:upload');
      if (!canUpload) {
        return NextResponse.json(
          { error: 'You do not have permission to upload documents.' },
          { status: 403 }
        );
      }
    } catch {
      // RBAC not installed — allow upload
    }

    const contentType = request.headers.get('content-type') || '';

    let res: Response;

    if (contentType.includes('multipart/form-data')) {
      // Forward multipart file upload to /api/rag/upload
      const formData = await request.formData();
      const body = new FormData();
      for (const [key, value] of formData.entries()) {
        if (value instanceof Blob) {
          body.append('files', value, (value as File).name);
        }
      }
      res = await fetch(`${AI_SERVICE_URL}/api/rag/upload`, {
        method: 'POST',
        body,
      });
    } else {
      // JSON fallback for programmatic use
      const body = await request.json();
      res = await fetch(`${AI_SERVICE_URL}/api/rag/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('RAG upload error:', error);
    return NextResponse.json({ error: 'Failed to process documents' }, { status: 500 });
  }
}
