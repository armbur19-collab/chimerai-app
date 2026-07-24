import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ── Encryption helpers (same as lib/encryption.ts) ──────────────
function getKey(): Buffer {
  const key = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!key) throw new Error('PROVIDER_ENCRYPTION_KEY required for seeding');
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text: string): string {
  if (!text) return '';
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return iv.toString('base64') + ':' + authTag.toString('base64') + ':' + encrypted;
}
// ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user (next-auth is always a core dependency)
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
    },
  });

  console.log('✅ Admin user created: admin@example.com / admin123');

  // ── Seed Providers (if API keys are in .env) ────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (openaiKey) {
    const provider = await prisma.provider.upsert({
      where: { id: 'seed-openai' },
      update: {},
      create: {
        id: 'seed-openai',
        name: 'OpenAI',
        type: 'openai',
        description: 'OpenAI API (seeded from .env)',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: encrypt(openaiKey),
        config: JSON.stringify({ defaultModel: 'gpt-4o-mini' }),
        status: 'active',
        isDefault: true,
        priority: 0,
        createdBy: admin.id,
      },
    });

    // Create default OpenAI models
    for (const m of [
      { providerId: provider.id, modelId: 'gpt-4o', name: 'GPT-4o', capabilities: JSON.stringify(['chat', 'vision']), contextWindow: 128000, inputCost: 2.5, outputCost: 10 },
      { providerId: provider.id, modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', capabilities: JSON.stringify(['chat']), contextWindow: 128000, inputCost: 0.15, outputCost: 0.6 },
      { providerId: provider.id, modelId: 'gpt-4-turbo', name: 'GPT-4 Turbo', capabilities: JSON.stringify(['chat', 'vision']), contextWindow: 128000, inputCost: 10, outputCost: 30 },
      { providerId: provider.id, modelId: 'text-embedding-3-small', name: 'Embedding 3 Small', capabilities: JSON.stringify(['embedding']), contextWindow: 8191, inputCost: 0.02, outputCost: 0 },
      { providerId: provider.id, modelId: 'text-embedding-3-large', name: 'Embedding 3 Large', capabilities: JSON.stringify(['embedding']), contextWindow: 8191, inputCost: 0.13, outputCost: 0 },
    ]) {
      try { await prisma.model.create({ data: m }); } catch { /* skip duplicate */ }
    }

    console.log('✅ OpenAI provider seeded with models');
  }

  if (anthropicKey) {
    const provider = await prisma.provider.upsert({
      where: { id: 'seed-anthropic' },
      update: {},
      create: {
        id: 'seed-anthropic',
        name: 'Anthropic',
        type: 'anthropic',
        description: 'Anthropic Claude API (seeded from .env)',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: encrypt(anthropicKey),
        config: JSON.stringify({ defaultModel: 'claude-sonnet-4-20250514' }),
        status: 'active',
        isDefault: false,
        priority: 1,
        createdBy: admin.id,
      },
    });

    for (const m of [
      { providerId: provider.id, modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', capabilities: JSON.stringify(['chat', 'vision']), contextWindow: 200000, inputCost: 3, outputCost: 15 },
      { providerId: provider.id, modelId: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', capabilities: JSON.stringify(['chat', 'vision']), contextWindow: 200000, inputCost: 3, outputCost: 15 },
      { providerId: provider.id, modelId: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', capabilities: JSON.stringify(['chat']), contextWindow: 200000, inputCost: 0.25, outputCost: 1.25 },
    ]) {
      try { await prisma.model.create({ data: m }); } catch { /* skip duplicate */ }
    }

    console.log('✅ Anthropic provider seeded with models');
  }

  if (!openaiKey && !anthropicKey) {
    console.log('ℹ️  No API keys in .env — skip provider seeding. Add via Provider Management UI.');
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
