import { parseLocationMetadata } from '@/lib/location-primary-sync-metadata';

/** Pipeline label for map coloring: HQ uses company row status, other sites use location metadata. */
export function effectiveLocationCrmStatus(input: {
  locationId: string;
  companyStatus: string | null | undefined;
  companyPrimaryLocationId: string | null | undefined;
  locationMetadata: unknown;
}): string {
  const meta = parseLocationMetadata(input.locationMetadata);
  const fromMeta = typeof meta.status === 'string' ? meta.status.trim() : '';
  const isPrimary = Boolean(
    input.companyPrimaryLocationId && input.locationId === input.companyPrimaryLocationId
  );
  const fromCompany = typeof input.companyStatus === 'string' ? input.companyStatus.trim() : '';
  if (isPrimary) return fromCompany || fromMeta;
  return fromMeta;
}
