import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getLastLegUserId } from '@/lib/lastleg-route-user';
import { emptyRoutePlannerResponse, parseStoredPlanner } from '@/lib/route-planner-types';
import { findActiveRouteIdForUser } from '@/lib/user-active-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/route-planner — current corridor planner for the signed-in user's route (LastLeg + web map).
 */
export async function GET() {
  try {
    const userId = await getLastLegUserId();
    const activeId = await findActiveRouteIdForUser(userId);
    const route = activeId
      ? await prisma.route.findFirst({
          where: { id: activeId, assignedToUserId: userId },
          select: { id: true, name: true, corridorPlanner: true }
        })
      : null;
    const parsed = parseStoredPlanner(route?.corridorPlanner ?? null);
    if (!parsed) {
      return NextResponse.json({
        ...emptyRoutePlannerResponse(),
        ...(route ? { activeRouteId: route.id, activeRouteName: route.name } : {})
      });
    }
    return NextResponse.json({
      ...parsed,
      activeRouteId: route?.id,
      activeRouteName: route?.name
    });
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
    const activeId = await findActiveRouteIdForUser(userId);
    const route = activeId
      ? await prisma.route.findFirst({ where: { id: activeId, assignedToUserId: userId } })
      : null;
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
