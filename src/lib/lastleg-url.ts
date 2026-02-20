/**
 * Build URL to open LastLeg iOS app for geocoding.
 * LastLeg must register this URL scheme in Info.plist (e.g. lastleg).
 * Set NEXT_PUBLIC_LASTLEG_URL_SCHEME to override (default: lastleg).
 */
const SCHEME = process.env.NEXT_PUBLIC_LASTLEG_URL_SCHEME || 'lastleg';

export function buildLastLegGeocodeUrl(params: {
  locationId: string;
  addressRaw: string;
  companyId?: string;
  baseUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  const search = new URLSearchParams();
  search.set('locationId', params.locationId);
  search.set('addressRaw', params.addressRaw);
  if (params.companyId) search.set('companyId', params.companyId);
  if (params.baseUrl) search.set('baseUrl', params.baseUrl);
  if (params.latitude != null && !Number.isNaN(params.latitude))
    search.set('latitude', String(params.latitude));
  if (params.longitude != null && !Number.isNaN(params.longitude))
    search.set('longitude', String(params.longitude));
  return `${SCHEME}://geocode?${search.toString()}`;
}

export function buildLastLegOpenUrl(): string {
  return `${SCHEME}://`;
}
