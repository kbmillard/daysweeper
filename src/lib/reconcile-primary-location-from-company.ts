import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  isCompanyPrimarySyncSuppressed,
  mergePrimaryLocationMirrorMetadata,
  parseLocationMetadata
} from '@/lib/location-primary-sync-metadata';

type CompanyRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  metadata: unknown;
  primaryLocationId: string | null;
};

type LocationRow = {
  id: string;
  companyId: string;
  locationName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  metadata: unknown;
};

/** When this location is the company HQ and sync is not suppressed, align row + mirror metadata from company. */
export function buildPrimaryLocationReconcilePatch(
  loc: LocationRow,
  company: CompanyRow
): Prisma.LocationUpdateInput | null {
  if (company.primaryLocationId !== loc.id) return null;
  if (isCompanyPrimarySyncSuppressed(loc.metadata)) return null;

  const mergedMeta = mergePrimaryLocationMirrorMetadata(
    loc.metadata,
    { metadata: company.metadata },
    { clearSuppress: false }
  );
  const sameMeta =
    JSON.stringify(parseLocationMetadata(loc.metadata)) === JSON.stringify(mergedMeta);

  const sameContact =
    (loc.locationName ?? null) === (company.name ?? null) &&
    (loc.phone ?? null) === (company.phone ?? null) &&
    (loc.email ?? null) === (company.email ?? null) &&
    (loc.website ?? null) === (company.website ?? null);

  if (sameContact && sameMeta) return null;

  return {
    locationName: company.name,
    phone: company.phone,
    email: company.email,
    website: company.website,
    metadata: mergedMeta as Prisma.InputJsonValue,
    updatedAt: new Date()
  };
}

/**
 * Idempotent: updates the location row from the parent company when it is primary HQ and not user-suppressed.
 * Call after loading location + company for the location detail page.
 */
export async function reconcilePrimaryLocationFromCompanyIfNeeded(
  locationId: string,
  companyId: string
): Promise<boolean> {
  const [loc, company] = await Promise.all([
    prisma.location.findUnique({
      where: { id: locationId },
      select: {
        id: true,
        companyId: true,
        locationName: true,
        phone: true,
        email: true,
        website: true,
        metadata: true
      }
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        website: true,
        metadata: true,
        primaryLocationId: true
      }
    })
  ]);

  if (!loc || !company || loc.companyId !== companyId) return false;

  const patch = buildPrimaryLocationReconcilePatch(loc, company);
  if (!patch) return false;

  await prisma.location.update({
    where: { id: locationId },
    data: patch
  });
  return true;
}
