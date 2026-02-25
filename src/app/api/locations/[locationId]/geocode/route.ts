import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH - Save Apple (CLGeocoder) geocode result for a location.
 * Body: { latitude: number, longitude: number }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params;
    const body = await req.json();
    const { latitude, longitude } = body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'latitude and longitude (numbers) are required' },
        { status: 400 }
      );
    }

    const location = await prisma.location.update({
      where: { id: locationId },
      data: {
        latitude,
        longitude,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      location: {
        id: location.id,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude)
      }
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update geocode' },
      { status: 500 }
    );
  }
}
