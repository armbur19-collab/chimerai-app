// @chimerai component=PromptsAccessRoute version=1.2
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parsePermissions } from '@/lib/permissions';

async function isAdmin(userId: string): Promise<boolean> {
  try {
    const userRoles = await (prisma as any).userRole.findMany({
      where: { userId },
      include: { role: { select: { permissions: true } } },
    });
    if (userRoles.length === 0) return true; // no RBAC roles → free tier, all checks pass
    return userRoles.some((ur: any) => parsePermissions(ur.role.permissions).includes('*'));
  } catch {
    return true; // RBAC not installed → free tier, all checks pass
  }
}

/** GET /api/prompts/[id]/access — list all per-user overrides for this template (admin only) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const entries = await (prisma as any).promptAccess.findMany({
    where: { templateId: id },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(entries.map((e: any) => ({
    userId: e.userId,
    email: e.user.email,
    name: e.user.name,
    granted: e.granted,
  })));
}

/** POST /api/prompts/[id]/access — add/update override by email (admin only) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, granted } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await (prisma as any).promptAccess.upsert({
    where: { userId_templateId: { userId: user.id, templateId: id } },
    create: { templateId: id, userId: user.id, granted: granted !== false },
    update: { granted: granted !== false },
  });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/prompts/[id]/access — remove override by userId (admin only) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  await (prisma as any).promptAccess.deleteMany({ where: { templateId: id, userId } });
  return NextResponse.json({ ok: true });
}
