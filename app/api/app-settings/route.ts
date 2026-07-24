// @chimerai component=AppSettingsAPI version=1.1
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering — Next.js caches static GET routes by default,
// which would serve stale app-name values after admin changes.
export const dynamic = 'force-dynamic';

// Public endpoint — no auth needed (just reads app name)
export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['app.name', 'app.language'] } },
    });

    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    return NextResponse.json({
      appName: map['app.name'] || 'ChimerAI',
      language: map['app.language'] || 'en',
    });
  } catch {
    return NextResponse.json({ appName: 'ChimerAI', language: 'en' });
  }
}
