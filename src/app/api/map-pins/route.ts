import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST - Add a user-dropped red pin (persisted).
 */
export async function POST(req: Request) {
  try {
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
