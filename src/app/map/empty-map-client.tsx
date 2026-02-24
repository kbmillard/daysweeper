'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const MAPBOX_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';
const DEFAULT_CENTER: [number, number] = [-98, 39];
const DEFAULT_ZOOM = 2;

type GeoJSONFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: string; companyId: string; addressRaw: string };
};

type GeoJSONResponse = {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
};

export default function EmptyMapClient() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token?.trim()) {
      setError('Mapbox token not configured (NEXT_PUBLIC_MAPBOX_TOKEN)');
      return;
    }
    if (!containerRef.current) return;

    let cancelled = false;

    void (async () => {
      let geojson: GeoJSONResponse = { type: 'FeatureCollection', features: [] };
      try {
        const res = await fetch('/api/locations/map');
        const data = await res.json();
        if (data?.features) geojson = data;
      } catch {
        // keep empty
      }
      if (cancelled || !containerRef.current) return;

      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAPBOX_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM
      });

      map.on('load', () => {
        if (cancelled) return;
        if (geojson.features.length > 0) {
          map.addSource('locations', { type: 'geojson', data: geojson });
          map.addLayer({
            id: 'locations-dots',
            type: 'circle',
            source: 'locations',
            paint: {
              'circle-radius': 6,
              'circle-color': '#22c55e',
              'circle-stroke-width': 1,
              'circle-stroke-color': '#fff'
            }
          });
          map.on('click', 'locations-dots', (e) => {
            const f = e.features?.[0];
            const companyId = f?.properties?.companyId;
            if (companyId) router.push(`/map/companies/${companyId}`);
          });
          map.on('mouseenter', 'locations-dots', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'locations-dots', () => {
            map.getCanvas().style.cursor = '';
          });
          const bounds = new mapboxgl.LngLatBounds();
          geojson.features.forEach((f) => bounds.extend(f.geometry.coordinates as [number, number]));
          if (geojson.features.length > 1) {
            map.fitBounds(bounds, { padding: 40, maxZoom: 10 });
          } else {
            map.setCenter(geojson.features[0].geometry.coordinates);
            map.setZoom(8);
          }
        }
        mapRef.current = map;
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex h-[100vh] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className="h-full min-h-[100vh] w-full" />;
}
