import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toMapboxCoordinates } from '@/lib/geocode-address';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET - GeoJSON FeatureCollection of all locations with valid latitude/longitude for Mapbox.
 * Only includes coordinates that pass WGS84 validation so the map is accurate.
 */
export async function GET() {
  try {
    const locs = await prisma.location.findMany({
      where: { latitude: { not: null }, longitude: { not: null }, Company: { hidden: false } },
      select: { id: true, companyId: true, addressRaw: true, latitude: true, longitude: true }
    });

    const features = locs
      .map((loc) => {
        const lat = loc.latitude != null ? Number(loc.latitude) : null;
        const lng = loc.longitude != null ? Number(loc.longitude) : null;
        const coords = toMapboxCoordinates(lat, lng);
        if (!coords) return null;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: coords
          },
          properties: {
            id: loc.id,
            companyId: loc.companyId,
            addressRaw: loc.addressRaw ?? ''
          }
        };
      })
      .filter((f): f is NonNullable<typeof f> => f != null);

    return NextResponse.json(
      { type: 'FeatureCollection', features },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          Pragma: 'no-cache'
        }
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch map locations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
