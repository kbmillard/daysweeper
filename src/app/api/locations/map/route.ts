import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toMapboxCoordinates } from '@/lib/geocode-address';
import { effectiveLocationCrmStatus } from '@/lib/location-crm-status';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET - GeoJSON FeatureCollection of all locations with valid latitude/longitude for Mapbox.
 * Only includes coordinates that pass WGS84 validation so the map is accurate.
 */
export async function GET() {
  try {
    const locs = await prisma.location.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        Company: { hidden: false, isSeller: false }
      },
      select: {
        id: true,
        companyId: true,
        addressRaw: true,
        addressNormalized: true,
        latitude: true,
        longitude: true,
        locationName: true,
        phone: true,
        email: true,
        website: true,
        metadata: true,
        Company: {
          select: { name: true, status: true, primaryLocationId: true }
        }
      }
    });

    const features = locs
      .map((loc) => {
        const lat = loc.latitude != null ? Number(loc.latitude) : null;
        const lng = loc.longitude != null ? Number(loc.longitude) : null;
        const coords = toMapboxCoordinates(lat, lng);
        if (!coords) return null;
        const crmStatus = effectiveLocationCrmStatus({
          locationId: loc.id,
          companyStatus: loc.Company.status,
          companyPrimaryLocationId: loc.Company.primaryLocationId,
          locationMetadata: loc.metadata
        });
        const primaryId = loc.Company.primaryLocationId;
        const isPrimaryLocation =
          typeof primaryId === 'string' && primaryId.length > 0 && primaryId === loc.id;
        const companyName = (loc.Company.name ?? '').trim();
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: coords
          },
          properties: {
            id: loc.id,
            companyId: loc.companyId,
            addressRaw: loc.addressRaw ?? '',
            companyName,
            displayTitle: companyName || loc.addressRaw || 'Location',
            addressNormalized: loc.addressNormalized ?? '',
            locationName: loc.locationName ?? '',
            phone: loc.phone ?? '',
            email: loc.email ?? '',
            website: loc.website ?? '',
            latDisplay: lat != null ? lat.toFixed(6) : '',
            lngDisplay: lng != null ? lng.toFixed(6) : '',
            crmStatus,
            isPrimaryLocation
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
