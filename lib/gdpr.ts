// @chimerai component=GdprLib version=2.0
import { prisma } from './prisma';

export type ConsentType = 'analytics' | 'marketing';

export async function deleteUserData(userId: string): Promise<void> {
  // Cascade deletes handle most relations, but explicit order for safety
  await prisma.apiKey.deleteMany({ where: { userId } });
  await prisma.apiUsage.deleteMany({ where: { userId } });

  // Delete conversations and their messages (messages cascade)
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    select: { id: true },
  });
  const conversationIds = conversations.map((c) => c.id);
  if (conversationIds.length > 0) {
    await prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await prisma.conversation.deleteMany({ where: { userId } });
  }

  await prisma.session.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

export async function exportUserData(userId: string): Promise<object> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
  });

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true, name: true, scopes: true, createdAt: true, lastUsedAt: true, expiresAt: true, revoked: true },
  });

  const conversations = await prisma.conversation.findMany({
    where: { userId },
    include: {
      messages: {
        select: { id: true, role: true, content: true, model: true, tokens: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const apiUsage = await prisma.apiUsage.findMany({
    where: { userId },
    select: { id: true, model: true, endpoint: true, totalTokens: true, cost: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const consents = await prisma.consentLog.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    exportedAt: new Date().toISOString(),
    user,
    apiKeys,
    conversations,
    apiUsage,
    consentHistory: consents.map((c: any) => ({
      type: c.type,
      granted: c.granted,
      version: c.version,
      consentGivenAt: c.createdAt,
      lastUpdated: c.updatedAt,
    })),
  };
}

export async function recordConsent(userId: string, type: string, granted: boolean, version?: string): Promise<void> {
  const ver = version ?? process.env.NEXT_PUBLIC_PRIVACY_POLICY_VERSION ?? '1.0';
  await prisma.consentLog.upsert({
    where: { userId_type: { userId, type } },
    update: { granted, version: ver },
    create: { userId, type, granted, version: ver },
  });
}

/**
 * Check whether a user has granted consent for a specific purpose.
 * Usage: if (await hasConsent(userId, 'analytics')) { ... }
 */
export async function hasConsent(userId: string, type: ConsentType): Promise<boolean> {
  const consent = await prisma.consentLog.findUnique({
    where: { userId_type: { userId, type } },
  });
  return consent?.granted ?? false;
}

/**
 * Return all consent entries for a user (admin view / compliance export).
 */
export async function getAllConsents(userId: string) {
  return prisma.consentLog.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Return the policy version the user last consented to, or null if never consented.
 */
export async function getConsentVersion(userId: string, type: ConsentType): Promise<string | null> {
  const consent = await prisma.consentLog.findUnique({
    where: { userId_type: { userId, type } },
  });
  return consent?.version ?? null;
}

/**
 * Check whether the user has consented to the CURRENT policy version.
 * If false, redirect the user to the consent page to re-consent.
 */
export async function hasCurrentConsent(userId: string, type: ConsentType, currentVersion: string): Promise<boolean> {
  const consent = await prisma.consentLog.findUnique({
    where: { userId_type: { userId, type } },
  });
  if (!consent?.granted) return false;
  return consent.version === currentVersion;
}
