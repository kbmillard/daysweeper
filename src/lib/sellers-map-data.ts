import { prisma } from '@/lib/prisma';
import { isValidMapboxCoordinate } from '@/lib/geocode-address';

type SellerImportSlice = { role?: string; notes?: string; importCategory?: string };

function sellerImportMeta(metadata: unknown): SellerImportSlice {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const meta = metadata as { sellerImport?: unknown; buyerImport?: unknown };
  const bi = meta.sellerImport ?? meta.buyerImport;
  if (!bi || typeof bi !== 'object' || Array.isArray(bi)) return {};
  const o = bi as Record<string, unknown>;
  const role = typeof o.role === 'string' ? o.role : undefined;
  const notes = typeof o.notes === 'string' ? o.notes : undefined;
  const importCategory = typeof o.importCategory === 'string' ? o.importCategory : undefined;
  return { role, notes, importCategory };
}

export type SellerMapPin = {
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
  importCategory?: string;
  companyLegacyJson?: unknown;
  locationLegacyJson?: unknown;
  companyExternalId?: string | null;
  locationExternalId?: string | null;
};

/**
 * Geocoded seller locations for map layers and KML export (non-hidden `Company.isSeller`).
 */
export async function getSellerMapPins(): Promise<SellerMapPin[]> {
  const locs = await prisma.location.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      Company: { isSeller: true, hidden: false }
    },
    select: {
      id: true,
      externalId: true,
      addressRaw: true,
      latitude: true,
      longitude: true,
      legacyJson: true,
      Company: {
        select: {
          id: true,
          externalId: true,
          name: true,
          phone: true,
          website: true,
          metadata: true,
          legacyJson: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const pins: SellerMapPin[] = [];

  for (const loc of locs) {
    const lat = loc.latitude != null ? Number(loc.latitude) : null;
    const lng = loc.longitude != null ? Number(loc.longitude) : null;
    if (!isValidMapboxCoordinate(lat, lng)) continue;

    const c = loc.Company;
    const { role, notes, importCategory } = sellerImportMeta(c.metadata);

    pins.push({
      companyId: c.id,
      locationId: loc.id,
      lat: lat!,
      lng: lng!,
      label: c.name,
      addressRaw: loc.addressRaw || undefined,
      phone: c.phone ?? undefined,
      website: c.website ?? undefined,
      role,
      notes,
      importCategory,
      companyLegacyJson: c.legacyJson ?? undefined,
      locationLegacyJson: loc.legacyJson ?? undefined,
      companyExternalId: c.externalId,
      locationExternalId: loc.externalId
    });
  }

  return pins;
}
