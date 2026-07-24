// @chimerai component=GdprAccountDeleteRoute version=1.1
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteUserData } from '@/lib/gdpr';

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await deleteUserData(session.user.id);

  return NextResponse.json({ success: true, message: 'Account deleted successfully' });
}
