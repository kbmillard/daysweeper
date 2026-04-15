import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLastLegUserId } from '@/lib/lastleg-route-user';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH /api/routes/[routeId] — rename route (LastLeg route picker + map sheet).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const userId = await getLastLegUserId();
    const { routeId } = await params;
    const body = (await req.json()) as { name?: unknown };

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const route = await prisma.route.findFirst({
      where: { id: routeId, assignedToUserId: userId }
    });
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    const updated = await prisma.route.update({
      where: { id: routeId },
      data: { name, updatedAt: new Date() },
      select: { id: true, name: true, updatedAt: true }
    });

    return NextResponse.json({ ok: true, route: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update route';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
