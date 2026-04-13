import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST - Hide a dot at the given coordinates.
 * Supports legacy KML fallback (HiddenDot) and DB-first MapPin hiding.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let lat = body?.latitude != null ? Number(body.latitude) : NaN;
    let lng = body?.longitude != null ? Number(body.longitude) : NaN;
    if (Number.isNaN(lat) || lat < -90 || lat > 90 || Number.isNaN(lng) || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Valid latitude (-90..90) and longitude (-180..180) required' },
        { status: 400 }
      );
    }
    lat = Math.round(lat * 1e6) / 1e6;
    lng = Math.round(lng * 1e6) / 1e6;
    await prisma.mapPin
      .updateMany({
        where: {
          latitude: lat,
          longitude: lng
        },
        data: { hidden: true }
      })
      .catch(() => {
        // ignore if MapPin table/column unavailable
      });
    await prisma.hiddenDot.create({ data: { latitude: lat, longitude: lng } }).catch(() => {
      // ignore duplicate (already hidden)
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to hide dot' },
      { status: 500 }
    );
  }
}
