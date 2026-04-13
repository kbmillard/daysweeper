import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidMapboxCoordinate } from '@/lib/geocode-address';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET - Seller pins for map overlay (grey markers). Same auth pattern as /api/locations/map (open).
 */
export async function GET() {
  try {
    const rows = await prisma.seller.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: {
        id: true,
        name: true,
        addressRaw: true,
        phone: true,
        website: true,
        role: true,
        notes: true,
        latitude: true,
        longitude: true
      }
    });

    const pins = rows
      .map((r) => {
        const lat = r.latitude != null ? Number(r.latitude) : null;
        const lng = r.longitude != null ? Number(r.longitude) : null;
        if (!isValidMapboxCoordinate(lat, lng)) return null;
        return {
          id: r.id,
          lat: lat!,
          lng: lng!,
          label: r.name,
          addressRaw: r.addressRaw || undefined,
          phone: r.phone ?? undefined,
          website: r.website ?? undefined,
          role: r.role ?? undefined,
          notes: r.notes ?? undefined
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);

    return NextResponse.json({ pins }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { pins: [], error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
