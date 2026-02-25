/**
 * Load Google Maps JavaScript API via script tag (no @googlemaps/js-api-loader).
 * Key is inlined so the "not configured" error cannot happen from this loader.
 */
const GOOGLE_MAPS_KEY =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()) ||
  'AIzaSyCAewdmKcmRjR3TmgwDnO-e3dTTgw8rOm8';

// Null when not yet started or after a failure (so we retry on next call).
// Set to a resolved promise once Maps is confirmed loaded.
let loadPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser'));
  }
  // Already loaded — fast path
  if (typeof globalThis.google !== 'undefined' && globalThis.google?.maps) {
    return Promise.resolve(globalThis.google);
  }
  // In-flight — reuse
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<typeof google>((resolve, reject) => {
    const key = GOOGLE_MAPS_KEY;
    const id = 'google-maps-script';
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      // Script tag exists but google may not be ready yet — poll
      const wait = (n: number): void => {
        if (globalThis.google?.maps) { resolve(globalThis.google); return; }
        if (n < 150) { setTimeout(() => wait(n + 1), 100); return; }
        reject(new Error('Google Maps timed out'));
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
      else reject(new Error('Google Maps loaded but google.maps missing'));
    };
    script.onerror = () => {
      // Remove the failed script so a retry can re-add it
      try { document.head.removeChild(script); } catch { /* ignore */ }
      reject(new Error('Google Maps script failed to load'));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    // Reset so the next caller can try again instead of getting a cached rejection
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

export const GOOGLE_MAPS_ERROR_MESSAGE =
  'Google Maps not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY in Vercel (or .env.local).';
