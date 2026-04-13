import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidMapboxCoordinate } from '@/lib/geocode-address';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SellerPin = {
  /** Same as companyId (legacy grey-pin id) */
  id: string;
  companyId: string;
  locationId: string;
  lat: number;
  lng: number;
  label: string;
  addressRaw?: string;
  phone?: string;
  website?: string;
  role?: string;
  notes?: string;
};

function sellerImportMeta(metadata: unknown): { role?: string; notes?: string } {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const meta = metadata as { sellerImport?: unknown; buyerImport?: unknown };
  const bi = meta.sellerImport ?? meta.buyerImport;
  if (!bi || typeof bi !== 'object' || Array.isArray(bi)) return {};
  const o = bi as Record<string, unknown>;
  const role = typeof o.role === 'string' ? o.role : undefined;
  const notes = typeof o.notes === 'string' ? o.notes : undefined;
  return { role, notes };
}

/**
 * GET — Grey seller/vendor-research pins (Company.isSeller + geocoded Location). Same auth pattern as /api/locations/map (open).
 */
export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      where: {
        isSeller: true,
        hidden: false,
        Location: {
          some: {
            latitude: { not: null },
            longitude: { not: null }
          }
        }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        website: true,
        metadata: true,
        Location: {
          where: {
            latitude: { not: null },
            longitude: { not: null }
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            id: true,
            addressRaw: true,
            latitude: true,
            longitude: true
          }
        }
      }
    });

    const pins: SellerPin[] = [];

    for (const c of companies) {
      const loc = c.Location[0];
      if (!loc) continue;
      const lat = loc.latitude != null ? Number(loc.latitude) : null;
      const lng = loc.longitude != null ? Number(loc.longitude) : null;
      if (!isValidMapboxCoordinate(lat, lng)) continue;
      const { role, notes } = sellerImportMeta(c.metadata);
      pins.push({
        id: c.id,
        companyId: c.id,
        locationId: loc.id,
        lat: lat!,
        lng: lng!,
        label: c.name,
        addressRaw: loc.addressRaw || undefined,
        phone: c.phone ?? undefined,
        website: c.website ?? undefined,
        role,
        notes
      });
    }

    return NextResponse.json({ pins }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { pins: [], error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
