import { productTypeFromMetadata } from '@/lib/product-type-from-metadata';

/**
 * When a user saves the location detail page, we set suppressCompanyPrimarySync on Location.metadata
 * so PATCH /api/companies no longer overwrites contact fields until that location becomes HQ again.
 */
export function parseLocationMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
}

export function isCompanyPrimarySyncSuppressed(metadata: unknown): boolean {
  return parseLocationMetadata(metadata).suppressCompanyPrimarySync === true;
}

/** Clear or set the suppress flag; preserves other metadata keys. */
export function withCompanyPrimarySyncSuppressed(
  metadata: unknown,
  suppressed: boolean
): Record<string, unknown> {
  const m = parseLocationMetadata(metadata);
  if (suppressed) m.suppressCompanyPrimarySync = true;
  else delete m.suppressCompanyPrimarySync;
  return m;
}

/**
 * Mirror company product type into primary location JSON metadata (preserves other keys).
 * Pipeline status is never stored on Location.metadata for HQ — it lives only on Company.status
 * so non-primary sites can keep an independent Location.metadata.status.
 */
export function mergePrimaryLocationMirrorMetadata(
  locationMetadata: unknown,
  company: { metadata: unknown },
  options: { clearSuppress: boolean }
): Record<string, unknown> {
  const m = parseLocationMetadata(locationMetadata);
  if (options.clearSuppress) delete m.suppressCompanyPrimarySync;

  delete m.status;

  const pt = productTypeFromMetadata(company.metadata);
  if (pt) m.productType = pt;
  else delete m.productType;

  return m;
}
