import { Prisma, type PrismaClient } from '@prisma/client';
import { geocodeAddress } from '@/lib/geocode-server';

const MAX_DEFAULT = 100;
const DELAY_MS = 1100;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runSellerGeocodeQueue(
  prisma: PrismaClient,
  options: { max?: number; externalIds?: string[] } = {}
): Promise<{ success: number; failed: number }> {
  const max = options.max ?? MAX_DEFAULT;
  const raw = options.externalIds?.filter((s) => s?.trim()) ?? [];
  const unique = raw.length ? Array.from(new Set(raw.map((s) => s.trim()))) : undefined;

  const rows = await prisma.seller.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
      addressRaw: { not: '' },
      ...(unique?.length ? { externalId: { in: unique } } : {})
    },
    select: { id: true, addressRaw: true },
    orderBy: unique?.length ? { createdAt: 'desc' } : { createdAt: 'asc' },
    take: max
  });

  let success = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) await delay(DELAY_MS);
    const row = rows[i];
    const geo = await geocodeAddress(row.addressRaw ?? '');
    if (geo) {
      await prisma.seller.update({
        where: { id: row.id },
        data: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          ...(geo.addressNormalized != null && { addressNormalized: geo.addressNormalized }),
          ...(geo.addressComponents != null && {
            addressComponents: geo.addressComponents as Prisma.InputJsonValue
          }),
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
