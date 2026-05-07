import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * DELETE - Remove a `MapPin` row and add `HiddenDot` at those coords (same as body DELETE on `/api/map-pins`).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await prisma.mapPin.delete({ where: { id } });
    try {
      await prisma.hiddenDot.create({
        data: { latitude: row.latitude, longitude: row.longitude }
      });
    } catch {
      /* duplicate or table missing */
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete pin' },
      { status: 500 }
    );
  }
}
