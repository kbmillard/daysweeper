import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { targetToLead } from '@/lib/target-to-lead';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHARED_USER_ID = 'shared';

/**
 * GET - Fetch a single target by ID (LastLeg app). Accepts session or Bearer token.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const target = await prisma.target.findUnique({
      where: { id },
      include: {
        RouteStop: {
          take: 1,
          orderBy: { seq: 'asc' },
          select: { seq: true }
        }
      }
    });

    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    return NextResponse.json({ target: targetToLead(target) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch target';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const VALID_OUTCOMES = ['VISITED', 'NO_ANSWER', 'WRONG_ADDRESS', 'FOLLOW_UP'] as const;

/**
 * PATCH - Update target (LastLeg app). Accepts session or Bearer token.
 * Body: { status?, notes?, visited?, latitude?, longitude? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await Promise.race([
      auth({ acceptsToken: ['session_token', 'oauth_token'] }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
    const userId =
      (authResult && 'userId' in authResult ? (authResult as { userId: string }).userId : null) ??
      SHARED_USER_ID;

    const { id } = await params;
    const body = await req.json();
    const { status, notes, visited, latitude, longitude } = body;

    const target = await prisma.target.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const now = new Date();
    const targetUpdates: Record<string, unknown> = { updatedAt: now };
    if (latitude != null && !Number.isNaN(Number(latitude))) targetUpdates.latitude = Number(latitude);
    if (longitude != null && !Number.isNaN(Number(longitude))) targetUpdates.longitude = Number(longitude);
    if (Object.keys(targetUpdates).length > 1) {
      await prisma.target.update({ where: { id }, data: targetUpdates });
    }

    const route = await prisma.route.findFirst({
      where: { assignedToUserId: userId },
      orderBy: { updatedAt: 'desc' }
    });
    if (route) {
      const stop = await prisma.routeStop.findFirst({
        where: { routeId: route.id, targetId: id }
      });
      if (stop) {
        const stopUpdates: Record<string, unknown> = {};
        if (typeof notes === 'string') stopUpdates.note = notes;
        if (visited === true) {
          stopUpdates.visitedAt = now;
          stopUpdates.outcome = 'VISITED';
        } else if (typeof status === 'string' && VALID_OUTCOMES.includes(status as (typeof VALID_OUTCOMES)[number])) {
          stopUpdates.outcome = status;
          if (status === 'VISITED') stopUpdates.visitedAt = now;
        }
        if (Object.keys(stopUpdates).length > 0) {
          await prisma.routeStop.update({ where: { id: stop.id }, data: stopUpdates });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update target';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
