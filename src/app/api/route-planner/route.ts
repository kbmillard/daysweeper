import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getLastLegUserId } from '@/lib/lastleg-route-user';
import { emptyRoutePlannerResponse, parseStoredPlanner } from '@/lib/route-planner-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/route-planner — current corridor planner for the signed-in user's route (LastLeg + web map).
 */
export async function GET() {
  try {
    const userId = await getLastLegUserId();
    const route = await prisma.route.findFirst({
      where: { assignedToUserId: userId },
      orderBy: { updatedAt: 'desc' },
      select: { corridorPlanner: true }
    });
    const parsed = parseStoredPlanner(route?.corridorPlanner ?? null);
    if (!parsed) {
      return NextResponse.json(emptyRoutePlannerResponse());
    }
    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load route planner';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/route-planner — clear corridor planner (web + iOS on next fetch).
 */
export async function DELETE() {
  try {
    const userId = await getLastLegUserId();
    const route = await prisma.route.findFirst({
      where: { assignedToUserId: userId },
      orderBy: { updatedAt: 'desc' }
    });
    if (!route) {
      return NextResponse.json({ ok: true });
    }
    await prisma.route.update({
      where: { id: route.id },
      data: { corridorPlanner: Prisma.DbNull, updatedAt: new Date() }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to clear route planner';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
