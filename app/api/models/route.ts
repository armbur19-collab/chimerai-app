// @chimerai component=ModelsRoute version=2.0
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const TIER_ORDER: Record<string, number> = { FREE: 0, STANDARD: 1, PREMIUM: 2 };

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Resolve user's max model tier (requires RBAC — graceful fallback)
    let userMaxTier = 'PREMIUM'; // default: allow all when RBAC not installed

    if (session.user.id) {
      try {
        const { getUserMaxModelTier, requirePermission } = await import('@/lib/permissions');
        const canSelect = await requirePermission(session.user.id, 'models:select');
        if (!canSelect) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        userMaxTier = await getUserMaxModelTier(session.user.id);
      } catch {
        // RBAC not installed — allow all
      }
    }

    const maxTierValue = TIER_ORDER[userMaxTier] ?? 2;

    const models = await (prisma as any).model.findMany({
      where: {
        provider: {
          status: 'active',
        },
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            type: true,
            config: true,
          },
        },
      },
      orderBy: [
        { provider: { priority: 'asc' } },
        { name: 'asc' },
      ],
    });

    // Filter to chat-capable models only (exclude embedding-only models)
    const chatModels = models.filter((m: any) => {
      const caps = Array.isArray(m.capabilities)
        ? m.capabilities
        : (() => { try { return JSON.parse(m.capabilities || '[]'); } catch { return []; } })();
      return caps.includes('chat') || caps.includes('vision') || caps.length === 0;
    });

    // allowedRoles may be stored as a JSON string (SQLite) or native array (PG)
    const parseAR = (raw: any): string[] => {
      if (Array.isArray(raw)) return raw;
      try { return JSON.parse(raw || '[]'); } catch { return []; }
    };

    // Role-based allowedRoles filtering (whitelist mode).
    // Graceful: skips entirely when RBAC is not installed.
    let visibleModels = chatModels;
    try {
      const userRoles = session.user.id
        ? await (prisma as any).userRole.findMany({
            where: { userId: session.user.id },
            include: { role: { select: { name: true } } },
          })
        : [];
      const userRoleNames = userRoles.map((ur: any) => ur.role.name);

      // No roles → free tier / no RBAC: see all open models.
      // Has roles → see only models explicitly assigned to those roles (union).
      const roleFiltered = userRoleNames.length === 0
        ? chatModels
        : chatModels.filter((m: any) => {
            const ar = parseAR(m.allowedRoles);
            return userRoleNames.some((r: string) => ar.includes(r));
          });

      // Per-user ModelAccess explicit overrides (allow/deny beat role rules)
      const userModelAccess = await (prisma as any).modelAccess.findMany({
        where: { userId: session.user.id },
      });
      const explicitAllow = new Set(
        userModelAccess.filter((a: any) => a.granted).map((a: any) => a.modelId)
      );
      const explicitDeny = new Set(
        userModelAccess.filter((a: any) => !a.granted).map((a: any) => a.modelId)
      );

      visibleModels = roleFiltered.filter((m: any) => {
        if (explicitDeny.has(m.id)) return false;
        if (explicitAllow.has(m.id)) return true;
        return true;
      });
    } catch (e) {
      console.error('[models] role filter error:', e);
      // RBAC or ModelAccess not installed — show all models
    }

    // Apply tier filter (model.tier field — graceful fallback if field doesn't exist)
    const tierFiltered = maxTierValue >= 2
      ? visibleModels
      : visibleModels.filter((m: any) => {
          const modelTier = m.tier ?? 'STANDARD';
          return (TIER_ORDER[modelTier] ?? 1) <= maxTierValue;
        });

    const result = tierFiltered.map((m: any) => {
      const providerConfig = typeof m.provider.config === 'string'
        ? (() => { try { return JSON.parse(m.provider.config); } catch { return {}; } })()
        : (m.provider.config || {});
      const isProviderDefault = !!providerConfig.defaultModel && providerConfig.defaultModel === m.modelId;
      return {
        id: m.id,
        modelId: m.modelId,
        name: m.name,
        providerId: m.providerId,
        providerType: m.provider.type,
        tier: m.tier ?? 'STANDARD',
        contextWindow: m.contextWindow || 0,
        inputCost: m.inputCost || 0,
        outputCost: m.outputCost || 0,
        capabilities: m.capabilities || [],
        provider: m.provider,
        isProviderDefault,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}
