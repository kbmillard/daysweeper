'use client';

import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconMapPin } from '@tabler/icons-react';
import { isValidMapboxCoordinate } from '@/lib/geocode-address';
import { loadGoogleMaps, GOOGLE_MAPS_ERROR_MESSAGE } from '@/lib/google-maps-loader';
import { addStateLines } from '@/lib/add-state-lines';
import { googleEarthUrl } from '@/lib/google-earth-url';
import { subscribeToLocationsMapUpdate, notifyLocationsMapUpdate } from '@/lib/locations-map-update';
import { toast } from 'sonner';

const DEFAULT_ZOOM = 15;
const DEFAULT_CENTER = { lat: 39, lng: -98 };
const DEFAULT_ZOOM_NO_POINTS = 3;

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
function safeCoord(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = safeNum(lat);
  const lo = safeNum(lng);
  if (la == null || lo == null) return null;
  if (!isValidMapboxCoordinate(la, lo)) return null;
  return { lat: la, lng: lo };
}
function svgPin(color: string, size: number): google.maps.Icon {
  const r = size;
  const d = r * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(d, d),
    anchor: new google.maps.Point(r, r),
  };
}

// ── Error boundary ───────────────────────────────────────────────────────────
class MapErrorBoundary extends Component<{ children: ReactNode }, { caught: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { caught: null };
  }
  static getDerivedStateFromError(e: Error) { return { caught: e?.message ?? 'Map error' }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('[CompanyLocationsMap]', e, i); }
  render() {
    if (this.state.caught) {
      return (
        <div className='flex min-h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm px-4 text-center'>
          Map unavailable — {this.state.caught}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
type LocationWithCoords = {
  id?: string;
  companyId?: string;
  addressRaw: string;
  latitude?: number | null | unknown;
  longitude?: number | null | unknown;
};
type Props = {
  locations: LocationWithCoords[];
  companyName?: string;
  basePath?: 'map' | 'dashboard';
  companyId?: string | null;
  primaryLocationId?: string | null;
};
type RedPin = { lat: number; lng: number };
type LocationPoint = { lat: number; lng: number; address: string; locationId?: string; companyId?: string };
type SelectedPin =
  | { type: 'location'; data: LocationPoint }
  | { type: 'dot'; data: RedPin }
  | { type: 'draft'; data: { lat: number; lng: number } };

// ── Inner map component ──────────────────────────────────────────────────────
function CompanyLocationsMapInner({ locations, companyName, basePath = 'map', companyId, primaryLocationId }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const locationMarkersRef = useRef<google.maps.Marker[]>([]);
  const dotMarkersRef = useRef<google.maps.Marker[]>([]);
  const draftMarkerRef = useRef<google.maps.Marker | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null);
  const [draftPin, setDraftPin] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingToLastLeg, setAddingToLastLeg] = useState(false);
  const canDropPin = Boolean(companyId);

  const handleAddToLastLeg = async () => {
    if (!selectedPin || selectedPin.type === 'draft' || addingToLastLeg) return;
    setAddingToLastLeg(true);
    try {
      const body =
        selectedPin.type === 'location'
          ? { locationId: selectedPin.data.locationId, companyId: selectedPin.data.companyId }
          : { latitude: selectedPin.data.lat, longitude: selectedPin.data.lng };
      const res = await fetch('/api/lastleg/add-to-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      let data: { error?: string } = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSelectedPin(null);
      if (isMobile()) { toast.success('Added — opening LastLeg…'); openLastLegApp(); }
      else toast.success('Added to LastLeg. Pull to refresh in the app.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAddingToLastLeg(false);
    }
  };

  const handleAddLocationAtPin = async () => {
    if (!companyId || !draftPin) return;
    setSaving(true);
    try {
      const addressRaw = `Dropped pin (${draftPin.lat.toFixed(5)}, ${draftPin.lng.toFixed(5)})`;
      const res = await fetch(`/api/companies/${companyId}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressRaw, latitude: draftPin.lat, longitude: draftPin.lng }),
      });
      if (!res.ok) {
        let d: { error?: string } = {};
        try { d = await res.json(); } catch { /* ignore */ }
        throw new Error(d?.error ?? 'Failed to add location');
      }
      notifyLocationsMapUpdate();
      setDraftPin(null);
      setSelectedPin(null);
      router.refresh();
      toast.success('Location added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add location');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    try { return subscribeToLocationsMapUpdate(() => { try { router.refresh(); } catch { /* ignore */ } }); }
    catch { return undefined; }
  }, [router]);

  useEffect(() => {
    if (draftPin === null) {
      try { draftMarkerRef.current?.setMap(null); } catch { /* ignore */ }
      draftMarkerRef.current = null;
    }
  }, [draftPin]);

  const pointsWithCoords: LocationPoint[] = locations
    .flatMap((loc) => {
      const c = safeCoord(loc.latitude, loc.longitude);
      if (!c) return [];
      return [{ lat: c.lat, lng: c.lng, address: loc.addressRaw || 'Location', locationId: loc.id, companyId: loc.companyId }];
    })
    .sort((a, b) => {
      if (primaryLocationId) {
        if (a.locationId === primaryLocationId) return -1;
        if (b.locationId === primaryLocationId) return 1;
      }
      return 0;
    });

  const hasAnyCoords = pointsWithCoords.length > 0;

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
        // Load Google Maps and red dots in parallel.
        // Red dots NEVER affect zoom/center — blue pins own the viewport.
        // Dots fetch has a hard 3s timeout so it never blocks map init.
        const dotsFetch = Promise.race([
          fetch('/api/dots-pins', { cache: 'no-store' })
            .then((r) => r.json() as Promise<{ pins?: unknown[] }>)
            .catch(() => ({ pins: [] as unknown[] })),
          new Promise<{ pins: unknown[] }>((r) => setTimeout(() => r({ pins: [] }), 3000))
        ]);
        const [google, dotsData] = await Promise.all([
          loadGoogleMaps().catch(() => null),
          dotsFetch
        ]);

        if (!google || cancelled || !containerRef.current) {
          if (!cancelled) setError(GOOGLE_MAPS_ERROR_MESSAGE);
          return;
        }

        // Parse red dots — safe, never used for viewport
        const redDots: RedPin[] = [];
        if (Array.isArray(dotsData?.pins)) {
          for (const p of dotsData.pins) {
            if (typeof p !== 'object' || p === null) continue;
            const pp = p as Record<string, unknown>;
            const c = safeCoord(pp.lat, pp.lng);
            if (c) redDots.push(c);
          }
        }

        // Blue pins control center & zoom — red dots are cosmetic only
        const firstBlue = pointsWithCoords[0] ?? null;
        const center = firstBlue ?? DEFAULT_CENTER;
        const singleLocation = pointsWithCoords.length === 1;
        const initialZoom = pointsWithCoords.length === 0
          ? DEFAULT_ZOOM_NO_POINTS
          : singleLocation ? 19 : DEFAULT_ZOOM;

        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom: initialZoom,
          tilt: 0,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          mapTypeControl: true,
          mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU },
          gestureHandling: 'greedy',
          backgroundColor: '#1a1a2e',
        });
        void addStateLines(map);

        // 45° tilt for single location after idle
        if (singleLocation) {
          listenersRef.current.push(
            google.maps.event.addListenerOnce(map, 'idle', () => {
              try { map.setTilt(45); } catch { /* ignore */ }
            })
          );
        }

        // fitBounds on BLUE PINS ONLY — never red dots
        if (pointsWithCoords.length > 1) {
          try {
            const bounds = new google.maps.LatLngBounds();
            pointsWithCoords.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
            map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
            listenersRef.current.push(
              google.maps.event.addListenerOnce(map, 'idle', () => {
                try { const z = map.getZoom() ?? DEFAULT_ZOOM; if (z > 17) map.setZoom(17); } catch { /* ignore */ }
              })
            );
          } catch { /* ignore */ }
        }

        // Blue location markers
        const locationMarkers: google.maps.Marker[] = [];
        pointsWithCoords.forEach((p) => {
          try {
            const m = new google.maps.Marker({ map, position: { lat: p.lat, lng: p.lng }, icon: svgPin('#0ea5e9', 6), zIndex: 2 });
            listenersRef.current.push(m.addListener('click', () => { try { setSelectedPin({ type: 'location', data: p }); } catch { /* ignore */ } }));
            locationMarkers.push(m);
          } catch { /* skip */ }
        });
        locationMarkersRef.current = locationMarkers;

        // Red dot markers — cosmetic only, no effect on viewport
        const dotMarkers: google.maps.Marker[] = [];
        redDots.forEach((p) => {
          try {
            const m = new google.maps.Marker({ map, position: { lat: p.lat, lng: p.lng }, icon: svgPin('#dc2626', 5), zIndex: 1 });
            listenersRef.current.push(m.addListener('click', () => { try { setSelectedPin({ type: 'dot', data: p }); } catch { /* ignore */ } }));
            dotMarkers.push(m);
          } catch { /* skip */ }
        });
        dotMarkersRef.current = dotMarkers;

        // Drop-pin click handler
        if (canDropPin) {
          listenersRef.current.push(
            map.addListener('click', (e: google.maps.MapMouseEvent) => {
              try {
                const pos = e.latLng;
                if (!pos) return;
                const lat = pos.lat();
                const lng = pos.lng();
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                try { draftMarkerRef.current?.setMap(null); } catch { /* ignore */ }
                draftMarkerRef.current = null;
                const m = new google.maps.Marker({ map, position: { lat, lng }, icon: svgPin('#0ea5e9', 6), zIndex: 3 });
                draftMarkerRef.current = m;
                setDraftPin({ lat, lng });
                setSelectedPin({ type: 'draft', data: { lat, lng } });
              } catch { /* ignore */ }
            })
          );
        }

        mapRef.current = map;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Map failed to load');
      }
    })();

    return () => {
      cancelled = true;
      cleanupListeners();
      try { draftMarkerRef.current?.setMap(null); } catch { /* ignore */ }
      draftMarkerRef.current = null;
      locationMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
      locationMarkersRef.current = [];
      dotMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
      dotMarkersRef.current = [];
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyCoords, canDropPin, pointsWithCoords.length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <IconMapPin className='h-5 w-5' />
          Map
        </CardTitle>
        <CardDescription>
          {canDropPin && 'Click the map to drop a pin, then add as a new location. '}
          {hasAnyCoords
            ? companyName
              ? `${pointsWithCoords.length} location${pointsWithCoords.length === 1 ? '' : 's'} for ${companyName}`
              : `${pointsWithCoords.length} location${pointsWithCoords.length === 1 ? '' : 's'}`
            : !canDropPin
              ? 'Add latitude and longitude to a location to see pins on the map'
              : 'Drop a pin to add the first location.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className='flex min-h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm px-4 text-center'>
            {error}
          </div>
        ) : (
          <div className='space-y-2'>
            <div className='relative rounded-lg border overflow-hidden min-h-[280px]'>
              <div ref={containerRef} className='h-[280px] w-full min-h-[280px] bg-[#1a1a2e]' />
              {selectedPin && (
                <div className='absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg'>
                  <p className='text-sm text-muted-foreground mb-2'>
                    {selectedPin.type === 'location'
                      ? selectedPin.data.address
                      : selectedPin.type === 'draft'
                        ? `Dropped pin: ${selectedPin.data.lat.toFixed(5)}, ${selectedPin.data.lng.toFixed(5)}`
                        : `Dot ${selectedPin.data.lat.toFixed(5)}, ${selectedPin.data.lng.toFixed(5)}`}
                  </p>
                  <div className='flex flex-wrap gap-2 items-center'>
                    {selectedPin.type !== 'draft' && (
                      <Button size='sm' onClick={handleAddToLastLeg} disabled={addingToLastLeg}>
                        {addingToLastLeg ? 'Adding…' : 'Add to LastLeg'}
                      </Button>
                    )}
                    <a href={googleEarthUrl(selectedPin.data.lat, selectedPin.data.lng)} target='_blank' rel='noopener noreferrer' className='text-sm text-primary hover:underline'>
                      Google Earth
                    </a>
                    {selectedPin.type === 'location' && selectedPin.data.locationId && selectedPin.data.companyId && (
                      <Link href={`/${basePath}/companies/${selectedPin.data.companyId}/locations/${selectedPin.data.locationId}`} className='text-sm text-primary hover:underline'>
                        Location page
                      </Link>
                    )}
                    {selectedPin.type === 'draft' && (
                      <>
                        <Button size='sm' onClick={handleAddLocationAtPin} disabled={saving}>
                          {saving ? 'Adding…' : 'Add location at pin'}
                        </Button>
                        <Button variant='ghost' size='sm' onClick={() => { setDraftPin(null); setSelectedPin(null); }}>
                          Cancel
                        </Button>
                      </>
                    )}
                    <Button variant='ghost' size='sm' onClick={() => { setSelectedPin(null); if (selectedPin.type === 'draft') setDraftPin(null); }}>
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {pointsWithCoords.length > 0 && (
              <div className='rounded-lg border bg-background p-3 shadow-sm'>
                <a href={googleEarthUrl(pointsWithCoords[0].lat, pointsWithCoords[0].lng)} target='_blank' rel='noopener noreferrer' className='text-sm text-primary hover:underline'>
                  Open in Google Earth{pointsWithCoords.length > 1 ? ' (first location)' : ''}
                </a>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CompanyLocationsMap(props: Props) {
  return (
    <MapErrorBoundary>
      <CompanyLocationsMapInner {...props} />
    </MapErrorBoundary>
  );
}
