import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

/**
 * POST - Add a location (company + geocode) to the current user's LastLeg route.
 * Body: { locationId, companyId }
 * Creates Target and RouteStop in daysweeper DB. LastLeg app fetches via GET /api/targets.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { locationId, companyId } = body;

    if (!locationId || !companyId) {
      return NextResponse.json(
        { error: 'locationId and companyId are required' },
        { status: 400 }
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: { Company: { select: { id: true, name: true, website: true, phone: true, email: true } } }
    });

    if (!location || location.companyId !== companyId) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const company = location.Company;
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const now = new Date();
    const lat = location.latitude != null ? Number(location.latitude) : null;
    const lng = location.longitude != null ? Number(location.longitude) : null;

    let route = await prisma.route.findFirst({
      where: { assignedToUserId: userId },
      orderBy: { updatedAt: 'desc' }
    });

    if (!route) {
      route = await prisma.route.create({
        data: {
          name: 'My route',
          assignedToUserId: userId,
          created: now,
          updatedAt: now
        }
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
        company: company.name,
        addressRaw: location.addressRaw ?? '',
        website: company.website ?? undefined,
        phone: company.phone ?? undefined,
        email: company.email ?? undefined,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
        geocodeStatus: lat != null && lng != null ? 'geocoded' : 'missing',
        createdAt: now,
        updatedAt: now
      }
    });

    await prisma.routeStop.create({
      data: {
        routeId: route.id,
        targetId: target.id,
        seq: nextSeq,
        createdAt: now,
        updatedAt: now
      }
    });

    return NextResponse.json({ success: true, routeId: route.id, target_id: target.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add to route';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
