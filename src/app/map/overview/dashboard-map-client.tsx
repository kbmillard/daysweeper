'use client';

import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertModal } from '@/components/modal/alert-modal';
import { subscribeToLocationsMapUpdate } from '@/lib/locations-map-update';
import { loadGoogleMaps, GOOGLE_MAPS_ERROR_MESSAGE } from '@/lib/google-maps-loader';
import { googleEarthUrl } from '@/lib/google-earth-url';
import { regridUrl } from '@/lib/regrid-url';

const COMPANY_PIN_COLOR = '#9333ea';

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

type RedPin = {
  lng: number;
  lat: number;
  id?: string;
  source?: 'kml' | 'user';
  label?: string;
  addressRaw?: string;
  phone?: string;
  website?: string;
  summary?: string;
};
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
  const [addToLastLegLocked, setAddToLastLegLocked] = useState(false);
  const [deleteDotConfirmOpen, setDeleteDotConfirmOpen] = useState(false);
  const [deletingRedDot, setDeletingRedDot] = useState(false);

  useEffect(() => {
    if (!selectedPin) return;
    setAddToLastLegLocked(selectedPin.type === 'dot');
  }, [selectedPin]);

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
      setAddToLastLegLocked(true);
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
    setDeletingRedDot(true);
    try {
      const res = await fetch('/api/map-pins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : { latitude: lat, longitude: lng })
      });
      if (!res.ok) {
        let d: { error?: string } = {};
        try {
          d = await res.json();
        } catch {
          /* ignore */
        }
        throw new Error(d?.error ?? 'Failed');
      }
      const data = (await res.json().catch(() => ({}))) as {
        deletedMapPins?: number;
        by?: string;
      };
      if (!id && data.by === 'coordinates' && data.deletedMapPins === 0) {
        toast.warning('No matching pin in the database (map refreshed).');
      } else {
        toast.success('Pin removed');
      }
      setSelectedPin(null);
      setDeleteDotConfirmOpen(false);
      await refetchDotsRef.current?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingRedDot(false);
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
              const marker = new google.maps.Marker({ map, position: { lat, lng }, icon: createDot(google, COMPANY_PIN_COLOR, 6), zIndex: 2 });
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
                  try {
                    setSelectedPin({
                      type: 'dot',
                      data: {
                        lng: p.lng,
                        lat: p.lat,
                        id: p.id,
                        source: p.source,
                        label: p.label,
                        addressRaw: p.addressRaw,
                        phone: p.phone,
                        website: p.website,
                        summary: p.summary
                      }
                    });
                  } catch { /* ignore */ }
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
                  ? [{
                      lat: la,
                      lng: lo,
                      id: typeof pp.id === 'string' ? pp.id : undefined,
                      source: (pp.source as RedPin['source']) ?? undefined,
                      label: typeof pp.label === 'string' ? pp.label : undefined,
                      addressRaw: typeof pp.addressRaw === 'string' ? pp.addressRaw : undefined,
                      phone: typeof pp.phone === 'string' ? pp.phone : undefined,
                      website: typeof pp.website === 'string' ? pp.website : undefined,
                      summary: typeof pp.summary === 'string' ? pp.summary : undefined
                    }]
                  : [];
              });
              addDotMarkers(pins);
            }
          } catch { /* ignore */ }
        };

        // fitBounds on company location pins only — red dots are cosmetic, never affect viewport
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
      <AlertModal
        isOpen={deleteDotConfirmOpen}
        onClose={() => setDeleteDotConfirmOpen(false)}
        onConfirm={() => void handleDeleteRedPin()}
        loading={deletingRedDot}
        description='This map pin will be removed from the database.'
      />
      {locationCount !== null && (
        <p className='text-[14px] text-muted-foreground/80 mb-3'>
          {locationCount === 0
            ? 'No locations with coordinates.'
            : `${locationCount} location${locationCount === 1 ? '' : 's'} on map (click → company).`}
        </p>
      )}
      <div className='relative rounded-2xl overflow-hidden shadow-lg'>
        <div ref={containerRef} className='h-[500px] w-full' />
        {selectedPin && (
          <div className='absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-md ios-card ios-animate-in p-5'>
            <p className='text-[15px] font-semibold text-foreground/90 mb-1 leading-snug'>
              {selectedPin.type === 'location'
                ? (selectedPin.data.addressRaw || 'Location')
                : (selectedPin.data.label || `Dot ${selectedPin.data.lat.toFixed(5)}, ${selectedPin.data.lng.toFixed(5)}`)}
            </p>
            {selectedPin.type === 'dot' && (selectedPin.data.addressRaw || selectedPin.data.phone || selectedPin.data.website || selectedPin.data.summary) && (
              <div className='mb-4 space-y-1 text-[14px]'>
                {selectedPin.data.addressRaw && (
                  <p className='text-muted-foreground/80'>{selectedPin.data.addressRaw}</p>
                )}
                {selectedPin.data.phone && (
                  <p>
                    <a href={`tel:${selectedPin.data.phone.replace(/\s/g, '')}`} className='ios-link'>
                      {selectedPin.data.phone}
                    </a>
                  </p>
                )}
                {selectedPin.data.website && (
                  <p>
                    <a href={selectedPin.data.website} target='_blank' rel='noopener noreferrer' className='ios-link break-all'>
                      {selectedPin.data.website}
                    </a>
                  </p>
                )}
                {selectedPin.data.summary && (
                  <p className='text-muted-foreground/80'>{selectedPin.data.summary}</p>
                )}
              </div>
            )}
            <div className='flex flex-wrap gap-2.5 items-center mb-4'>
              <button
                type='button'
                onClick={handleAddToLastLeg}
                disabled={addingToLastLeg || addToLastLegLocked}
                className='ios-bubble ios-bubble-primary h-9 px-4 rounded-full text-[14px] font-semibold tracking-tight'
              >
                {addingToLastLeg ? 'Adding…' : 'Add to LastLeg'}
              </button>
              <button
                type='button'
                onClick={() => setAddToLastLegLocked(false)}
                className='ios-bubble ios-bubble-secondary h-9 px-4 rounded-full text-[14px]'
              >
                Reactivate pin
              </button>
              {selectedPin.type === 'dot' && (
                <button
                  type='button'
                  onClick={() => setDeleteDotConfirmOpen(true)}
                  className='ios-bubble ios-bubble-destructive h-9 px-4 rounded-full text-[14px]'
                >
                  Delete pin
                </button>
              )}
            </div>
            <div className='flex flex-wrap gap-2.5 items-center'>
              <a
                href={googleEarthUrl(selectedPin.data.lat, selectedPin.data.lng)}
                target='_blank'
                rel='noopener noreferrer'
                className='ios-bubble ios-bubble-secondary h-9 px-4 rounded-full text-[14px] inline-flex items-center justify-center'
              >
                Google Earth
              </a>
              <a
                href={regridUrl(selectedPin.data.lat, selectedPin.data.lng)}
                target='_blank'
                rel='noopener noreferrer'
                className='ios-bubble ios-bubble-secondary h-9 px-4 rounded-full text-[14px] inline-flex items-center justify-center'
              >
                Regrid
              </a>
              {selectedPin.type === 'location' && (
                <Link
                  href={`/map/companies/${selectedPin.data.companyId}/locations/${selectedPin.data.locationId}`}
                  className='ios-bubble ios-bubble-secondary h-9 px-4 rounded-full text-[14px] inline-flex items-center justify-center'
                >
                  Location page
                </Link>
              )}
              <button
                type='button'
                onClick={() => setSelectedPin(null)}
                className='ios-bubble ios-bubble-ghost h-9 px-4 rounded-full text-[14px]'
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
      <section className='ios-card p-5 mt-4'>
        <h3 className='ios-section-label mb-3'>Geocodes to get</h3>
        {needingGeocode.length === 0 ? (
          <p className='text-[14px] text-muted-foreground/70'>All locations have coordinates.</p>
        ) : (
          <ul className='space-y-2.5 text-[14px]'>
            {needingGeocode.map((loc) => (
              <li key={loc.id} className='flex items-center gap-3 flex-wrap'>
                <span className='text-muted-foreground/80 truncate max-w-[min(100%,400px)]' title={loc.addressRaw}>
                  {loc.addressForGeocode || loc.addressRaw || 'No address'}
                </span>
                <Link href={`/dashboard/companies/${loc.companyId}`} className='ios-link shrink-0'>
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
