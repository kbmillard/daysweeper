import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { resolveSellerCompanyIdsForTargets } from '@/lib/lastleg-resolve-seller-targets';
import { targetToLead } from '@/lib/target-to-lead';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function metersToLatitudeDelta(meters: number): number {
  return meters / 111_320;
}

function metersToLongitudeDelta(meters: number, latitude: number): number {
  const scale = Math.cos((latitude * Math.PI) / 180);
  return meters / (111_320 * Math.max(0.2, Math.abs(scale)));
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lat = Number(req.nextUrl.searchParams.get('latitude'));
    const lng = Number(req.nextUrl.searchParams.get('longitude'));
    const radiusMeters = Math.min(
      400,
      Math.max(40, Number(req.nextUrl.searchParams.get('radiusMeters') ?? '140'))
    );

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return NextResponse.json({ error: 'Invalid latitude' }, { status: 400 });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Invalid longitude' }, { status: 400 });
    }

    const latDelta = metersToLatitudeDelta(radiusMeters);
    const lngDelta = metersToLongitudeDelta(radiusMeters, lat);

    const candidates = await prisma.target.findMany({
      where: {
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      include: {
        TargetEnrichment: {
          select: { enrichedJson: true },
        },
        RouteStop: {
          take: 1,
          orderBy: { seq: 'asc' },
          select: { seq: true, outcome: true },
        },
      },
      take: 12,
    });

    const nearest = candidates
      .map((target) => ({
        target,
        distanceMeters: distanceMeters(
          lat,
          lng,
          Number(target.latitude),
          Number(target.longitude)
        ),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

    if (!nearest || nearest.distanceMeters > radiusMeters) {
      return NextResponse.json({ target: null }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const sellerByTarget = await resolveSellerCompanyIdsForTargets([nearest.target]);
    return NextResponse.json(
      {
        target: targetToLead(nearest.target, {
          resolvedSellerCompanyId: sellerByTarget.get(nearest.target.id) ?? null
        })
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to lookup target';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
