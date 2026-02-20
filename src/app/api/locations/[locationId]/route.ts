import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PATCH - Update location fields (addressRaw, externalId, addressConfidence,
 * addressComponents, latitude, longitude, addressNormalized)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params;
    const body = await req.json();

    const {
      addressRaw,
      addressNormalized,
      externalId,
      addressConfidence,
      addressComponents,
      latitude,
      longitude
    } = body;

    const data: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (addressRaw !== undefined) {
      if (typeof addressRaw !== 'string') {
        return NextResponse.json(
          { error: 'addressRaw must be a string' },
          { status: 400 }
        );
      }
      const trimmed = addressRaw.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: 'addressRaw cannot be empty' },
          { status: 400 }
        );
      }
      data.addressRaw = trimmed;
    }

    if (addressNormalized !== undefined) {
      data.addressNormalized =
        typeof addressNormalized === 'string' && addressNormalized.trim()
          ? addressNormalized.trim()
          : null;
    }

    if (externalId !== undefined) {
      data.externalId =
        typeof externalId === 'string' && externalId.trim()
          ? externalId.trim()
          : null;
    }

    if (addressConfidence !== undefined) {
      const n = Number(addressConfidence);
      if (Number.isNaN(n) || n < 0 || n > 1) {
        return NextResponse.json(
          { error: 'addressConfidence must be a number between 0 and 1' },
          { status: 400 }
        );
      }
      data.addressConfidence = n;
    }

    if (addressComponents !== undefined) {
      if (addressComponents !== null && typeof addressComponents !== 'object') {
        return NextResponse.json(
          { error: 'addressComponents must be an object or null' },
          { status: 400 }
        );
      }
      data.addressComponents = addressComponents;
    }

    if (latitude !== undefined) {
      const n = Number(latitude);
      if (Number.isNaN(n) || n < -90 || n > 90) {
        return NextResponse.json(
          { error: 'latitude must be a number between -90 and 90' },
          { status: 400 }
        );
      }
      data.latitude = n;
    }

    if (longitude !== undefined) {
      const n = Number(longitude);
      if (Number.isNaN(n) || n < -180 || n > 180) {
        return NextResponse.json(
          { error: 'longitude must be a number between -180 and 180' },
          { status: 400 }
        );
      }
      data.longitude = n;
    }

    const location = await prisma.location.update({
      where: { id: locationId },
      data: data as Parameters<typeof prisma.location.update>[0]['data']
    });

    return NextResponse.json({ location });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update location' },
      { status: 500 }
    );
  }
}
