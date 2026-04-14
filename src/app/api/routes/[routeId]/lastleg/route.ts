import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLastLegUserId, SHARED_USER_ID } from '@/lib/lastleg-route-user';
import {
  emptyRoutePlannerResponse,
  parseStoredPlanner,
  type RoutePlannerState
} from '@/lib/route-planner-types';
import { resolveSellerCompanyIdsForTargets } from '@/lib/lastleg-resolve-seller-targets';
import { targetToLead } from '@/lib/target-to-lead';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/routes/[routeId]/lastleg — one route's stops + corridor for LastLeg (session or Bearer).
 * Use after opening lastleg://planned-route?routeId=… so iOS can import as a planned route without switching web "active" route semantics in-app.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const userId = await getLastLegUserId();
    if (userId === SHARED_USER_ID) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { routeId } = await params;
    if (!routeId) {
      return NextResponse.json({ error: 'routeId required' }, { status: 400 });
    }

    const route = await prisma.route.findFirst({
      where: { id: routeId, assignedToUserId: userId },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        corridorPlanner: true,
        stops: {
          orderBy: { seq: 'asc' },
          include: {
            target: {
              include: {
                TargetEnrichment: {
                  select: { enrichedJson: true }
                }
              }
            }
          }
        }
      }
    });

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    const parsed = parseStoredPlanner(route.corridorPlanner ?? null);
    const planner: RoutePlannerState = parsed
      ? { ...parsed, activeRouteId: route.id, activeRouteName: route.name }
      : {
          ...emptyRoutePlannerResponse(),
          activeRouteId: route.id,
          activeRouteName: route.name
        };

    const sellerByTarget = await resolveSellerCompanyIdsForTargets(route.stops.map((s) => s.target));
    const targets = route.stops.map((s) =>
      targetToLead(
        {
          ...s.target,
          RouteStop: [{ seq: s.seq, outcome: s.outcome }]
        },
        { resolvedSellerCompanyId: sellerByTarget.get(s.target.id) ?? null }
      )
    );

    return NextResponse.json({
      route: {
        id: route.id,
        name: route.name,
        updatedAt: route.updatedAt.toISOString()
      },
      planner,
      targets,
      hasStoredCorridorJson: route.corridorPlanner != null
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load route';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
