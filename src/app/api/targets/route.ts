import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { targetToLead } from '@/lib/target-to-lead';

/**
 * GET - List targets for the current user's route (LastLeg app).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const message = error instanceof Error ? error.message : 'Failed to fetch targets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST - Create target and add to user's route (LastLeg app).
 * Body: { company, address?, segment?, category?, website?, phone?, latitude?, longitude? }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
