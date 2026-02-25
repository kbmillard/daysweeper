import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET - Return location counts for geocoding dashboard.
 * { total, withGeocode, missing }
 */
export async function GET() {
  try {
    const [total, withGeocode, missing] = await Promise.all([
      prisma.location.count(),
      prisma.location.count({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
      }),
      prisma.location.count({
        where: {
          OR: [{ latitude: null }, { longitude: null }],
          addressRaw: { not: '' },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      withGeocode,
      missing,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch geocode stats';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
