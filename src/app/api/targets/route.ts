import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { targetToLead } from '@/lib/target-to-lead';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHARED_USER_ID = 'shared';

/**
 * GET - List targets for the current user's route (LastLeg app).
 * Accepts session (cookies) or Bearer token so the iOS app can send Authorization: Bearer <token>.
 * Falls back to shared route when not authenticated.
 */
export async function GET() {
  try {
    const authResult = await Promise.race([
      auth({ acceptsToken: ['session_token', 'oauth_token'] }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
    const userId =
      (authResult && 'userId' in authResult ? (authResult as { userId: string }).userId : null) ??
      SHARED_USER_ID;

    const route = await prisma.route.findFirst({
      where: { assignedToUserId: userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        stops: {
          orderBy: { seq: 'asc' },
          include: {
            target: true
          }
        }
      }
    });

    if (!route) {
      return NextResponse.json({ targets: [] });
    }

    const targets = route.stops.map((s) =>
      targetToLead({
        ...s.target,
        RouteStop: [{ seq: s.seq }]
      })
    );

    return NextResponse.json({ targets });
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    const isDbMissing =
      typeof raw === 'string' &&
      (raw.includes('does not exist') || raw.includes('Unknown column') || raw.includes('(not available)'));
    const message = isDbMissing
      ? 'Route/target tables missing. Run migrations or ensure-route-tables script.'
      : raw || 'Failed to fetch targets';
    return NextResponse.json(
      { targets: [], error: message },
      { status: isDbMissing ? 503 : 500 }
    );
  }
}

/**
 * POST - Create target and add to user's route (LastLeg app).
 * Body: { company, address?, segment?, category?, website?, phone?, latitude?, longitude? }
 * Accepts session or Bearer token.
 */
export async function POST(req: Request) {
  try {
    const authResult = await Promise.race([
      auth({ acceptsToken: ['session_token', 'oauth_token'] }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
    const userId =
      (authResult && 'userId' in authResult ? (authResult as { userId: string }).userId : null) ??
      SHARED_USER_ID;

    const body = await req.json();
    const { company, address, segment, category, website, phone, latitude, longitude } = body;

    if (!company || typeof company !== 'string' || !company.trim()) {
      return NextResponse.json({ error: 'company is required' }, { status: 400 });
    }

    const now = new Date();
    const addr = (address ?? '').trim() || '';
    const lat = latitude != null && !Number.isNaN(Number(latitude)) ? Number(latitude) : null;
    const lng = longitude != null && !Number.isNaN(Number(longitude)) ? Number(longitude) : null;

    let route = await prisma.route.findFirst({
      where: { assignedToUserId: userId },
      orderBy: { updatedAt: 'desc' }
    });
    if (!route) {
      route = await prisma.route.create({
        data: { name: 'My route', assignedToUserId: userId, created: now, updatedAt: now }
      });
    }

    const maxStop = await prisma.routeStop.findFirst({
      where: { routeId: route.id },
      orderBy: { seq: 'desc' },
      select: { seq: true }
    });
    const nextSeq = (maxStop?.seq ?? 0) + 1;

    const target = await prisma.target.create({
      data: {
        company: company.trim(),
        addressRaw: addr,
        website: website ?? undefined,
        phone: phone ?? undefined,
        segment: segment ?? undefined,
        category: category ?? undefined,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
        geocodeStatus: lat != null && lng != null ? 'geocoded' : 'missing',
        createdAt: now,
        updatedAt: now
      }
    });

    await prisma.routeStop.create({
      data: { routeId: route.id, targetId: target.id, seq: nextSeq, createdAt: now, updatedAt: now }
    });

    return NextResponse.json({ ok: true, target_id: target.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create target';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
