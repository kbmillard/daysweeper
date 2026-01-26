"use client";
import { loadMapKit } from "./mapkit-loader";

export async function appleGeocodeOne(query: string): Promise<{ lat: number, lon: number } | null> {
  const mk = await loadMapKit();
  return new Promise((resolve) => {
    const geocoder = new mk.Geocoder({ language: navigator.language || "en-US" });
    geocoder.lookup(query, (err: any, data: any) => {
      if (err || !data || !data.results || data.results.length === 0) return resolve(null);
      const item = data.results[0];
      // MapKit JS gives coordinates under item.coordinate.{latitude,longitude}
      const coord = item.coordinate || item.center || {};
      const lat = Number(coord.latitude);
      const lon = Number(coord.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return resolve({ lat, lon });
      resolve(null);
    });
  });
}

export async function appleGeocodeBatch(queries: Array<{ id: string, query: string }>): Promise<Array<{ id: string, lat: number, lon: number }>> {
  const out: Array<{ id: string, lat: number, lon: number }> = [];
  for (const q of queries) {
    const r = await appleGeocodeOne(q.query);
    if (r) out.push({ id: q.id, lat: r.lat, lon: r.lon });
  }
  return out;
}
