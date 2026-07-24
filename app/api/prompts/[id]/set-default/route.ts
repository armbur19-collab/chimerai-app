// @chimerai component=PromptsSetDefaultRoute version=1.0
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find the template (user's own OR system template)
    const template = await prisma.promptTemplate.findFirst({
      where: {
        id,
        OR: [{ createdBy: session.user.id }, { createdBy: null }],
      },
    });
    if (!template) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // Atomically: unset all defaults in this category, then set this one
    await prisma.$transaction([
      prisma.promptTemplate.updateMany({
        where: { category: template.category, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.promptTemplate.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error setting default prompt:', error);
    return NextResponse.json({ error: 'Failed to set default prompt' }, { status: 500 });
  }
}
