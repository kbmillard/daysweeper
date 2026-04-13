/** Reads `metadata.productType` set on company detail (string). */
export function productTypeFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const pt = (metadata as Record<string, unknown>).productType;
  return typeof pt === 'string' && pt.trim() !== '' ? pt.trim() : '';
}
