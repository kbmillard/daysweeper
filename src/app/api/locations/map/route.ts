import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toMapboxCoordinates } from '@/lib/geocode-address';

/**
 * GET - GeoJSON FeatureCollection of all locations with valid latitude/longitude for Mapbox.
 * Only includes coordinates that pass WGS84 validation so the map is accurate.
 */
export async function GET() {
  try {
    const locs = await prisma.location.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true, companyId: true, addressRaw: true, latitude: true, longitude: true }
    });

    const features = locs
      .map((loc) => {
        const coords = toMapboxCoordinates(
          loc.latitude != null ? Number(loc.latitude) : null,
          loc.longitude != null ? Number(loc.longitude) : null
        );
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

    return NextResponse.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch map locations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
