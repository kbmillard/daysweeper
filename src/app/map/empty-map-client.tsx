'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { subscribeToLocationsMapUpdate } from '@/lib/locations-map-update';
import { loadGoogleMaps, GOOGLE_MAPS_ERROR_MESSAGE } from '@/lib/google-maps-loader';
import { addStateLines } from '@/lib/add-state-lines';
import { googleEarthUrl } from '@/lib/google-earth-url';
import { IconSearch } from '@tabler/icons-react';

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
}
function openLastLegApp(): void {
  try { setTimeout(() => { window.location.href = 'lastleg://'; }, 300); } catch { /* ignore */ }
}
// SVG data-URI pin — never flashes white on zoom (unlike SymbolPath.CIRCLE)
function svgPin(g: typeof google, color: string, size: number): google.maps.Icon {
  const d = size * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${size}" cy="${size}" r="${size - 1}" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new g.maps.Size(d, d),
    anchor: new g.maps.Point(size, size),
  };
}
// Hard-timeout fetch wrapper — never hangs map init
function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { cache: 'no-store', signal: ctrl.signal })
    .finally(() => clearTimeout(t));
}

const DEFAULT_CENTER = { lat: 39, lng: -98 };
const DEFAULT_ZOOM = 4;

type GeoJSONFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: string; companyId: string; addressRaw: string };
};
type GeoJSONResponse = { type: 'FeatureCollection'; features: GeoJSONFeature[] };
type RedPin = { lng: number; lat: number; id?: string; source?: 'kml' | 'user' };
type LocationPin = { locationId: string; companyId: string; addressRaw?: string; lat: number; lng: number };

