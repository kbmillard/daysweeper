/**
 * Load Google Maps JavaScript API via script tag (no @googlemaps/js-api-loader).
 * Key is inlined so the "not configured" error cannot happen from this loader.
 */
const GOOGLE_MAPS_KEY =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()) ||
  'AIzaSyCAewdmKcmRjR3TmgwDnO-e3dTTgw8rOm8';

let loadPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser'));
  }
  if (typeof globalThis.google !== 'undefined' && globalThis.google.maps) {
    return Promise.resolve(globalThis.google);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<typeof google>((resolve, reject) => {
    const key = GOOGLE_MAPS_KEY;
    const id = 'google-maps-script';
    const existing = document.getElementById(id);
    if (existing) {
      const wait = (n: number): void => {
        if (globalThis.google?.maps) resolve(globalThis.google);
        else if (n < 100) setTimeout(() => wait(n + 1), 100);
        else reject(new Error('Google Maps failed to load'));
      };
      wait(0);
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (globalThis.google?.maps) resolve(globalThis.google);
      else reject(new Error('Google Maps failed to load'));
    };
    script.onerror = () => reject(new Error('Google Maps script failed to load'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export const GOOGLE_MAPS_ERROR_MESSAGE =
  'Google Maps not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY in Vercel (or .env.local).';
