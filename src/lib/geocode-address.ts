/**
 * Normalize address for geocoding. Strips suite/unit/floor suffixes
 * that often cause geocoders (Nominatim, Apple, etc.) to fail.
 */
export function normalizeAddressForGeocode(address: string | null | undefined): string {
  if (!address || typeof address !== 'string') return '';
  let s = address
    .trim()
    .replace(/\s*-\s*Suite\s+\d+/gi, '')
    .replace(/,?\s*Suite\s+\d+/gi, '')
    .replace(/,?\s*Unit\s+\d+/gi, '')
    .replace(/,?\s*Ste\.?\s*\d+/gi, '')
    .replace(/\s*#\s*\d+/gi, '')
    .replace(/,?\s*Floor\s+\d+/gi, '')
    .replace(/,?\s*Fl\.?\s*\d+/gi, '')
    .replace(/,?\s*Bldg\.?\s*\w+/gi, '');
  return s.replace(/\s*,\s*,/g, ',').replace(/^\s*,|,\s*$/g, '').trim();
}
