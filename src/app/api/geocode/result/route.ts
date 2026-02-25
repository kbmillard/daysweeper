export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';

function isAuthorized(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key') ?? req.headers.get('X-API-Key') ?? '';
  return INTERNAL_API_KEY.length > 0 && key === INTERNAL_API_KEY;
}

/**
 * POST /api/geocode/result - Submit a geocoding result from the LastLeg iOS worker.
 * Auth: X-API-Key header with INTERNAL_API_KEY.
 * Body: { targetId, latitude, longitude, accuracy?, metadata? }
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { targetId, latitude, longitude, accuracy, metadata } = body;

    if (!targetId || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'targetId, latitude, longitude are required' }, { status: 400 });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'latitude and longitude must be numbers' }, { status: 400 });
    }

    await prisma.target.update({
      where: { id: targetId },
      data: {
        latitude: lat,
        longitude: lng,
        geocodeStatus: 'geocoded',
        geocodedAt: new Date(),
        geocodeAccuracy: accuracy ?? null,
        geocodeMeta: metadata ?? undefined,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit geocode result';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
