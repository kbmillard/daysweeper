import type { PrismaClient } from '@prisma/client';
import { geocodeAddress } from '@/lib/geocode-server';

export const GEOCODE_BULK_MAX_DEFAULT = 100;
export const GEOCODE_BULK_DELAY_MS_DEFAULT = 1100; // Nominatim etiquette ~1 req/s

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type GeocodeBulkQueueOptions = {
  max?: number;
  delayMs?: number;
  /**
   * When set, only locations whose `externalId` is in this list and still need geocoding.
   * Ordered by `createdAt` desc so newly imported rows are preferred over backlog.
   */
  locationExternalIds?: string[];
};

/**
 * Geocode up to `max` locations missing lat/lng with non-empty addressRaw.
 * Same logic as POST /api/geocode/bulk (Nominatim + Mapbox, delay between rows).
 */
export async function runGeocodeBulkQueue(
  prisma: PrismaClient,
  options: GeocodeBulkQueueOptions = {}
): Promise<{ success: number; failed: number }> {
  const max = options.max ?? GEOCODE_BULK_MAX_DEFAULT;
  const delayMs = options.delayMs ?? GEOCODE_BULK_DELAY_MS_DEFAULT;
  const rawIds = options.locationExternalIds?.filter((s) => s && String(s).trim()) ?? [];
  const uniqueIds = rawIds.length ? Array.from(new Set(rawIds.map((s) => s.trim()))) : undefined;

  const locations = await prisma.location.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
      addressRaw: { not: '' },
      ...(uniqueIds?.length ? { externalId: { in: uniqueIds } } : {})
    },
    select: { id: true, addressRaw: true },
    orderBy: uniqueIds?.length ? { createdAt: 'desc' } : { createdAt: 'asc' },
    take: max
  });

  let success = 0;
  let failed = 0;

  for (let i = 0; i < locations.length; i++) {
    if (i > 0) await delay(delayMs);

    const loc = locations[i];
    const geo = await geocodeAddress(loc.addressRaw ?? '');
    if (geo) {
      await prisma.location.update({
        where: { id: loc.id },
        data: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          ...(geo.addressNormalized != null && { addressNormalized: geo.addressNormalized }),
          ...(geo.addressComponents != null && { addressComponents: geo.addressComponents }),
          updatedAt: new Date()
        }
      });
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}