export default function EmptyMapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const locationMarkersRef = useRef<google.maps.Marker[]>([]);
  const dotMarkersRef = useRef<google.maps.Marker[]>([]);
  const unsubMapRef = useRef<(() => void) | null>(null);
  const refetchDotsRef = useRef<(() => Promise<void>) | null>(null);
  const selectedMarkerRef = useRef<google.maps.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedPin, setSelectedPin] = useState<{ type: 'location'; data: LocationPin } | { type: 'dot'; data: RedPin } | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [addingToLastLeg, setAddingToLastLeg] = useState(false);

  const handleAddToLastLeg = async () => {
    if (!selectedPin || addingToLastLeg) return;
    setAddingToLastLeg(true);
    const controller = new AbortController();
    const hardTimeout = setTimeout(() => {
      controller.abort();
      setAddingToLastLeg(false);
      toast.error('Request timed out. Try again.');
    }, 10000);
    try {
      const body = selectedPin.type === 'location'
        ? { locationId: selectedPin.data.locationId, companyId: selectedPin.data.companyId }
        : { latitude: selectedPin.data.lat, longitude: selectedPin.data.lng };
      const res = await fetch('/api/lastleg/add-to-route', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', signal: controller.signal, body: JSON.stringify(body)
      });
      let data: { error?: string } = {};
      try { data = await res.json(); } catch {
        data = { error: res.status === 401 ? 'Please sign in.' : `Server error (${res.status})` };
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSelectedPin(null);
      if (isMobileDevice()) { toast.success('Added — opening LastLeg…'); openLastLegApp(); }
      else toast.success('Added to LastLeg. Pull to refresh in the app.');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast.error(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      clearTimeout(hardTimeout);
      setAddingToLastLeg(false);
    }
  };

  const handleAddressGo = async () => {
    const q = addressSearch.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: q }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Could not find address');
      const { latitude: lat, longitude: lng } = data;
      if (typeof lat !== 'number' || typeof lng !== 'number') throw new Error('Invalid result');
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(17);
      toast.success('Zoomed to address');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally { setSearching(false); }
  };

  const handleAddressAddPin = async () => {
    const q = addressSearch.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: q }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Could not find address');
      const { latitude: lat, longitude: lng } = data;
      if (typeof lat !== 'number' || typeof lng !== 'number') throw new Error('Invalid result');
      const pinRes = await fetch('/api/map-pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: lat, longitude: lng }) });
      const pinData = await pinRes.json();
      if (!pinRes.ok) throw new Error(pinData?.error ?? 'Failed to add pin');
      const pin = pinData?.pin as { id: string; lat: number; lng: number } | undefined;
      if (pin) {
        await refetchDotsRef.current?.();
        setSelectedPin({ type: 'dot', data: { lat: pin.lat, lng: pin.lng, id: pin.id, source: 'user' } });
        mapRef.current?.panTo({ lat: pin.lat, lng: pin.lng });
        mapRef.current?.setZoom(17);
        toast.success('Pin added');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally { setSearching(false); }
  };

  const handleDeleteRedPin = async () => {
    if (!selectedPin || selectedPin.type !== 'dot') return;
    const { id, lat, lng } = selectedPin.data;
    // Immediately remove the marker from the map for instant visual feedback
    if (selectedMarkerRef.current) {
      try { selectedMarkerRef.current.setMap(null); } catch { /* ignore */ }
      dotMarkersRef.current = dotMarkersRef.current.filter((m) => m !== selectedMarkerRef.current);
      selectedMarkerRef.current = null;
    }
    setSelectedPin(null);
    try {
      if (id) {
        const res = await fetch(`/api/map-pins/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          let d: { error?: string } = {};
          try { d = await res.json(); } catch { /* ignore */ }
          throw new Error(d?.error ?? 'Failed');
        }
      } else {
        const res = await fetch('/api/dots-pins/hide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: lat, longitude: lng }) });
        if (!res.ok) {
          let d: { error?: string } = {};
          try { d = await res.json(); } catch { /* ignore */ }
          throw new Error(d?.error ?? 'Failed');
        }
      }
      toast.success('Pin removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
      // Re-fetch to restore the marker if the delete failed
      await refetchDotsRef.current?.();
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    void (async () => {
      try {
        // Load Google Maps + data in parallel — both have hard timeouts
        const [googleResult, locResult, dotsResult] = await Promise.allSettled([
          loadGoogleMaps(),
          fetchWithTimeout('/api/locations/map', 8000).then((r) => r.json()).catch(() => ({ features: [] })),
          fetchWithTimeout('/api/dots-pins', 5000).then((r) => r.json()).catch(() => ({ pins: [] })),
        ]);

        if (cancelled || !containerRef.current) return;

        if (googleResult.status === 'rejected') {
          setError(GOOGLE_MAPS_ERROR_MESSAGE);
          return;
        }

        const g = googleResult.value;
        const geojson: GeoJSONResponse = locResult.status === 'fulfilled' && locResult.value?.features
          ? locResult.value : { type: 'FeatureCollection', features: [] };
        const dotsPins: RedPin[] = dotsResult.status === 'fulfilled' && Array.isArray(dotsResult.value?.pins)
          ? dotsResult.value.pins : [];

        if (cancelled || !containerRef.current) return;

        const map = new g.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeId: g.maps.MapTypeId.SATELLITE,
          mapTypeControl: true,
          mapTypeControlOptions: { style: g.maps.MapTypeControlStyle.DROPDOWN_MENU },
          backgroundColor: '#1a1a2e',
          gestureHandling: 'greedy',
        });

        // State lines — non-blocking, non-fatal
        void addStateLines(map);

        const clearLocationMarkers = () => {
          locationMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
          locationMarkersRef.current = [];
        };
        const clearDotMarkers = () => {
          dotMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
          dotMarkersRef.current = [];
        };

        const addLocationMarkers = (features: GeoJSONFeature[]) => {
          clearLocationMarkers();
          features.forEach((f) => {
            try {
              const [lng, lat] = f.geometry.coordinates;
              const props = f.properties;
              const marker = new g.maps.Marker({ map, position: { lat, lng }, icon: svgPin(g, '#0ea5e9', 6), zIndex: 2 });
              marker.addListener('click', () => {
                if (props?.id && props?.companyId) setSelectedPin({ type: 'location', data: { locationId: props.id, companyId: props.companyId, addressRaw: props.addressRaw, lat, lng } });
              });
              locationMarkersRef.current.push(marker);
            } catch { /* skip bad feature */ }
          });
        };

        const addDotMarkers = (pins: RedPin[]) => {
          clearDotMarkers();
          pins.forEach((p) => {
            try {
              const marker = new g.maps.Marker({ map, position: { lat: p.lat, lng: p.lng }, icon: svgPin(g, '#dc2626', 5), zIndex: 1 });
              marker.addListener('click', () => {
                selectedMarkerRef.current = marker;
                setSelectedPin({ type: 'dot', data: { lng: p.lng, lat: p.lat, id: p.id, source: p.source } });
              });
              dotMarkersRef.current.push(marker);
            } catch { /* skip bad pin */ }
          });
        };

        addLocationMarkers(geojson.features);
        addDotMarkers(dotsPins);

        refetchDotsRef.current = async () => {
          if (cancelled || !mapRef.current) return;
          try {
            const res = await fetchWithTimeout('/api/dots-pins', 5000);
            const data = await res.json();
            if (Array.isArray(data?.pins)) addDotMarkers(data.pins);
          } catch { /* ignore */ }
        };

        // Drop-pin on map click
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng || cancelled) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          void (async () => {
            try {
              const res = await fetch('/api/map-pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: lat, longitude: lng }) });
              const data = await res.json();
              if (!res.ok) throw new Error(data?.error ?? 'Failed');
              const pin = data?.pin as { id: string; lat: number; lng: number } | undefined;
              if (pin) {
                await refetchDotsRef.current?.();
                setSelectedPin({ type: 'dot', data: { lng: pin.lng, lat: pin.lat, id: pin.id, source: 'user' } });
                toast.success('Pin added');
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to add pin');
            }
          })();
        });

        // Fit bounds to pins
        const total = geojson.features.length + dotsPins.length;
        if (total > 1) {
          try {
            const bounds = new g.maps.LatLngBounds();
            geojson.features.forEach((f) => bounds.extend({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }));
            dotsPins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
            map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
          } catch { /* ignore bounds error */ }
        } else if (total === 1) {
          try {
            const c = geojson.features[0]
              ? { lat: geojson.features[0].geometry.coordinates[1], lng: geojson.features[0].geometry.coordinates[0] }
              : { lat: dotsPins[0]!.lat, lng: dotsPins[0]!.lng };
            map.setCenter(c);
            map.setZoom(8);
          } catch { /* ignore */ }
        }

        mapRef.current = map;
        setReady(true);

        unsubMapRef.current = subscribeToLocationsMapUpdate(async () => {
          if (cancelled) return;
          try {
            const res = await fetchWithTimeout('/api/locations/map', 8000);
            const data = await res.json();
            if (data?.features != null && mapRef.current) addLocationMarkers(data.features);
          } catch { /* ignore */ }
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Map failed to load');
      }
    })();

    return () => {
      cancelled = true;
      unsubMapRef.current?.();
      unsubMapRef.current = null;
      refetchDotsRef.current = null;
      locationMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
      locationMarkersRef.current = [];
      dotMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
      dotMarkersRef.current = [];
      mapRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#1a1a2e] text-white text-sm rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 w-full">
      {/* Dark background shown until map tiles load — eliminates white flash */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full bg-[#1a1a2e]" />

      {/* Loading overlay — fades out once map is ready */}
      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1a1a2e] pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-white/60 text-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            Loading map…
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background/95 shadow-sm backdrop-blur px-2">
            <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Search address..."
              value={addressSearch}
              onChange={(e) => setAddressSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddressGo()}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleAddressGo} disabled={searching || !addressSearch.trim()}>Go</Button>
            <Button size="sm" onClick={handleAddressAddPin} disabled={searching || !addressSearch.trim()}>Add pin</Button>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">Or click the map to drop a red pin</p>
      </div>

      {selectedPin && (
        <div className="absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg">
          <p className="text-sm text-muted-foreground mb-2">
            {selectedPin.type === 'location' ? (selectedPin.data.addressRaw || 'Location') : `Dot ${selectedPin.data.lat.toFixed(5)}, ${selectedPin.data.lng.toFixed(5)}`}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={handleAddToLastLeg} disabled={addingToLastLeg}>
              {addingToLastLeg ? 'Adding…' : 'Add to LastLeg'}
            </Button>
            <a href={googleEarthUrl(selectedPin.data.lat, selectedPin.data.lng)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Google Earth</a>
            {selectedPin.type === 'location' && (
              <Link href={`/map/companies/${selectedPin.data.companyId}/locations/${selectedPin.data.locationId}`} className="text-sm text-primary hover:underline">Location page</Link>
            )}
            {selectedPin.type === 'dot' && (
              <Button variant="destructive" size="sm" onClick={handleDeleteRedPin}>Delete pin</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelectedPin(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
