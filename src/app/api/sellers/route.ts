import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sellers = await prisma.seller.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        externalId: true,
        name: true,
        addressRaw: true,
        phone: true,
        website: true,
        role: true,
        importCategory: true,
        latitude: true,
        longitude: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ sellers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
