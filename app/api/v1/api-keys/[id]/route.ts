// @chimerai component=ApiKeyIdRoute version=1.0
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = await (prisma as any).apiKey.findUnique({
    where: { id: id },
  });

  if (!key || key.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await (prisma as any).apiKey.update({
    where: { id: id },
    data: { revoked: true },
  });

  return NextResponse.json({ message: 'Key revoked' });
}
