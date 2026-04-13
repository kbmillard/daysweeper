import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** POST /api/map-pins is only allowed from the main map route (not /map/overview, etc.). */
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

/** Match sync / hide rounding — MapPin uses Decimal(10,6) and Decimal(11,6). */
function toDecimalCoord(n: number): Prisma.Decimal {
  const rounded = Math.round(n * 1e6) / 1e6;
  return new Prisma.Decimal(rounded.toFixed(6));
}

/**
 * DELETE - Remove red dot(s) from the database.
 * Body: `{ id: string }` or `{ latitude, longitude }` (6dp match on MapPin + HiddenDot cleanup).
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';

    if (id) {
      try {
        await prisma.mapPin.delete({ where: { id } });
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err?.code === 'P2025') {
          return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
        }
        throw e;
      }
      return NextResponse.json({ ok: true, by: 'id' as const });
    }

    const lat = body?.latitude != null ? Number(body.latitude) : NaN;
    const lng = body?.longitude != null ? Number(body.longitude) : NaN;
    if (Number.isNaN(lat) || lat < -90 || lat > 90 || Number.isNaN(lng) || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Provide id or valid latitude and longitude' },
        { status: 400 }
      );
    }

    const dLat = toDecimalCoord(lat);
    const dLng = toDecimalCoord(lng);

    const pins = await prisma.mapPin.deleteMany({
      where: { latitude: dLat, longitude: dLng }
    });

    let hiddenRemoved = 0;
    try {
      const hd = await prisma.hiddenDot.deleteMany({
        where: { latitude: dLat, longitude: dLng }
      });
      hiddenRemoved = hd.count;
    } catch {
      /* HiddenDot table may be absent */
    }

    return NextResponse.json({
      ok: true,
      by: 'coordinates' as const,
      deletedMapPins: pins.count,
      deletedHiddenDots: hiddenRemoved
    });
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
    if (!isMainMapPageReferer(req)) {
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
      data: { latitude: lat, longitude: lng }
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
