export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeBulkGeocode } from '@/lib/geocode-route-auth';
import { runGeocodeBulkQueue } from '@/lib/geocode-bulk-queue';

/**
 * POST - Geocode all locations that have addressRaw but no latitude/longitude.
 * Uses server geocoder (Nominatim then Mapbox). Rate-limited; processes up to
 * 100 per call. Call again to process more.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await authorizeBulkGeocode(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success, failed } = await runGeocodeBulkQueue(prisma);
    return NextResponse.json({ success, failed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bulk geocode failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
