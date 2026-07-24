// @chimerai component=PromptsRoute version=5.1
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parsePermissions } from '@/lib/permissions';

/** Parse JSON string fields (variables, tags, allowedRoles) stored as JSON strings */
function parseTemplate(t: any) {
  return {
    ...t,
    variables: (() => { try { return JSON.parse(t.variables || '[]'); } catch { return []; } })(),
    tags: (() => { try { return JSON.parse(t.tags || '[]'); } catch { return []; } })(),
    allowedRoles: (() => { try { return JSON.parse(t.allowedRoles || '[]'); } catch { return []; } })(),
  };
}

const parseAR = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch { return []; }
};

/** Auto-extract {{variable}} names from template content */
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const { roleNames, allPermissions } = await getUserRolesAndPermissions(session.user.id);
    const hasFreeAccess = roleNames.length === 0; // no RBAC roles → free tier
    const isAdmin = hasFreeAccess || hasPermission(allPermissions, '*');
    const hasWrite = hasPermission(allPermissions, 'prompts:write');
    const hasRead = hasPermission(allPermissions, 'prompts:read');

    // Load explicit per-user PromptAccess grants
    let userPromptAccess: any[] = [];
    try {
      userPromptAccess = await (prisma as any).promptAccess.findMany({ where: { userId: session.user.id } });
    } catch { /* PromptAccess not installed */ }
    const explicitAllow = new Set(userPromptAccess.filter((a: any) => a.granted).map((a: any) => a.templateId));
    const explicitDeny  = new Set(userPromptAccess.filter((a: any) => !a.granted).map((a: any) => a.templateId));

    // Fetch all prompts — admins see inactive too
    const allPrompts = await (prisma as any).promptTemplate.findMany({
      where: isAdmin ? {} : { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    const withCanEdit = (prompts: any[]) =>
      applySearchFilter(prompts, category, search).map((p: any) => ({
        ...parseTemplate(p),
        canEdit: isAdmin || (hasWrite && p.createdBy === session.user.id),
      }));

    // Admins see everything
    if (isAdmin) {
      return NextResponse.json(withCanEdit(allPrompts));
    }

    // RBAC users without prompts:read see nothing
    if (!hasFreeAccess && !hasRead) {
      return NextResponse.json([]);
    }

    const visible = allPrompts.filter((p: any) => {
      if (explicitDeny.has(p.id)) return false;
      if (explicitAllow.has(p.id)) return true;
      if (p.createdBy === session.user.id) return true;
      if (p.visibility === 'private') return false;
      if (p.visibility === 'restricted' || p.visibility === 'role_restricted') {
        return roleNames.some((r: string) => parseAR(p.allowedRoles).includes(r));
      }
      return true; // public
    });

    return NextResponse.json(withCanEdit(visible));
  } catch (error: any) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 });
  }
}

function applySearchFilter(prompts: any[], category: string | null, search: string | null): any[] {
  return prompts.filter(p => {
    if (category && category !== 'all' && p.category !== category) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!p.name?.toLowerCase().includes(s) && !p.description?.toLowerCase().includes(s)) return false;
    }
    return true;
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roleNames, allPermissions } = await getUserRolesAndPermissions(session.user.id);
    const hasFreeAccess = roleNames.length === 0; // no RBAC roles → free tier
    if (!hasFreeAccess && !hasPermission(allPermissions, 'prompts:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const isAdmin = hasFreeAccess || allPermissions.includes('*');
    const visibility = (() => {
      const v = body.visibility;
      if (v === 'restricted' && !isAdmin) return 'private';
      return ['private', 'public', 'restricted'].includes(v) ? v : 'private';
    })();

    const template = await (prisma as any).promptTemplate.create({
      data: {
        name: body.name,
        category: body.category,
        description: body.description || null,
        content: body.content,
        variables: JSON.stringify(extractVariables(body.content || '')),
        language: body.language || 'en',
        tags: JSON.stringify(body.tags || []),
        createdBy: session.user.id,
        visibility,
        allowedRoles: JSON.stringify(body.allowedRoles ?? []),
      },
    });

    return NextResponse.json({ ...parseTemplate(template), visibility }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating prompt:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A prompt with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 });
  }
}
