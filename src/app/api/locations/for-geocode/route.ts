import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET - List locations with addressRaw for Apple geocoding (e.g. from LastLeg iOS app).
 * ?missingOnly=true returns only locations without latitude/longitude.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const missingOnly = searchParams.get('missingOnly') === 'true';

    const where: { addressRaw: { not: string }; latitude?: null; longitude?: null } = {
      addressRaw: { not: '' }
    };
    if (missingOnly) {
      where.latitude = null;
      where.longitude = null;
    }

    const locations = await prisma.location.findMany({
      where,
      select: {
        id: true,
        companyId: true,
        addressRaw: true,
        latitude: true,
        longitude: true
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({
      locations: locations.map((loc) => ({
        id: loc.id,
        companyId: loc.companyId,
        addressRaw: loc.addressRaw,
        latitude: loc.latitude != null ? Number(loc.latitude) : null,
        longitude: loc.longitude != null ? Number(loc.longitude) : null
      }))
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}
