/**
 * Keys to exclude when displaying metadata keyFacts (Address confidence, External ID, Created, Updated, etc.)
 */
const LEGACY_KEY_PATTERNS = [
  'external',
  'confidence',
  'latitude',
  'longitude',
  'created',
  'updated',
  'addressconfidence',
  'address_confidence',
  'addressconfidencelevel',
  'externalid'
];

export function isLegacyMetadataKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[\s_-]/g, '');
  if (lower.includes('address') && lower.includes('confidence')) return true;
  return LEGACY_KEY_PATTERNS.some(
    (pattern) => lower.includes(pattern) || lower === pattern
  );
}

export function filterLegacyKeyFacts(
  keyFacts: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!keyFacts || typeof keyFacts !== 'object') return {};
  return Object.fromEntries(
    Object.entries(keyFacts).filter(([k]) => !isLegacyMetadataKey(k))
  );
}
