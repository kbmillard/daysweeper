import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * DELETE - Remove a user-dropped red pin.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.mapPin.delete({ where: { id } });
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
