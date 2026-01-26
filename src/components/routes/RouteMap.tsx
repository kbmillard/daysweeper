"use client";

import mapboxgl from "mapbox-gl";
import * as React from "react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Stop = { id: string; company: string; latitude?: number | string | null; longitude?: number | string | null; addressRaw?: string | null };

export default function RouteMap({ stops }: { stops: Stop[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<mapboxgl.Map | null>(null);

  React.useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const m = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-86.7816, 36.1627], // default center (Nashville)
      zoom: 5,
    });
    mapRef.current = m;
    return () => m.remove();
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // clear previous markers/layers
    (map as any)._routeMarkers?.forEach((mk: mapboxgl.Marker) => mk.remove());
    (map as any)._routeMarkers = [];

    const pts = stops
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({ id: s.id, company: s.company, coord: [Number(s.longitude), Number(s.latitude)] as [number, number] }));

    if (pts.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    pts.forEach((p) => {
      bounds.extend(p.coord);
      const el = document.createElement("div");
      el.className = "rounded-full bg-blue-600/90 text-white text-[10px] px-2 py-1 shadow";
      el.textContent = "●";
      const mk = new mapboxgl.Marker(el).setLngLat(p.coord).setPopup(new mapboxgl.Popup().setHTML(`<b>${p.company}</b>`)).addTo(map);
      (map as any)._routeMarkers.push(mk);
    });
    map.fitBounds(bounds, { padding: 60, duration: 0 });

    // polyline
    const geojson = {
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: pts.map((p) => p.coord) },
      properties: {},
    };
    if (map.getSource("route-line")) {
      (map.getSource("route-line") as mapboxgl.GeoJSONSource).setData(geojson as any);
    } else {
      map.addSource("route-line", { type: "geojson", data: geojson as any });
      map.addLayer({
        id: "route-line-layer",
        type: "line",
        source: "route-line",
        paint: { "line-color": "#2563eb", "line-width": 3 },
      });
    }
  }, [stops.map((s) => `${s.latitude},${s.longitude}`).join("|")]);

  return <div ref={ref} className="h-[420px] w-full rounded-lg border" />;
}
