import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ preferences: null });
  }

  const prefs = await prisma.userPreference.findUnique({
    where: { userId }
  });

  return NextResponse.json({
    preferences: prefs
      ? {
          layout: (prefs.layout as { sidebarOpen?: boolean }) ?? {}
        }
      : null
  });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const layout = body.layout as { sidebarOpen?: boolean } | undefined;

  if (!layout || typeof layout !== 'object') {
    return NextResponse.json(
      { error: 'Expected { layout: { sidebarOpen?: boolean } }' },
      { status: 400 }
    );
  }

  const now = new Date();
  const existing = await prisma.userPreference.findUnique({
    where: { userId }
  });
  const mergedLayout = {
    ...((existing?.layout as Record<string, unknown>) ?? {}),
    ...layout
  };

  const prefs = await prisma.userPreference.upsert({
    where: { userId },
    update: { layout: mergedLayout, updatedAt: now },
    create: {
      id: crypto.randomUUID(),
      userId,
      layout: mergedLayout,
      updatedAt: now
    }
  });

  return NextResponse.json({
    preferences: {
      layout: (prefs.layout as { sidebarOpen?: boolean }) ?? {}
    }
  });
}
