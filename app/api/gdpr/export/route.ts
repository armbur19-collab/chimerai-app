// @chimerai component=GdprDataExportRoute version=1.0
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { exportUserData } from '@/lib/gdpr';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const exportData = await exportUserData(userId);

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="data-export-${userId}.json"`,
    },
  });
}
