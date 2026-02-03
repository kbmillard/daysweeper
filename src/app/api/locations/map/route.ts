import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET - GeoJSON FeatureCollection of all locations with latitude/longitude for map dots.
 */
export async function GET() {
  try {
    const locs = await prisma.location.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true, companyId: true, addressRaw: true, latitude: true, longitude: true }
    });

    const features = locs.map((loc) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(loc.longitude), Number(loc.latitude)]
      },
      properties: {
        id: loc.id,
        companyId: loc.companyId,
        addressRaw: loc.addressRaw ?? ''
      }
    }));

    return NextResponse.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch map locations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
