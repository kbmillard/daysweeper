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

/** Parsed address components from Google Geocoding API response */
export type ParsedAddressComponents = {
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

/**
 * Parse Google Geocoding API address_components into our format.
 */
export function parseGoogleAddressComponents(
  components: GoogleAddressComponent[] | null | undefined
): ParsedAddressComponents | null {
  if (!Array.isArray(components) || components.length === 0) return null;

  const get = (type: string, useShort = false) => {
    const c = components.find((c) => c.types.includes(type));
    return c ? (useShort ? c.short_name : c.long_name) : undefined;
  };

  const city = get('locality') ?? get('sublocality') ?? get('administrative_area_level_2');
  const state = get('administrative_area_level_1', true);
  const postal_code = get('postal_code');
  const country = get('country', true);

  if (!city && !state && !postal_code && !country) return null;
  return { city, state, postal_code, country };
}
