"use client";
import mapboxgl from "mapbox-gl";
import * as React from "react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Target = { id: string; company: string; latitude?: string|number|null; longitude?: string|number|null };

export default function GeoMap({ targets }: { targets: Target[] }) {
  const el = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<mapboxgl.Map|null>(null);

  React.useEffect(() => {
    if (!el.current || mapRef.current) return;
    mapRef.current = new mapboxgl.Map({
      container: el.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-86.7816, 36.1627],
      zoom: 4,
    });
    return () => mapRef.current?.remove();
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    (map as any)._markers?.forEach((m: mapboxgl.Marker) => m.remove());
    (map as any)._markers = [];

    const pts = targets
      .map(t => {
        const lat = t.latitude != null ? Number(t.latitude) : NaN;
        const lon = t.longitude != null ? Number(t.longitude) : NaN;
        if (Number.isFinite(lat) && Number.isFinite(lon)) return { id: t.id, title: t.company, coord: [lon, lat] as [number, number] };
        return null;
      })
      .filter(Boolean) as Array<{ id: string; title: string; coord: [number, number] }>;

    if (pts.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    pts.forEach(p => {
      bounds.extend(p.coord);
      const mk = new mapboxgl.Marker({ color: "#2563eb" })
        .setLngLat(p.coord)
        .setPopup(new mapboxgl.Popup().setHTML(`<b>${p.title}</b>`))
        .addTo(map);
      (map as any)._markers.push(mk);
    });
    map.fitBounds(bounds, { padding: 60, duration: 0 });
  }, [JSON.stringify(targets.map(t => `${t.latitude},${t.longitude}`))]);

  return <div ref={el} className="h-[420px] w-full rounded border" />;
}
