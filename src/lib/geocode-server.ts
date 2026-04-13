/**
 * Server-side geocoding. Nominatim first, then Mapbox. No Google.
 * Use when creating or updating a location so new addresses get lat/lng automatically.
 */
import {
  normalizeAddressForGeocode,
  parseUsMailingFromAddress,
  type ParsedAddressComponents
} from './geocode-address';

function mapboxToken(): string | undefined {
  return (
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_SECRET_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  );
}

/** Prefer city/state/ZIP from the typed US mailing line; keep geocoder lat/lng + normalized label. */
function applyUsMailingOverride(originalAddress: string, result: GeocodeResult): GeocodeResult {
  const parsed = parseUsMailingFromAddress(originalAddress);
  if (!parsed) return result;
  return {
    ...result,
    addressComponents: {
      city: parsed.city,
      state: parsed.state,
      postal_code: parsed.postal_code,
      country: parsed.country ?? result.addressComponents?.country
    }
  };
}

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  addressNormalized?: string;
  addressComponents?: ParsedAddressComponents | null;
};

const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? 'Daysweeper/1.0';

/** Nominatim (OpenStreetMap) geocoding. No API key. */
async function geocodeWithNominatim(address: string): Promise<GeocodeResult | null> {
  if (!address.trim()) return null;

  const normalized = normalizeAddressForGeocode(address);
  if (!normalized) return null;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', normalized);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': NOMINATIM_USER_AGENT }
  });
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      hamlet?: string;
      municipality?: string;
      suburb?: string;
      neighbourhood?: string;
      county?: string;
      borough?: string;
      state?: string;
      postcode?: string;
      country_code?: string;
      country?: string;
    };
  }>;

  const first = data?.[0];
  if (!first?.lat || !first?.lon) return null;

  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

  let addressComponents: ParsedAddressComponents | undefined;
  const addr = first.address;
  if (addr && typeof addr === 'object') {
    const city =
      addr.city ??
      addr.town ??
      addr.village ??
      addr.hamlet ??
      addr.municipality ??
      addr.suburb ??
      addr.neighbourhood;
    const country = addr.country_code?.toUpperCase() ?? addr.country;
    if (city || addr.state || addr.postcode || country) {
      addressComponents = {
        ...(city && { city }),
        ...(addr.state && { state: addr.state }),
        ...(addr.postcode && { postal_code: addr.postcode }),
        ...(country && { country })
      };
    }
  }

  return {
    latitude: lat,
    longitude: lon,
    ...(first.display_name && { addressNormalized: first.display_name }),
    ...(addressComponents && { addressComponents })
  };
}

/** Mapbox Geocoding v5: forward geocode. Returns [lng, lat] in center. */
async function geocodeWithMapbox(address: string): Promise<GeocodeResult | null> {
  const token =
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_SECRET_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !address.trim()) return null;

  const normalized = normalizeAddressForGeocode(address);
  if (!normalized) return null;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalized)}.json`
  );
  url.searchParams.set('access_token', token);
  url.searchParams.set('limit', '1');
  url.searchParams.set('types', 'address,place,locality,postcode,region,country');

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const json = (await res.json()) as {
    features?: Array<{ center?: [number, number]; place_name?: string; context?: Array<{ id: string; text: string }> }>;
  };
  const feature = json.features?.[0];
  if (!feature?.center || feature.center.length < 2) return null;

  const [lng, lat] = feature.center;
  const placeName = feature.place_name;

  let addressComponents: ParsedAddressComponents | undefined;
  const placeFirst =
    typeof feature.place_name === 'string'
      ? feature.place_name.split(',')[0]?.trim() || undefined
      : undefined;
  if (Array.isArray(feature.context) && feature.context.length > 0) {
    const ctx = feature.context as Array<{ id: string; text: string }>;
    const get = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix))?.text;
    addressComponents = {
      city: get('place') ?? get('locality') ?? placeFirst,
      state: get('region'),
      postal_code: get('postcode'),
      country: get('country')
    };
    if (!addressComponents.city && !addressComponents.state && !addressComponents.postal_code && !addressComponents.country) {
      addressComponents = undefined;
    }
  } else if (placeFirst) {
    addressComponents = { city: placeFirst };
  }

  return {
    latitude: lat,
    longitude: lng,
    ...(placeName && { addressNormalized: placeName }),
    ...(addressComponents && { addressComponents })
  };
}

/** Google address_components helper. */
function parseGoogleAddressComponents(
  components: Array<{ long_name: string; short_name: string; types: string[] }> | undefined
): ParsedAddressComponents | undefined {
  if (!Array.isArray(components) || components.length === 0) return undefined;
  const get = (type: string) => components.find((c) => c.types?.includes(type))?.long_name;
  const city = get('locality') ?? get('sublocality') ?? get('administrative_area_level_2');
  const state = get('administrative_area_level_1');
  const postal_code = get('postal_code');
  const country = get('country');
  if (!city && !state && !postal_code && !country) return undefined;
  return {
    ...(city && { city }),
    ...(state && { state }),
    ...(postal_code && { postal_code }),
    ...(country && { country })
  };
}

/** Google Geocoding API fallback (requires GOOGLE_MAPS_API_KEY). */
async function geocodeWithGoogle(address: string): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key?.trim()) return null;

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const json = (await res.json()) as { status: string; results?: Array<{
    geometry?: { location?: { lat: number; lng: number } };
    formatted_address?: string;
    address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
  }> };
  if (json.status !== 'OK' || !json.results?.length) return null;

  const r = json.results[0];
  const loc = r.geometry?.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;

  const addressComponents = parseGoogleAddressComponents(r.address_components);
  return {
    latitude: loc.lat,
    longitude: loc.lng,
    ...(r.formatted_address && { addressNormalized: r.formatted_address }),
    ...(addressComponents && { addressComponents })
  };
}

/**
 * Geocode an address on the server. Nominatim first, then Mapbox, then Google.
 * Returns null if geocoding fails for all.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address?.trim();
  if (!trimmed) return null;

  const finish = (r: GeocodeResult | null) => (r ? applyUsMailingOverride(trimmed, r) : null);

  const usMailing = parseUsMailingFromAddress(trimmed);
  const token = mapboxToken();

  // US addresses with a clear "City, ST ZIP" tail: Mapbox tends to hit the street; Nominatim often returns township as "city".
  if (usMailing && token) {
    const mapboxFirst = await geocodeWithMapbox(trimmed);
    if (mapboxFirst) return finish(mapboxFirst);
  }

  const nominatim = await geocodeWithNominatim(trimmed);
  if (nominatim) return finish(nominatim);

  if (!usMailing || !token) {
    const mapbox = await geocodeWithMapbox(trimmed);
    if (mapbox) return finish(mapbox);
  }

  const google = await geocodeWithGoogle(trimmed);
  if (google) return finish(google);

  return null;
}
