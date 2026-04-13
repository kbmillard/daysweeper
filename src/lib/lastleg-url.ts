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

/**
 * Deep link: iOS should fetch `GET {baseUrl}/api/routes/{routeId}/lastleg` (same auth as /api/targets)
 * and add the payload to a local "planned routes" list — without replacing the user's active run until they choose it.
 */
export function buildLastLegPlannedRouteUrl(params: { routeId: string; baseUrl: string }): string {
  const origin = params.baseUrl.replace(/\/$/, '');
  const search = new URLSearchParams();
  search.set('routeId', params.routeId);
  search.set('baseUrl', origin);
  return `${SCHEME}://planned-route?${search.toString()}`;
}

/** Opens planned-route URL on mobile only; no-op on desktop (use copy / manual open). */
export function safeOpenLastLegPlannedRoute(routeId: string, baseUrl: string): void {
  if (typeof window === 'undefined') return;
  const ua = navigator.userAgent ?? '';
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.maxTouchPoints ?? 0) > 0;
  if (!isMobile) return;
  try {
    const url = buildLastLegPlannedRouteUrl({ routeId, baseUrl });
    setTimeout(() => {
      window.location.href = url;
    }, 400);
  } catch {
    // ignore
  }
}

/** Only attempt to open LastLeg app on mobile (iOS/Android); safe no-op on desktop. */
export function safeOpenLastLegApp(): void {
  if (typeof window === 'undefined') return;
  const ua = navigator.userAgent ?? '';
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.maxTouchPoints ?? 0) > 0;
  if (!isMobile) return;
  try {
    const url = buildLastLegOpenUrl();
    setTimeout(() => {
      window.location.href = url;
    }, 400);
  } catch {
    // ignore
  }
}
