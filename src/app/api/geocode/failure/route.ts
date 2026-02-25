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
 * POST /api/geocode/failure - Report a geocoding failure from the LastLeg iOS worker.
 * Auth: X-API-Key header with INTERNAL_API_KEY.
 * Body: { targetId, error, metadata? }
 * Increments geocodeAttempts and marks status=failed after 3 attempts.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { targetId, error: errorMsg, metadata } = body;

    if (!targetId) {
      return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
    }

    const current = await prisma.target.findUnique({
      where: { id: targetId },
      select: { geocodeAttempts: true }
    });

    if (!current) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const newAttempts = current.geocodeAttempts + 1;

    await prisma.target.update({
      where: { id: targetId },
      data: {
        geocodeAttempts: newAttempts,
        geocodeStatus: newAttempts >= 3 ? 'failed' : 'missing',
        geocodeLastError: typeof errorMsg === 'string' ? errorMsg : null,
        geocodeMeta: metadata ?? undefined,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record geocode failure';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
