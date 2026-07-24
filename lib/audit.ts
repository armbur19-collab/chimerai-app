// @chimerai component=AuditLogHelper version=1.2
import { prisma } from './prisma';

export interface AuditActionParams {
  action: string;
  userId: string;
  actorEmail?: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit action. Fire-and-forget — errors are caught and logged.
 */
export async function logAuditAction(params: AuditActionParams): Promise<void> {
  try {
    if (!(prisma as any).auditLog) return; // AuditLog model not in schema (requires admin-dashboard)

    // Verify userId exists to avoid FK constraint violations
    let safeUserId: string | null = null;
    if (params.userId) {
      const userExists = await prisma.user.findUnique({ where: { id: params.userId }, select: { id: true } });
      safeUserId = userExists?.id ?? null;
    }

    const metadataPayload: Record<string, any> = {};
    if (params.targetId) metadataPayload.targetId = params.targetId;
    if (params.targetType) metadataPayload.targetType = params.targetType;
    if (params.metadata) Object.assign(metadataPayload, params.metadata);
    if (params.actorEmail) metadataPayload.actorEmail = params.actorEmail;
    if (params.actorName) metadataPayload.actorName = params.actorName;
    if (!safeUserId && params.userId) metadataPayload.actorId = params.userId;

    await (prisma as any).auditLog.create({
      data: {
        action: params.action,
        userId: safeUserId,
        targetType: params.targetType || null,
        targetId: params.targetId || null,
        metadata: Object.keys(metadataPayload).length > 0 ? JSON.stringify(metadataPayload) : null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (error) {
    console.error('[AuditLog] Failed to log action:', params.action, error);
  }
}

/** Alias for backwards compatibility and short-form usage */
export const logAction = logAuditAction;
