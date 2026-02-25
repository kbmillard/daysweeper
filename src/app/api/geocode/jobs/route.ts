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
 * GET /api/geocode/jobs - Fetch targets that need geocoding (LastLeg iOS worker).
 * Auth: X-API-Key header with INTERNAL_API_KEY.
 * Returns up to 20 targets with geocodeStatus=missing and addressRaw set.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobs = await prisma.target.findMany({
      where: {
        geocodeStatus: 'missing',
        addressRaw: { not: '' },
        geocodeAttempts: { lt: 3 }
      },
      select: {
        id: true,
        company: true,
        addressRaw: true,
        addressNormalized: true,
        geocodeAttempts: true
      },
      orderBy: { geocodeAttempts: 'asc' },
      take: 20
    });

    return NextResponse.json({ jobs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch geocode jobs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
