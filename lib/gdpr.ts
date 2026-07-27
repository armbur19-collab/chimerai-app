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

  return {
    exportedAt: new Date().toISOString(),
    user,
    apiKeys,
    conversations,
    apiUsage,
  };
}

// Consent tracking (ConsentLog) requires the 'gdpr' feature — run `chimerai add gdpr`
// to enable recordConsent/hasConsent/getAllConsents/getConsentVersion/hasCurrentConsent.
