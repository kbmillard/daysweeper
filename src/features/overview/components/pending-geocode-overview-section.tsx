import { prisma } from '@/lib/prisma';
import {
  PendingGeocodeLocationsTableClient,
  type PendingGeocodeLocationRow
} from './pending-geocode-locations-table-client';

function pickComponent(
  ac: unknown,
  ...keys: string[]
): string {
  if (!ac || typeof ac !== 'object' || Array.isArray(ac)) return '';
  const o = ac as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Cap rows sent through the RSC boundary — very large lists break production renders. */
const PENDING_GEOCODE_ROW_CAP = 2500;

/**
 * Locations with a non-empty address and no coordinates (not scoped to non-hidden companies).
 * Newest first; total may exceed the cap — see `totalPending` on the client table.
 */
export async function PendingGeocodeOverviewSection() {
  const where = {
    addressRaw: { not: '' },
    latitude: null,
    longitude: null
  } as const;

  const [totalPending, raw] = await Promise.all([
    prisma.location.count({ where }),
    prisma.location.findMany({
      where,
      select: {
        id: true,
        externalId: true,
        addressRaw: true,
        addressComponents: true,
        Company: { select: { id: true, name: true, hidden: true, isSeller: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: PENDING_GEOCODE_ROW_CAP
    })
  ]);

  const rows: PendingGeocodeLocationRow[] = raw.map((loc) => {
    const ac = loc.addressComponents;
    return {
      id: loc.id,
      externalId: loc.externalId,
      addressRaw: loc.addressRaw,
      city: pickComponent(ac, 'city', 'City'),
      state: pickComponent(ac, 'state', 'State', 'region'),
      country: pickComponent(ac, 'country', 'Country', 'country_code'),
      companyId: loc.Company.id,
      companyName: loc.Company.name,
      companyHidden: loc.Company.hidden,
      companyIsSeller: loc.Company.isSeller
    };
  });

  return (
    <PendingGeocodeLocationsTableClient
      rows={rows}
      totalPending={totalPending}
      rowCap={PENDING_GEOCODE_ROW_CAP}
    />
  );
}
