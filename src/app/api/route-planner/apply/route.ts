import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLastLegUserId } from '@/lib/lastleg-route-user';
import { filterAndRankTargetsAlongCorridor, type LatLng } from '@/lib/route-corridor';
import type { RoutePlannerState } from '@/lib/route-planner-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ApplyBody = {
  radiusMiles?: number;
  /** Required: at least 2 points, geocoded on the client (MapKit JS on web, CLGeocoder on iOS). */
  vertices?: { lat?: unknown; lng?: unknown }[];
  vertexLabels?: string[];
  startAddress?: string;
  endAddress?: string;
  intermediateAddresses?: string[];
};

function parseVertices(raw: unknown): LatLng[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: LatLng[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    out.push({ lat, lng });
  }
  return out;
}

/**
 * POST /api/route-planner/apply — uses client-supplied vertices only (Apple geocoding on device/browser).
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getLastLegUserId();
    const body = (await req.json()) as ApplyBody;

    const vertices = parseVertices(body.vertices);
    if (!vertices) {
      return NextResponse.json(
        {
          error:
            'Send at least two { lat, lng } vertices from the client. Geocoding is not performed on this server.'
        },
        { status: 400 }
      );
    }

    const radiusMiles =
      typeof body.radiusMiles === 'number' && Number.isFinite(body.radiusMiles)
        ? Math.min(100, Math.max(5, body.radiusMiles))
        : 25;

    const startAddress = typeof body.startAddress === 'string' ? body.startAddress.trim() : '';
    const endAddress = typeof body.endAddress === 'string' ? body.endAddress.trim() : '';
    const intermediateAddresses = Array.isArray(body.intermediateAddresses)
      ? body.intermediateAddresses.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
      : [];

    let vertexLabels: string[] = Array.isArray(body.vertexLabels)
      ? body.vertexLabels.filter((x): x is string => typeof x === 'string')
      : [];

    if (vertexLabels.length !== vertices.length) {
      vertexLabels = ['Start'];
      for (let i = 1; i < vertices.length - 1; i++) {
        vertexLabels.push(`Via ${i}`);
      }
      vertexLabels.push('End');
    }

    const radiusMeters = radiusMiles * 1609.34;

    let route = await prisma.route.findFirst({
      where: { assignedToUserId: userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        stops: {
          orderBy: { seq: 'asc' },
          include: {
            target: { select: { id: true, latitude: true, longitude: true } }
          }
        }
      }
    });

    if (!route) {
      const now = new Date();
      route = await prisma.route.create({
        data: { name: 'My route', assignedToUserId: userId, created: now, updatedAt: now },
        include: {
          stops: {
            orderBy: { seq: 'asc' },
            include: {
              target: { select: { id: true, latitude: true, longitude: true } }
            }
          }
        }
      });
    }

    const targets = route.stops
      .map((s) => s.target)
      .filter((t) => t.latitude != null && t.longitude != null)
      .map((t) => ({
        id: t.id,
        lat: Number(t.latitude),
        lng: Number(t.longitude)
      }));

    const { filteredIds, rankedIds } = filterAndRankTargetsAlongCorridor(
      targets,
      vertices,
      radiusMeters
    );

    const now = new Date();
    const state: RoutePlannerState = {
      active: true,
      startAddress,
      endAddress,
      intermediateAddresses,
      radiusMiles,
      vertices,
      vertexLabels,
      filteredTargetIds: Array.from(filteredIds),
      rankedTargetIds: rankedIds,
      updatedAt: now.toISOString()
    };

    await prisma.route.update({
      where: { id: route.id },
      data: { corridorPlanner: state as object, updatedAt: now }
    });

    return NextResponse.json(state);
  } catch (e) {
    console.error('route-planner/apply', e);
    const message = e instanceof Error ? e.message : 'Apply failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
