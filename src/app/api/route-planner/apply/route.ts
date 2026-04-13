import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLastLegUserId } from '@/lib/lastleg-route-user';
import {
  arcPositionAlongPolyline,
  filterAndRankTargetsAlongCorridor,
  type LatLng
} from '@/lib/route-corridor';
import type { CorridorLine, RoutePlannerState } from '@/lib/route-planner-types';
import { findActiveRouteIdForUser } from '@/lib/user-active-route';

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
  /** Updates `Route.name` when non-empty. */
  routeName?: string;
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
        vertexLabels.push(`Stop ${i}`);
      }
      vertexLabels.push('End');
    }

    const radiusMeters = radiusMiles * 1609.34;

    const routeInclude = {
      stops: {
        orderBy: { seq: 'asc' as const },
        include: {
          target: {
            select: {
              id: true,
              latitude: true,
              longitude: true,
              company: true,
              addressRaw: true
            }
          }
        }
      }
    } as const;

    const preferredId = await findActiveRouteIdForUser(userId);
    let route = preferredId
      ? await prisma.route.findFirst({
          where: { id: preferredId, assignedToUserId: userId },
          include: routeInclude
        })
      : null;

    if (!route) {
      const now = new Date();
      route = await prisma.route.create({
        data: { name: 'My route', assignedToUserId: userId, created: now, updatedAt: now },
        include: routeInclude
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

    const locRows = await prisma.location.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        Company: { hidden: false, isBuyer: false }
      },
      select: { id: true, addressRaw: true, latitude: true, longitude: true }
    });
    const locPoints = locRows
      .map((l) => ({
        id: l.id,
        lat: Number(l.latitude),
        lng: Number(l.longitude)
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    const { filteredIds: filteredLocIds, rankedIds: rankedLocIds } = filterAndRankTargetsAlongCorridor(
      locPoints,
      vertices,
      radiusMeters
    );

    const targetById = new Map(
      route.stops.map((s) => [s.target.id, s.target] as const)
    );

    const lineCands: { kind: 'target' | 'location'; label: string; arc: number }[] = [];
    for (const id of rankedIds) {
      const t = targetById.get(id);
      if (!t || t.latitude == null || t.longitude == null) continue;
      const lat = Number(t.latitude);
      const lng = Number(t.longitude);
      const label = (t.company || t.addressRaw || id).trim() || id;
      lineCands.push({
        kind: 'target',
        label,
        arc: arcPositionAlongPolyline({ lat, lng }, vertices)
      });
    }
    const locById = new Map(locRows.map((l) => [l.id, l] as const));
    for (const id of rankedLocIds) {
      const loc = locById.get(id);
      if (!loc || loc.latitude == null || loc.longitude == null) continue;
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      lineCands.push({
        kind: 'location',
        label: (loc.addressRaw || id).trim() || id,
        arc: arcPositionAlongPolyline({ lat, lng }, vertices)
      });
    }
    lineCands.sort((a, b) => a.arc - b.arc);
    const corridorLines: CorridorLine[] = lineCands.slice(0, 100).map(({ kind, label }) => ({
      kind,
      label
    }));

    const routeNameIn =
      typeof body.routeName === 'string' ? body.routeName.trim().slice(0, 160) : '';

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
      filteredLocationIds: Array.from(filteredLocIds),
      rankedLocationIds: rankedLocIds,
      corridorLines,
      updatedAt: now.toISOString()
    };

    await prisma.route.update({
      where: { id: route.id },
      data: {
        corridorPlanner: state as object,
        updatedAt: now,
        ...(routeNameIn ? { name: routeNameIn } : {})
      }
    });

    return NextResponse.json({
      ...state,
      activeRouteId: route.id,
      activeRouteName: routeNameIn || route.name
    });
  } catch (e) {
    console.error('route-planner/apply', e);
    const message = e instanceof Error ? e.message : 'Apply failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
