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

/**
 * Parse DMS (degrees minutes seconds) coordinates from Google Earth format.
 * Example: 42°04'17.96"N 88°17'47.01"W
 * Returns { lat, lng } in decimal degrees or null if unparseable.
 */
export function parseDmsCoordinates(text: string): { lat: number; lng: number } | null {
  const t = text.trim();
  if (!t) return null;

  // Match DMS: degrees°minutes'seconds"N/S or E/W (supports ° ' " and unicode ′ ″).
  // No `g` flag — we only need the first lat / first lng match; `g` + module-level `.exec` is error-prone.
  const dms =
    /(-?\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?\s*([NS])/i;
  const dmsLng =
    /(-?\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?\s*([EW])/i;

  const toDecimal = (d: number, m: number, s: number, dir: string): number => {
    const dec = Math.abs(d) + m / 60 + s / 3600;
    if (/^[SW]$/i.test(dir)) return -dec;
    return dec;
  };

  const latMatch = dms.exec(t);
  const lngMatch = dmsLng.exec(t);

  if (!latMatch || !lngMatch) return null;

  const lat = toDecimal(
    Number(latMatch[1]),
    Number(latMatch[2]),
    Number(latMatch[3]),
    latMatch[4]
  );
  const lng = toDecimal(
    Number(lngMatch[1]),
    Number(lngMatch[2]),
    Number(lngMatch[3]),
    lngMatch[4]
  );

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Parsed address components from Google Geocoding API response */
export type ParsedAddressComponents = {
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

/** US state/territory abbreviations → long names (autofill matches form labels like "Michigan"). */
export const US_STATE_ABBREV_TO_NAME: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  AS: 'American Samoa',
  GU: 'Guam',
  MP: 'Northern Mariana Islands',
  PR: 'Puerto Rico',
  VI: 'U.S. Virgin Islands'
};

/**
 * Parse trailing US mailing line: "…, City, ST ZIP" or "…, City, State ZIP" (optional ", US").
 * When this matches, prefer these components over geocoder "city" (often township/CDP mismatch).
 */
export function parseUsMailingFromAddress(raw: string): ParsedAddressComponents | null {
  let s = normalizeAddressForGeocode(raw).trim();
  if (!s) return null;
  s = s.replace(/,\s*(US|USA)\s*$/i, '').trim();

  const zipMatch = s.match(/\b(\d{5})(?:-(\d{4}))?\s*$/);
  if (!zipMatch || zipMatch.index === undefined) return null;
  const postal_code = zipMatch[1] + (zipMatch[2] ? `-${zipMatch[2]}` : '');
  let head = s.slice(0, zipMatch.index).replace(/[\s,]+$/g, '').trim();
  if (!head) return null;

  const stateAbbrMatch = head.match(/,\s*([A-Za-z]{2})\s*$/);
  if (stateAbbrMatch && stateAbbrMatch.index !== undefined) {
    const abbr = stateAbbrMatch[1].toUpperCase();
    const state = US_STATE_ABBREV_TO_NAME[abbr];
    if (!state) return null;
    head = head.slice(0, stateAbbrMatch.index).trim();
    const cityComma = head.match(/,\s*([^,]+)\s*$/);
    const city = cityComma ? cityComma[1].trim() : head;
    if (!city || city.length > 120) return null;
    return { city, state, postal_code, country: 'US' };
  }

  for (const stateName of Object.values(US_STATE_ABBREV_TO_NAME)) {
    const esc = stateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`,\\s*${esc}\\s*$`, 'i');
    const m = head.match(re);
    if (m && m.index !== undefined) {
      const before = head.slice(0, m.index).trim();
      const cityComma = before.match(/,\s*([^,]+)\s*$/);
      const city = cityComma ? cityComma[1].trim() : before;
      if (!city || city.length > 120) return null;
      return { city, state: stateName, postal_code, country: 'US' };
    }
  }

  return null;
}

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
