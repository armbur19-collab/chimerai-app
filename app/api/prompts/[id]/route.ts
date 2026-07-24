// @chimerai component=PromptsIdRoute version=4.1
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parsePermissions } from '@/lib/permissions';

function parseTemplate(t: any) {
  return {
    ...t,
    variables: (() => { try { return JSON.parse(t.variables || '[]'); } catch { return []; } })(),
    tags: (() => { try { return JSON.parse(t.tags || '[]'); } catch { return []; } })(),
    allowedRoles: (() => { try { return JSON.parse(t.allowedRoles || '[]'); } catch { return []; } })(),
  };
}

function extractVariables(content: string): string[] {
  const matches = content.match(/{{(\w+)}}/g) || [];
  return [...new Set(matches.map((m: string) => m.replace(/{{|}}/g, '')))];
}

async function getUserRolesAndPermissions(userId: string) {
  try {
    const userRoles = await (prisma as any).userRole.findMany({
      where: { userId },
      include: { role: { select: { name: true, permissions: true } } },
    });
    return {
      roleNames: userRoles.map((ur: any) => ur.role.name),
      allPermissions: userRoles.flatMap((ur: any) => parsePermissions(ur.role.permissions)),
    };
  } catch {
    return { roleNames: [], allPermissions: [] };
  }
}

function hasPermission(allPermissions: string[], perm: string): boolean {
  return allPermissions.some(p =>
    p === perm || p === '*' || (p.endsWith(':*') && perm.startsWith(p.slice(0, -1)))
  );
}

async function canUserAccessPrompt(prompt: any, userId: string): Promise<boolean> {
  if (prompt.isDefault) return true;

  const { roleNames, allPermissions } = await getUserRolesAndPermissions(userId);
  const isAdmin = hasPermission(allPermissions, '*');

  if (isAdmin) return true;

  // RBAC users need at least prompts:read to see any prompt
  if (roleNames.length > 0 && !hasPermission(allPermissions, 'prompts:read')) return false;

  if (prompt.createdBy === userId) return true;
  if (prompt.visibility === 'public') return true;
  if (prompt.visibility === 'private') return false;
  if (prompt.visibility === 'restricted' || prompt.visibility === 'role_restricted') {
    const allowed: string[] = (() => { try { return JSON.parse(prompt.allowedRoles || '[]'); } catch { return []; } })();
    return allowed.some(r => roleNames.includes(r));
  }
  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const template = await prisma.promptTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }
    if (!(await canUserAccessPrompt(template, session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(parseTemplate(template));
  } catch (error: any) {
    console.error('Error fetching prompt:', error);
    return NextResponse.json({ error: 'Failed to fetch prompt' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prompt = await prisma.promptTemplate.findUnique({ where: { id } });
    if (!prompt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { roleNames, allPermissions } = await getUserRolesAndPermissions(session.user.id);
    const hasFreeAccess = roleNames.length === 0; // no RBAC roles → free tier
    const isAdmin = hasFreeAccess || hasPermission(allPermissions, '*');
    const hasWrite = hasPermission(allPermissions, 'prompts:write');
    const isOwner = prompt.createdBy === session.user.id;

    // Admin (or free tier) can edit anything; owner needs prompts:write to edit own prompts
    if (!isAdmin && !(hasWrite && isOwner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    // Owners: private/public only; admins: any visibility + allowedRoles
    const visibility = (() => {
      const v = body.visibility;
      if (!v) return prompt.visibility;
      if (!isAdmin) return ['private', 'public'].includes(v) ? v : prompt.visibility;
      return ['private', 'public', 'restricted'].includes(v) ? v : prompt.visibility;
    })();
    const allowedRoles = isAdmin && body.allowedRoles !== undefined
      ? JSON.stringify(Array.isArray(body.allowedRoles) ? body.allowedRoles : [])
      : prompt.allowedRoles;

    const template = await prisma.promptTemplate.update({
      where: { id },
      data: {
        name: body.name,
        category: body.category,
        description: body.description ?? null,
        content: body.content,
        variables: JSON.stringify(extractVariables(body.content || '')),
        language: body.language,
        tags: JSON.stringify(body.tags || []),
        version: { increment: 1 },
        visibility,
        allowedRoles,
      },
    });

    return NextResponse.json({ ...parseTemplate(template), visibility });
  } catch (error: any) {
    console.error('Error updating prompt:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prompt = await prisma.promptTemplate.findUnique({ where: { id } });
    if (!prompt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { roleNames, allPermissions } = await getUserRolesAndPermissions(session.user.id);
    const hasFreeAccess = roleNames.length === 0; // no RBAC roles → free tier
    const isAdmin = hasFreeAccess || hasPermission(allPermissions, '*');
    const hasWrite = hasPermission(allPermissions, 'prompts:write');
    const isOwner = prompt.createdBy === session.user.id;
    const canDelete = isAdmin || (hasWrite && isOwner);

    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.promptTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting prompt:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete prompt' }, { status: 500 });
  }
}
