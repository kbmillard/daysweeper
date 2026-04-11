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
import { regridUrl } from '@/lib/regrid-url';
import { subscribeToLocationsMapUpdate } from '@/lib/locations-map-update';
import { toast } from 'sonner';
import { AlertModal } from '@/components/modal/alert-modal';

const DEFAULT_ZOOM = 15;
const DEFAULT_CENTER = { lat: 39, lng: -98 };
const DEFAULT_ZOOM_NO_POINTS = 3;
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
type LocationPoint = { lat: number; lng: number; address: string; locationId?: string; companyId?: string };
type SelectedPin = { type: 'location'; data: LocationPoint };

// ── Inner map component ──────────────────────────────────────────────────────
function CompanyLocationsMapInner({ locations, companyName, basePath = 'map', primaryLocationId }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const locationMarkersRef = useRef<google.maps.Marker[]>([]);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null);
  const [addingToLastLeg, setAddingToLastLeg] = useState(false);
  const [addToLastLegLocked, setAddToLastLegLocked] = useState(false);
  const [deletingPin, setDeletingPin] = useState(false);
  const [deleteLocationConfirmOpen, setDeleteLocationConfirmOpen] = useState(false);

  useEffect(() => {
    if (!selectedPin) return;
    setAddToLastLegLocked(false);
  }, [selectedPin]);

  const handleAddToLastLeg = async () => {
    if (!selectedPin || addingToLastLeg) return;
    setAddingToLastLeg(true);
    try {
      const body = { locationId: selectedPin.data.locationId, companyId: selectedPin.data.companyId };
      const res = await fetch('/api/lastleg/add-to-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      let data: { error?: string } = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setAddToLastLegLocked(true);
      if (isMobile()) { toast.success('Added — opening LastLeg…'); openLastLegApp(); }
      else toast.success('Added to LastLeg. Pull to refresh in the app.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAddingToLastLeg(false);
    }
  };

  const handleDeleteLocationPin = async () => {
    const locationId = selectedPin?.data.locationId;
    if (!locationId || deletingPin) return;
    setDeletingPin(true);
    try {
      const res = await fetch(`/api/locations/${locationId}`, { method: 'DELETE' });
      if (!res.ok) {
        let d: { error?: string } = {};
        try { d = await res.json(); } catch { /* ignore */ }
        throw new Error(d?.error ?? 'Failed to delete location');
      }
      toast.success('Location deleted');
      setSelectedPin(null);
      setDeleteLocationConfirmOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete location');
    } finally {
      setDeletingPin(false);
    }
  };

  useEffect(() => {
    try { return subscribeToLocationsMapUpdate(() => { try { router.refresh(); } catch { /* ignore */ } }); }
    catch { return undefined; }
  }, [router]);

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
        const google = await loadGoogleMaps().catch(() => null);

        if (!google || cancelled || !containerRef.current) {
          if (!cancelled) setError(GOOGLE_MAPS_ERROR_MESSAGE);
          return;
        }

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
          heading: 0,
          rotateControl: false,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          mapTypeControl: true,
          mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU },
          gestureHandling: 'greedy',
          backgroundColor: '#1a1a2e',
        });
        void addStateLines(map);

        // fitBounds on BLUE PINS ONLY
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
            const m = new google.maps.Marker({ map, position: { lat: p.lat, lng: p.lng }, icon: svgPin(COMPANY_PIN_COLOR, 6), zIndex: 2 });
            listenersRef.current.push(m.addListener('click', () => { try { setSelectedPin({ type: 'location', data: p }); } catch { /* ignore */ } }));
            locationMarkers.push(m);
          } catch { /* skip */ }
        });
        locationMarkersRef.current = locationMarkers;

        mapRef.current = map;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Map failed to load');
      }
    })();

    return () => {
      cancelled = true;
      cleanupListeners();
      locationMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
      locationMarkersRef.current = [];
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyCoords, pointsWithCoords.length]);

  return (
    <Card>
      <AlertModal
        isOpen={deleteLocationConfirmOpen}
        onClose={() => setDeleteLocationConfirmOpen(false)}
        onConfirm={() => void handleDeleteLocationPin()}
        loading={deletingPin}
        description='This location will be removed from the database.'
      />
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <IconMapPin className='h-5 w-5' />
          Map
        </CardTitle>
        <CardDescription>
          {hasAnyCoords
            ? companyName
              ? `${pointsWithCoords.length} location${pointsWithCoords.length === 1 ? '' : 's'} for ${companyName}`
              : `${pointsWithCoords.length} location${pointsWithCoords.length === 1 ? '' : 's'}`
            : 'Add latitude and longitude to a location to see pins on the map'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className='flex min-h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm px-4 text-center'>
            {error}
          </div>
        ) : (
          <div className='space-y-2'>
            <div className='relative rounded-2xl overflow-hidden min-h-[280px] shadow-lg'>
              <div ref={containerRef} className='h-[280px] w-full min-h-[280px] bg-[#1a1a2e]' />
              {selectedPin && (
                <div className='absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-md ios-card ios-animate-in p-5'>
                  <p className='text-[15px] font-semibold text-foreground/90 mb-3 leading-snug'>
                    {selectedPin.data.address}
                  </p>
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
                    {selectedPin.data.locationId && (
                      <button
                        type='button'
                        onClick={() => setDeleteLocationConfirmOpen(true)}
                        disabled={deletingPin}
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
                    {selectedPin.data.locationId && selectedPin.data.companyId && (
                      <Link
                        href={`/${basePath}/companies/${selectedPin.data.companyId}/locations/${selectedPin.data.locationId}`}
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
            {pointsWithCoords.length > 0 && (
              <div className='ios-glass rounded-2xl p-4'>
                <a href={googleEarthUrl(pointsWithCoords[0].lat, pointsWithCoords[0].lng)} target='_blank' rel='noopener noreferrer' className='ios-link text-[14px]'>
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
