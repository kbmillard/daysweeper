"use client";
import * as React from "react";
import mapboxgl, { Map, MapLayerMouseEvent, GeoJSONSource, LngLatLike } from "mapbox-gl";
import NewStopDialog from "./NewStopDialog";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

type Stop = { id: string; seq: number; target: { id: string; company: string; addressRaw?: string | null; latitude?: string | number | null; longitude?: string | number | null } };
type Route = { id: string; name?: string; stops: Stop[] };
type SearchItem = { id: string; company: string; addressRaw?: string; latitude?: string; longitude?: string };

export default function RouteMapInteractive({ route, routeId }: { route: Route; routeId: string }) {
  const outerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<Map | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // controls state
  const [search, setSearch] = React.useState("");
  const [suggest, setSuggest] = React.useState<SearchItem[]>([]);
  const [drop, setDrop] = React.useState(false);
  const dropRef = React.useRef(false);
  React.useEffect(() => { dropRef.current = drop; }, [drop]);

  // dialog
  const [draftPin, setDraftPin] = React.useState<{ lat: number; lon: number } | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [drawing, setDrawing] = React.useState(false);

  // coords for polyline
  const coords = React.useMemo(() => {
    const pts: [number, number][] = [];
    for (const s of route.stops) {
      const lat = s.target.latitude ? Number(s.target.latitude) : NaN;
      const lon = s.target.longitude ? Number(s.target.longitude) : NaN;
      if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push([lon, lat]);
    }
    return pts;
  }, [route]);

  const features = React.useMemo(() => {
    const fc: any = { type: "FeatureCollection", features: [] };
    for (const s of route.stops) {
      const lat = s.target.latitude ? Number(s.target.latitude) : NaN;
      const lon = s.target.longitude ? Number(s.target.longitude) : NaN;
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        fc.features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: { stopId: s.id, targetId: s.target.id, title: s.target.company, seq: s.seq }
        });
      }
    }
    return fc;
  }, [route]);

  // init map
  React.useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-96.8, 37.8],
      zoom: 3.7
    });
    mapRef.current = m;

    m.on("load", () => {
      // stops source & layers
      m.addSource("stops", { type: "geojson", data: features, cluster: true, clusterRadius: 40, clusterMaxZoom: 14 });
      m.addLayer({
        id: "clusters", type: "circle", source: "stops", filter: ["has", "point_count"],
        paint: { "circle-color": "#3b82f6", "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28] }
      });
      m.addLayer({
        id: "cluster-count", type: "symbol", source: "stops", filter: ["has", "point_count"],
        layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 }, paint: { "text-color": "#fff" }
      });
      m.addLayer({
        id: "unclustered", type: "circle", source: "stops", filter: ["!has", "point_count"],
        paint: { "circle-color": "#60a5fa", "circle-radius": 6, "circle-stroke-width": 1.2, "circle-stroke-color": "#fff" }
      });

      // directions line
      m.addSource("route-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "route-line-layer", type: "line", source: "route-line",
        paint: { "line-color": "#22c55e", "line-width": 4, "line-opacity": 0.9 }
      });

      // cluster expand
      m.on("click", "clusters", (e: any) => {
        const clusterId = e.features[0].properties.cluster_id;
        const src = m.getSource("stops") as any;
        src.getClusterExpansionZoom(clusterId, (err: number, zoom: number) => {
          if (err) return;
          m.easeTo({ center: (e as any).lngLat, zoom });
        });
      });

      // point popup
      m.on("click", "unclustered", (e: MapLayerMouseEvent) => {
        const f = e.features?.[0]; if (!f) return;
        const { title, targetId, seq } = f.properties as any;
        const [lon, lat] = (f.geometry as any).coordinates;
        new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
          .setLngLat([lon, lat] as [number, number])
          .setHTML(`
            <div style="font-family:ui-sans-serif;min-width:220px">
              <div style="font-weight:600">${title}</div>
              <div style="font-size:12px;color:#6b7280">Stop #${seq}</div>
              <div style="margin-top:8px;display:flex;gap:8px;">
                <a href="/dashboard/companies/${targetId}" class="px-2 py-1 border rounded text-sm">Open company</a>
              </div>
            </div>
          `)
          .addTo(m);
      });

      // drop-pin click
      m.on("click", (e) => {
        if (!dropRef.current) return;
        setDraftPin({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        setNewOpen(true);
      });
    });

    return () => { m.remove(); mapRef.current = null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update point source
  React.useEffect(() => {
    const m = mapRef.current;
    const src = m?.getSource("stops") as GeoJSONSource | undefined;
    if (m && src) src.setData(features as any);
  }, [features]);

  // true polyline via Directions
  const drawDirections = async () => {
    if (coords.length < 2) return;
    try {
      setDrawing(true);
      const query = coords.map(c => c.join(",")).join(";");
      const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${query}`);
      url.searchParams.set("overview", "full");
      url.searchParams.set("geometries", "geojson");
      url.searchParams.set("access_token", mapboxgl.accessToken!);
      const j = await fetch(url.toString()).then(r => r.json());
      const line = j?.routes?.[0]?.geometry;
      const m = mapRef.current; if (!m) return;
      const src = m.getSource("route-line") as GeoJSONSource;
      if (line) src.setData({ type: "Feature", geometry: line, properties: {} } as any);
      // fit to bounds
      const bbox = bboxFor(line);
      if (bbox) m.fitBounds(bbox as any, { padding: 50, duration: 350 });
    } finally { setDrawing(false); }
  };

  // auto-draw on stop changes
  React.useEffect(() => {
    if (coords.length >= 2) drawDirections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.map(c => c.join(",")).join(";")]);

  // Listen for redraw keyboard shortcut
  React.useEffect(() => {
    const handler = () => {
      if (coords.length >= 2) drawDirections();
    };
    window.addEventListener("route:redraw", handler);
    return () => window.removeEventListener("route:redraw", handler);
  }, [coords]);

  // bbox helper
  const bboxFor = (line: any) => {
    if (!line) return null;
    const c = line.coordinates || [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    c.forEach((p: [number, number]) => { const [x, y] = p; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; });
    return [minX, minY, maxX, maxY];
  };

  // type-ahead (no auto-populate; click to choose)
  React.useEffect(() => {
    if (search.trim().length < 2) { setSuggest([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/targets/search?q=${encodeURIComponent(search)}&limit=20`)
        .then(r => r.json()).catch(() => ({ items: [] }));
      setSuggest(r.items || []);
    }, 170);
    return () => clearTimeout(t);
  }, [search]);

  // CLICKABILITY FIX: wrapper has pointer-events:none; inner controls re-enable
  return (
    <div ref={outerRef} className="relative w-full">
      {/* controls wrapper: disable pointer to let map receive clicks by default */}
      <div className="absolute z-[100] left-3 top-3 flex gap-2 items-start"
        style={{ pointerEvents: "none" }}>
        {/* search bubble */}
        <div className="relative" style={{ pointerEvents: "auto" }}>
          <input
            data-route-search
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company or address…"
            className="px-3 py-2 rounded-2xl shadow border bg-white/90 dark:bg-neutral-900/90 backdrop-blur w-80"
          />
          {suggest.length > 0 && (
            <div className="absolute mt-1 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border w-full max-h-72 overflow-auto">
              {suggest.map((s: SearchItem) => (
                <div key={s.id}
                  className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer"
                  onClick={async () => {
                    setSuggest([]);
                    setSearch(s.company);
                    const m = mapRef.current;
                    const lat = s.latitude ? Number(s.latitude) : null;
                    const lon = s.longitude ? Number(s.longitude) : null;
                    if (m && lat != null && lon != null) {
                      m.easeTo({ center: [lon, lat] as LngLatLike, zoom: 14 });
                      new mapboxgl.Popup()
                        .setLngLat([lon, lat] as [number, number])
                        .setHTML(`<div style="font-weight:600">${s.company}</div>
                                     <div style="font-size:12px;color:#6b7280">${s.addressRaw || ""}</div>
                                     <div style="margin-top:8px">
                                       <a class="px-2 py-1 border rounded text-sm" href="/dashboard/companies/${s.id}">Open company</a>
                                       <button id="add-${s.id}" class="px-2 py-1 bg-blue-600 text-white rounded text-sm" style="margin-left:8px">Add to route</button>
                                     </div>`)
                        .addTo(m);
                      // append handler
                      setTimeout(() => {
                        const btn = document.getElementById(`add-${s.id}`);
                        if (btn) btn.onclick = async () => {
                          await fetch(`/api/routes/${routeId}/stops/append`, {
                            method: "POST", headers: { "content-type": "application/json" },
                            body: JSON.stringify({ targetId: s.id })
                          }).then(() => window.dispatchEvent(new Event("route:refresh")));
                        };
                      }, 0);
                    }
                  }}>
                  <div className="text-sm font-medium">{s.company}</div>
                  {s.addressRaw && <div className="text-xs text-gray-500">{s.addressRaw}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* drop-pin toggle */}
        <div style={{ pointerEvents: "auto" }}>
          <button
            className={`px-3 py-2 rounded-2xl border shadow bg-white/90 dark:bg-neutral-900/90 backdrop-blur text-sm ${drop ? "border-blue-600" : ""}`}
            onClick={() => setDrop(v => !v)}
            title="Click map to drop a pin">
            {drop ? "Tap map…" : "➕ Pin"}
          </button>
        </div>

        {/* manual draw button */}
        <div style={{ pointerEvents: "auto" }}>
          <button className="px-3 py-2 rounded-2xl border shadow bg-white/90 dark:bg-neutral-900/90 backdrop-blur text-sm"
            onClick={drawDirections} disabled={drawing}>
            {drawing ? "Drawing…" : "Draw Route"}
          </button>
        </div>
      </div>

      {/* the map */}
      <div ref={containerRef} className="h-[520px] w-full rounded-md overflow-hidden" />

      {/* new company dialog from pin */}
      <NewStopDialog
        open={newOpen}
        onClose={() => { setNewOpen(false); setDraftPin(null); }}
        lat={draftPin?.lat ?? 0}
        lon={draftPin?.lon ?? 0}
        routeId={routeId}
      />
    </div>
  );
}
