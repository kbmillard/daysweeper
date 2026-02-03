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

/** Valid latitude range for Mapbox/GeoJSON (WGS84). */
const LAT_MIN = -90;
const LAT_MAX = 90;
/** Valid longitude range for Mapbox/GeoJSON (WGS84). */
const LNG_MIN = -180;
const LNG_MAX = 180;

/**
 * Returns true if lat/lng are valid WGS84 coordinates for Mapbox/GeoJSON.
 * Use this to filter locations so only accurate geocodes are shown on the map.
 */
export function isValidMapboxCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return false;
  const la = Number(lat);
  const ln = Number(lng);
  return la >= LAT_MIN && la <= LAT_MAX && ln >= LNG_MIN && ln <= LNG_MAX;
}

/**
 * GeoJSON Point coordinates are [longitude, latitude]. Use for Mapbox.
 */
export function toMapboxCoordinates(lat: number | null | undefined, lng: number | null | undefined): [number, number] | null {
  if (!isValidMapboxCoordinate(lat, lng)) return null;
  return [Number(lng), Number(lat)];
}
