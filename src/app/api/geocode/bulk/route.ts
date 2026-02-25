export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { geocodeAddress } from '@/lib/geocode-server';

const MAX_PER_REQUEST = 100;
const DELAY_MS = 1100; // Nominatim asks for max 1 req/sec

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST - Geocode all locations that have addressRaw but no latitude/longitude.
 * Uses server geocoder (Nominatim then Mapbox). Rate-limited; processes up to
 * MAX_PER_REQUEST per call. Call again to process more.
 */
export async function POST() {
  try {
    const locations = await prisma.location.findMany({
      where: {
        OR: [{ latitude: null }, { longitude: null }],
        addressRaw: { not: '' }
      },
      select: { id: true, addressRaw: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_PER_REQUEST
    });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < locations.length; i++) {
      if (i > 0) await delay(DELAY_MS);

      const loc = locations[i];
      const geo = await geocodeAddress(loc.addressRaw ?? '');
      if (geo) {
        await prisma.location.update({
          where: { id: loc.id },
          data: {
            latitude: geo.latitude,
            longitude: geo.longitude,
            ...(geo.addressNormalized != null && { addressNormalized: geo.addressNormalized }),
            ...(geo.addressComponents != null && { addressComponents: geo.addressComponents }),
            updatedAt: new Date()
          }
        });
        success++;
      } else {
        failed++;
      }
    }

    return NextResponse.json({ success, failed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bulk geocode failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
