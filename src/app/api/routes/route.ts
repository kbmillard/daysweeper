import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLastLegUserId } from '@/lib/lastleg-route-user';
import { findActiveRouteIdForUser, setUserActiveRouteId } from '@/lib/user-active-route';

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

type CreateBody = {
  name?: string;
  /** Defaults to true — set as active route after create. */
  makeActive?: boolean;
};

/**
 * POST /api/routes — create an empty LastLeg route for the signed-in user.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getLastLegUserId();
    const body = (await req.json().catch(() => ({}))) as CreateBody;
    let name =
      typeof body.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : '';
    if (!name) {
      const existing = await prisma.route.count({
        where: { assignedToUserId: userId }
      });
      name = `Route ${existing + 1}`;
    }
    const makeActive = body.makeActive !== false;
    const now = new Date();
    const route = await prisma.route.create({
      data: {
        name,
        assignedToUserId: userId,
        created: now,
        updatedAt: now
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        _count: { select: { stops: true } }
      }
    });
    if (makeActive) {
      await setUserActiveRouteId(userId, route.id);
    }
    return NextResponse.json({ route });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create route';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
