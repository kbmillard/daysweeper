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

/**
 * All locations in the database with a non-empty address and no coordinates (not scoped to
 * non-hidden companies).
 */
export async function PendingGeocodeOverviewSection() {
  const raw = await prisma.location.findMany({
    where: {
      addressRaw: { not: '' },
      latitude: null,
      longitude: null
    },
    select: {
      id: true,
      externalId: true,
      addressRaw: true,
      addressComponents: true,
      Company: { select: { id: true, name: true, hidden: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

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
      companyHidden: loc.Company.hidden
    };
  });

  return <PendingGeocodeLocationsTableClient rows={rows} />;
}
