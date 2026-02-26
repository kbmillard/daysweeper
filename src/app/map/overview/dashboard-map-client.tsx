'use client';

import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { subscribeToLocationsMapUpdate } from '@/lib/locations-map-update';
import { loadGoogleMaps, GOOGLE_MAPS_ERROR_MESSAGE } from '@/lib/google-maps-loader';
import { googleEarthUrl } from '@/lib/google-earth-url';

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
}
function openLastLegApp(): void {
  try { setTimeout(() => { window.location.href = 'lastleg://'; }, 300); } catch { /* ignore */ }
}
function safeNum(v: unknown): number | null {
  const n = Number(v);
  return v != null && !Number.isNaN(n) && Number.isFinite(n) ? n : null;
}

const DEFAULT_CENTER = { lat: 39, lng: -98 };
const DEFAULT_ZOOM = 2;

type RedPin = { lng: number; lat: number; id?: string; source?: 'kml' | 'user' };
type LocationPin = { locationId: string; companyId: string; addressRaw?: string; lat: number; lng: number };
type GeoJSONFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: string; companyId: string; addressRaw: string };
};
type GeoJSONResponse = { type: 'FeatureCollection'; features: GeoJSONFeature[] };
type LocationNeedingGeocode = { id: string; companyId: string; addressRaw: string; addressForGeocode: string };

function createDot(g: typeof google, color: string, size: number): google.maps.Symbol {
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale: size,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 1,
  };
}

