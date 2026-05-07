import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getLastLegUserId,
  LASTLEG_CANONICAL_PINS_ROUTE_NAME,
  SHARED_USER_ID
} from '@/lib/lastleg-route-user';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Prefer Referer path /map; other checks used when Referer is stripped (browser privacy). */
function isMainMapPageReferer(req: Request): boolean {
  const raw = req.headers.get('referer') ?? req.headers.get('referrer');
  if (!raw) return false;
  try {
    const path = new URL(raw).pathname.replace(/\/$/, '') || '/';
    return path === '/map';
  } catch {
    return false;
  }
}

function hostNoPort(h: string | null): string | null {
  if (!h) return null;
  return h.split(':')[0]!.toLowerCase();
}

/**
 * Referer can be missing (privacy, Referrer-Policy). Allow same-origin POSTs so drops persist.
 */
function canPostUserMapPin(req: Request): boolean {
  if (isMainMapPageReferer(req)) return true;
  if (req.headers.get('sec-fetch-site') === 'same-origin') return true;
  const origin = req.headers.get('origin');
  const host = hostNoPort(req.headers.get('host'));
  if (origin && host) {
    try {
      if (new URL(origin).hostname.toLowerCase() === host) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** Match sync / hide rounding — MapPin uses Decimal(10,6) and Decimal(11,6). */
function toDecimalCoord(n: number): Prisma.Decimal {
  const rounded = Math.round(n * 1e6) / 1e6;
  return new Prisma.Decimal(rounded.toFixed(6));
}

/** Same route scope as GET /api/targets/dots — removing stops hides the pin after refresh. */
async function removeTargetFromMapRoutes(targetId: string): Promise<number> {
  const userId = await getLastLegUserId();
  const [canonicalRoute, userRoute] = await Promise.all([
    prisma.route.findFirst({
      where: {
        assignedToUserId: SHARED_USER_ID,
        name: LASTLEG_CANONICAL_PINS_ROUTE_NAME
      },
      select: { id: true }
    }),
    prisma.route.findFirst({
      where: { assignedToUserId: userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true }
    })
  ]);
  const routeIds = Array.from(
    new Set([canonicalRoute?.id, userRoute?.id].filter((x): x is string => Boolean(x)))
  );
  if (routeIds.length === 0) return 0;
  const result = await prisma.routeStop.deleteMany({
    where: { targetId, routeId: { in: routeIds } }
  });
  return result.count;
}

async function deleteMapPinsAtDecimal(lat: number, lng: number): Promise<number> {
  const dLat = toDecimalCoord(lat);
  const dLng = toDecimalCoord(lng);
  const pins = await prisma.mapPin.deleteMany({
    where: { latitude: dLat, longitude: dLng }
  });
  try {
    await prisma.hiddenDot.create({
      data: { latitude: dLat, longitude: dLng }
    });
  } catch {
    /* duplicate or table missing */
  }
  return pins.count;
}

/**
 * DELETE - Remove red dot(s) from the map after refresh.
 *
 * Body (any combination that applies):
 * - **`targetId`**: remove LastLeg `RouteStop` rows on canonical + user route (same as map merge),
 *   then delete `MapPin` at that target’s coordinates + `HiddenDot` so sync/KML cannot resurrect it.
 * - **`id`**: delete a single `MapPin` by id + `HiddenDot` at that row’s coords.
 * - **`latitude` / `longitude`**: delete `MapPin` rows matching 6dp + `HiddenDot` (no route change).
 */
export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
    const id = typeof body.id === 'string' ? body.id.trim() : '';

    let deletedRouteStops = 0;
    let deletedMapPins = 0;

    if (targetId) {
      const targetExists = await prisma.target.findUnique({
        where: { id: targetId },
        select: { latitude: true, longitude: true }
      });
      if (!targetExists) {
        return NextResponse.json({ error: 'Target not found' }, { status: 404 });
      }

      deletedRouteStops = await removeTargetFromMapRoutes(targetId);

      if (
        targetExists.latitude != null &&
        targetExists.longitude != null
      ) {
        const la = Number(targetExists.latitude);
        const lo = Number(targetExists.longitude);
        if (
          Number.isFinite(la) &&
          la >= -90 &&
          la <= 90 &&
          Number.isFinite(lo) &&
          lo >= -180 &&
          lo <= 180
        ) {
          deletedMapPins += await deleteMapPinsAtDecimal(la, lo);
        }
      }
    }

    if (id) {
      try {
        const row = await prisma.mapPin.delete({ where: { id } });
        deletedMapPins += 1;
        try {
          await prisma.hiddenDot.create({
            data: { latitude: row.latitude, longitude: row.longitude }
          });
        } catch {
          /* duplicate = already hidden */
        }
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err?.code === 'P2025') {
          if (!targetId) {
            return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
          }
          /* Already removed via targetId coordinate cleanup */
        } else {
          throw e;
        }
      }
      return NextResponse.json({
        ok: true,
        by: 'id' as const,
        deletedRouteStops,
        deletedMapPins
      });
    }

    const lat = body.latitude != null ? Number(body.latitude) : NaN;
    const lng = body.longitude != null ? Number(body.longitude) : NaN;
    if (
      !Number.isNaN(lat) &&
      lat >= -90 &&
      lat <= 90 &&
      !Number.isNaN(lng) &&
      lng >= -180 &&
      lng <= 180
    ) {
      if (!targetId) {
        deletedMapPins += await deleteMapPinsAtDecimal(lat, lng);
      }
      return NextResponse.json({
        ok: true,
        by: targetId ? ('targetId+coordinates' as const) : ('coordinates' as const),
        deletedRouteStops,
        deletedMapPins
      });
    }

    if (targetId) {
      return NextResponse.json({
        ok: true,
        by: 'targetId' as const,
        deletedRouteStops,
        deletedMapPins
      });
    }

    return NextResponse.json(
      { error: 'Provide targetId and/or id, or valid latitude and longitude' },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete pin' },
      { status: 500 }
    );
  }
}

/**
 * POST - Add a user-dropped red pin (persisted).
 */
export async function POST(req: Request) {
  try {
    if (!canPostUserMapPin(req)) {
      return NextResponse.json(
        { error: 'Pins can only be added from the main map page (/map).' },
        { status: 403 }
      );
    }
    const body = await req.json();
    const lat = body?.latitude != null ? Number(body.latitude) : NaN;
    const lng = body?.longitude != null ? Number(body.longitude) : NaN;
    if (Number.isNaN(lat) || lat < -90 || lat > 90 || Number.isNaN(lng) || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Valid latitude (-90..90) and longitude (-180..180) required' },
        { status: 400 }
      );
    }
    const pin = await prisma.mapPin.create({
      data: { latitude: lat, longitude: lng, droppedByUser: true },
    });
    return NextResponse.json({
      pin: { id: pin.id, lat: Number(pin.latitude), lng: Number(pin.longitude) }
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to add pin' },
      { status: 500 }
    );
  }
}
