import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLastLegUserId } from '@/lib/lastleg-route-user';
import { findActiveRouteIdForUser } from '@/lib/user-active-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/routes — LastLeg routes for the signed-in user (for map route picker).
 */
export async function GET() {
  try {
    const userId = await getLastLegUserId();
    const [activeRouteId, routes] = await Promise.all([
      findActiveRouteIdForUser(userId),
      prisma.route.findMany({
        where: { assignedToUserId: userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          updatedAt: true,
          _count: { select: { stops: true } }
        }
      })
    ]);
    return NextResponse.json({ routes, activeRouteId });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to list routes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
