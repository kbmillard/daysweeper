'use client';

/**
 * Client-side geocoding via Apple MapKit JS (browser). Server route planner no longer geocodes addresses.
 */

const MAPKIT_SCRIPT = 'https://cdn.apple-mapkit.com/mk/v5/full/mapkit.js';

type MapKitCoordinate = { latitude: number; longitude: number };
type GeocoderCb = (
  err: Error | null,
  data: { results: Array<{ coordinate: MapKitCoordinate }> } | null
) => void;

type AutocompleteCb = (
  err: Error | null,
  data: { results?: Array<{ displayLines?: string[] }> } | null
) => void;

type MapKitSearchInstance = {
  autocomplete: (query: string, callback: AutocompleteCb, options?: Record<string, unknown>) => number;
  cancel?: (requestId: number) => void;
};

type MapKitGlobal = {
  init: (opts: { authorizationCallback: (done: (token: string) => void) => void }) => void;
  Geocoder: new (opts?: { language?: string; getsUserLocation?: boolean }) => {
    lookup: (place: string, cb: GeocoderCb) => void;
  };
  Search?: new (opts?: Record<string, unknown>) => MapKitSearchInstance;
};

function getMapKit(): MapKitGlobal {
  const mk = (typeof window !== 'undefined' ? window : undefined) as unknown as {
    mapkit?: MapKitGlobal;
  } | undefined;
  if (!mk?.mapkit) throw new Error('MapKit not loaded');
  return mk.mapkit;
}

function loadMapKitScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  const w = window as unknown as { mapkit?: MapKitGlobal };
  if (w.mapkit) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${MAPKIT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('MapKit script error')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = MAPKIT_SCRIPT;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load MapKit JS'));
    document.head.appendChild(s);
  });
}

let initPromise: Promise<void> | null = null;

export async function ensureMapKitInitialized(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await loadMapKitScript();
    const tokenRes = await fetch('/api/mapkit-js/token', { credentials: 'include' });
    if (!tokenRes.ok) {
      const j = (await tokenRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? `MapKit token HTTP ${tokenRes.status}`);
    }
    const token = await tokenRes.text();
    getMapKit().init({
      authorizationCallback(done: (t: string) => void) {
        done(token);
      }
    });
  })();
  return initPromise;
}

/** Parse `lat, lng` (same as LastLeg iOS). */
export function tryParseLatLng(text: string): { lat: number; lng: number } | null {
  const parts = text.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Forward geocode with Apple MapKit JS (must run in browser). */
export async function geocodeWithAppleMapKit(address: string): Promise<{ lat: number; lng: number }> {
  const q = address.trim();
  if (!q) throw new Error('Empty address');
  const direct = tryParseLatLng(q);
  if (direct) return direct;

  await ensureMapKitInitialized();
  const Geocoder = getMapKit().Geocoder;
  const geocoder = new Geocoder({ language: 'en-US', getsUserLocation: true });

  return new Promise((resolve, reject) => {
    geocoder.lookup(q, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const r = data?.results?.[0];
      if (!r?.coordinate) {
        reject(new Error(`No Apple Maps match for “${q.slice(0, 60)}”`));
        return;
      }
      resolve({
        lat: r.coordinate.latitude,
        lng: r.coordinate.longitude
      });
    });
  });
}

export type MapKitAddressSuggestion = {
  /** Primary line shown in the dropdown */
  title: string;
  /** String passed to Geocoder.lookup when user picks this row */
  geocodeQuery: string;
};

/**
 * MapKit JS Search.autocomplete (Apple Maps). Requires MapKit token + full bundle.
 * Returns up to `maxResults` rows; empty if query is short or Search is unavailable.
 */
export async function fetchMapKitAddressSuggestions(
  query: string,
  maxResults = 6
): Promise<MapKitAddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  await ensureMapKitInitialized();
  const mk = getMapKit();
  const SearchCtor = mk.Search;
  if (!SearchCtor) return [];

  const search = new SearchCtor({
    language: 'en-US',
    getsUserLocation: false
  });

  return new Promise((resolve, reject) => {
    try {
      search.autocomplete(
        q,
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          const results = data?.results ?? [];
          const out: MapKitAddressSuggestion[] = [];
          for (const row of results) {
            if (out.length >= maxResults) break;
            const lines = Array.isArray(row.displayLines)
              ? row.displayLines.map((s) => String(s).trim()).filter(Boolean)
              : [];
            if (lines.length === 0) continue;
            const title = lines[0] ?? '';
            const geocodeQuery = lines.join(', ');
            if (title) out.push({ title, geocodeQuery });
          }
          resolve(out);
        },
        {
          language: 'en-US',
          includeAddresses: true,
          includePointsOfInterest: true
        }
      );
    } catch (e) {
      reject(e instanceof Error ? e : new Error('MapKit autocomplete failed'));
    }
  });
}