// ── Error boundary ───────────────────────────────────────────────────────────
class MapErrorBoundary extends Component<{ children: ReactNode }, { caught: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { caught: null };
  }
  static getDerivedStateFromError(e: Error) { return { caught: e?.message ?? 'Map error' }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('[DashboardMapClient]', e, i); }
  render() {
    if (this.state.caught) {
      return (
        <div className='flex h-[500px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm px-6 text-center'>
          Map unavailable — {this.state.caught}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Inner map ────────────────────────────────────────────────────────────────
function DashboardMapClientInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const locationMarkersRef = useRef<google.maps.Marker[]>([]);
  const dotMarkersRef = useRef<google.maps.Marker[]>([]);
  const unsubMapRef = useRef<(() => void) | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needingGeocode, setNeedingGeocode] = useState<LocationNeedingGeocode[]>([]);
  const [locationCount, setLocationCount] = useState<number | null>(null);
  const refetchDotsRef = useRef<(() => Promise<void>) | null>(null);
  const [selectedPin, setSelectedPin] = useState<{ type: 'location'; data: LocationPin } | { type: 'dot'; data: RedPin } | null>(null);
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
      const body =
        selectedPin.type === 'location'
          ? { locationId: selectedPin.data.locationId, companyId: selectedPin.data.companyId }
          : { latitude: selectedPin.data.lat, longitude: selectedPin.data.lng };
      const res = await fetch('/api/lastleg/add-to-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      let data: { error?: string } = {};
      try { data = await res.json(); } catch {
        data = { error: res.status === 401 ? 'Please sign in.' : `Server error (${res.status})` };
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSelectedPin(null);
      if (isMobile()) { toast.success('Added — opening LastLeg…'); openLastLegApp(); }
      else toast.success('Added to LastLeg. Pull to refresh in the app.');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error(err instanceof Error ? err.message : 'Failed to add');
      }
    } finally {
      clearTimeout(hardTimeout);
      setAddingToLastLeg(false);
    }
  };

  const handleDeleteRedPin = async () => {
    if (!selectedPin || selectedPin.type !== 'dot') return;
    const { id, lat, lng } = selectedPin.data;
    try {
      if (id) {
        const res = await fetch(`/api/map-pins/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          let d: { error?: string } = {};
          try { d = await res.json(); } catch { /* ignore */ }
          throw new Error(d?.error ?? 'Failed');
        }
      } else {
        const res = await fetch('/api/dots-pins/hide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: lat, longitude: lng }),
        });
        if (!res.ok) {
          let d: { error?: string } = {};
          try { d = await res.json(); } catch { /* ignore */ }
          throw new Error(d?.error ?? 'Failed');
        }
      }
      toast.success('Pin removed');
      setSelectedPin(null);
      await refetchDotsRef.current?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  useEffect(() => {
    void fetch('/api/locations/for-geocode?missingOnly=true')
      .then((res) => res.json())
      .then((data: { locations?: LocationNeedingGeocode[] }) => {
        if (data?.locations) setNeedingGeocode(data.locations);
      })
      .catch(() => setNeedingGeocode([]));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    const cleanupListeners = () => {
      try {
        listenersRef.current.forEach((l) => {
          try { (window as { google?: { maps?: { event?: { removeListener?: (l: unknown) => void } } } }).google?.maps?.event?.removeListener?.(l); } catch { /* ignore */ }
        });
        listenersRef.current = [];
      } catch { /* ignore */ }
    };

    void (async () => {
      try {
        let geojson: GeoJSONResponse = { type: 'FeatureCollection', features: [] };
        let dotsPins: RedPin[] = [];
        try {
          const [locRes, dotsRes] = await Promise.all([
            fetch('/api/locations/map', { cache: 'no-store' }),
            fetch('/api/dots-pins', { cache: 'no-store' }),
          ]);
          const locData = await locRes.json() as { features?: GeoJSONFeature[] };
          const dotsData = await dotsRes.json() as { pins?: unknown[] };
          if (locData?.features) geojson = locData as GeoJSONResponse;
          if (Array.isArray(dotsData?.pins)) {
            dotsPins = dotsData.pins.flatMap((p) => {
              if (typeof p !== 'object' || p === null) return [];
              const pp = p as Record<string, unknown>;
              const la = safeNum(pp.lat);
              const lo = safeNum(pp.lng);
              return la != null && lo != null
                ? [{ lat: la, lng: lo, id: typeof pp.id === 'string' ? pp.id : undefined, source: (pp.source as RedPin['source']) ?? undefined }]
                : [];
            });
          }
        } catch { /* keep empty */ }

        if (cancelled || !containerRef.current) return;
        setLocationCount(geojson.features.length);

        const google = await loadGoogleMaps().catch(() => null);
        if (!google || cancelled || !containerRef.current) {
          if (!cancelled) setError(GOOGLE_MAPS_ERROR_MESSAGE);
          return;
        }

        const map = new google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          mapTypeControl: true,
          mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU },
          gestureHandling: 'greedy',
        });

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
              const [rawLng, rawLat] = f.geometry.coordinates;
              const lat = safeNum(rawLat);
              const lng = safeNum(rawLng);
              if (lat == null || lng == null) return;
              const props = f.properties;
              const marker = new google.maps.Marker({ map, position: { lat, lng }, icon: createDot(google, '#0ea5e9', 6), zIndex: 2 });
              listenersRef.current.push(
                marker.addListener('click', () => {
                  try {
                    if (props?.id && props?.companyId) {
                      setSelectedPin({ type: 'location', data: { locationId: props.id, companyId: props.companyId, addressRaw: props.addressRaw, lat, lng } });
                    }
                  } catch { /* ignore */ }
                })
              );
              locationMarkersRef.current.push(marker);
            } catch { /* skip bad feature */ }
          });
        };

        const addDotMarkers = (pins: RedPin[]) => {
          clearDotMarkers();
          pins.forEach((p) => {
            try {
              const marker = new google.maps.Marker({ map, position: { lat: p.lat, lng: p.lng }, icon: createDot(google, '#dc2626', 5), zIndex: 1 });
              listenersRef.current.push(
                marker.addListener('click', () => {
                  try { setSelectedPin({ type: 'dot', data: { lng: p.lng, lat: p.lat, id: p.id, source: p.source } }); } catch { /* ignore */ }
                })
              );
              dotMarkersRef.current.push(marker);
            } catch { /* skip bad pin */ }
          });
        };

        addLocationMarkers(geojson.features);
        addDotMarkers(dotsPins);

        refetchDotsRef.current = async () => {
          if (cancelled || !mapRef.current) return;
          try {
            const res = await fetch('/api/dots-pins', { cache: 'no-store' });
            const data = await res.json() as { pins?: unknown[] };
            if (Array.isArray(data?.pins)) {
              const pins: RedPin[] = data.pins.flatMap((p) => {
                if (typeof p !== 'object' || p === null) return [];
                const pp = p as Record<string, unknown>;
                const la = safeNum(pp.lat);
                const lo = safeNum(pp.lng);
                return la != null && lo != null
                  ? [{ lat: la, lng: lo, id: typeof pp.id === 'string' ? pp.id : undefined, source: (pp.source as RedPin['source']) ?? undefined }]
                  : [];
              });
              addDotMarkers(pins);
            }
          } catch { /* ignore */ }
        };

        // fitBounds on BLUE LOCATION PINS ONLY — red dots are cosmetic, never affect viewport
        try {
          const blueCount = geojson.features.length;
          if (blueCount > 1) {
            const bounds = new google.maps.LatLngBounds();
            geojson.features.forEach((f) => {
              const la = safeNum(f.geometry.coordinates[1]);
              const lo = safeNum(f.geometry.coordinates[0]);
              if (la != null && lo != null) bounds.extend({ lat: la, lng: lo });
            });
            map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
          } else if (blueCount === 1) {
            const f = geojson.features[0]!;
            const la = safeNum(f.geometry.coordinates[1]) ?? DEFAULT_CENTER.lat;
            const lo = safeNum(f.geometry.coordinates[0]) ?? DEFAULT_CENTER.lng;
            map.setCenter({ lat: la, lng: lo });
            map.setZoom(8);
          }
        } catch { /* ignore fitBounds failure */ }

        mapRef.current = map;

        unsubMapRef.current = subscribeToLocationsMapUpdate(async () => {
          if (cancelled) return;
          try {
            const res = await fetch('/api/locations/map', { cache: 'no-store' });
            const data = await res.json() as { features?: GeoJSONFeature[] };
            if (data?.features != null && mapRef.current) addLocationMarkers(data.features);
          } catch { /* ignore */ }
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Map failed to load');
      }
    })();

    return () => {
      cancelled = true;
      cleanupListeners();
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
      <div className='flex h-[500px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm px-6 text-center'>
        {error}
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {locationCount !== null && (
        <p className='text-sm text-muted-foreground'>
          {locationCount === 0
            ? 'No locations with coordinates.'
            : `${locationCount} location${locationCount === 1 ? '' : 's'} on map (click → company).`}
        </p>
      )}
      <div className='relative rounded-lg border overflow-hidden'>
        <div ref={containerRef} className='h-[500px] w-full' />
        {selectedPin && (
          <div className='absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg'>
            <p className='text-sm text-muted-foreground mb-2'>
              {selectedPin.type === 'location'
                ? (selectedPin.data.addressRaw || 'Location')
                : `Dot ${selectedPin.data.lat.toFixed(5)}, ${selectedPin.data.lng.toFixed(5)}`}
            </p>
            <div className='flex flex-wrap gap-2 items-center'>
              <Button size='sm' onClick={handleAddToLastLeg} disabled={addingToLastLeg}>
                {addingToLastLeg ? 'Adding…' : 'Add to LastLeg'}
              </Button>
              <a href={googleEarthUrl(selectedPin.data.lat, selectedPin.data.lng)} target='_blank' rel='noopener noreferrer' className='text-sm text-primary hover:underline'>
                Google Earth
              </a>
              {selectedPin.type === 'location' && (
                <Link href={`/map/companies/${selectedPin.data.companyId}/locations/${selectedPin.data.locationId}`} className='text-sm text-primary hover:underline'>
                  Location page
                </Link>
              )}
              {selectedPin.type === 'dot' && (
                <Button variant='destructive' size='sm' onClick={handleDeleteRedPin}>Delete pin</Button>
              )}
              <Button variant='ghost' size='sm' onClick={() => setSelectedPin(null)}>Close</Button>
            </div>
          </div>
        )}
      </div>
      <section className='rounded-lg border bg-muted/20 p-4'>
        <h3 className='text-sm font-semibold text-muted-foreground mb-2'>Geocodes to get</h3>
        {needingGeocode.length === 0 ? (
          <p className='text-sm text-muted-foreground'>All locations have coordinates.</p>
        ) : (
          <ul className='space-y-2 text-sm'>
            {needingGeocode.map((loc) => (
              <li key={loc.id} className='flex items-center gap-2 flex-wrap'>
                <span className='text-muted-foreground truncate max-w-[min(100%,400px)]' title={loc.addressRaw}>
                  {loc.addressForGeocode || loc.addressRaw || 'No address'}
                </span>
                <Link href={`/dashboard/companies/${loc.companyId}`} className='text-primary hover:underline shrink-0'>
                  View company
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function DashboardMapClient() {
  return (
    <MapErrorBoundary>
      <DashboardMapClientInner />
    </MapErrorBoundary>
  );
}
