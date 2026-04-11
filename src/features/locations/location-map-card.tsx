'use client';

import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconMapPin } from '@tabler/icons-react';
import { isValidMapboxCoordinate } from '@/lib/geocode-address';
import { loadGoogleMaps, GOOGLE_MAPS_ERROR_MESSAGE } from '@/lib/google-maps-loader';
import { addStateLines } from '@/lib/add-state-lines';
import { googleEarthUrl } from '@/lib/google-earth-url';
import { regridUrl } from '@/lib/regrid-url';
import { notifyLocationsMapUpdate } from '@/lib/locations-map-update';
import { toast } from 'sonner';

const DEFAULT_ZOOM = 18;
const DEFAULT_CENTER = { lat: 39, lng: -98 };
const DEFAULT_ZOOM_NO_COORDS = 4;

/** Single location pin on this page only (no global dots-pins layer). */
const LOCATION_DOT_COLOR = '#9333ea';
const LOCATION_DOT_PX = 7;

function safeNum(v: unknown): number | null {
  const n = Number(v);
  return v != null && !Number.isNaN(n) && Number.isFinite(n) ? n : null;
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
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('[LocationMapCard]', e, i); }
  render() {
    if (this.state.caught) {
      return (
        <div className='flex h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm px-4 text-center'>
          Map unavailable — {this.state.caught}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
type Props = {
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
  locationId?: string | null;
};

// ── Inner map component ──────────────────────────────────────────────────────
function LocationMapCardInner({ latitude, longitude, address, locationId }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  /** Geocoded position for this address when DB coords are missing (map-only; Save persists). */
  const [addressHint, setAddressHint] = useState<{ lat: number; lng: number } | null>(null);

  const hasCoords = isValidMapboxCoordinate(latitude, longitude);
  const savedLat = safeNum(latitude);
  const savedLng = safeNum(longitude);
  const lat = draft?.lat ?? savedLat ?? addressHint?.lat ?? null;
  const lng = draft?.lng ?? savedLng ?? addressHint?.lng ?? null;
  const canEdit = Boolean(locationId);
  const showMap = canEdit || hasCoords;
  const isDirty =
    (savedLat != null && savedLng != null && draft != null && (draft.lat !== savedLat || draft.lng !== savedLng))
    || (savedLat == null && savedLng == null && lat != null && lng != null);

  useEffect(() => {
    if (hasCoords || !canEdit) {
      setAddressHint(null);
      return;
    }
    const q = address?.trim();
    if (!q) {
      setAddressHint(null);
      return;
    }
    let cancelled = false;
    void fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: q }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { latitude?: unknown; longitude?: unknown } | null) => {
        if (cancelled || !data) return;
        const la = safeNum(data.latitude);
        const lo = safeNum(data.longitude);
        if (la != null && lo != null) setAddressHint({ lat: la, lng: lo });
      })
      .catch(() => { /* non-fatal */ });
    return () => {
      cancelled = true;
    };
  }, [hasCoords, canEdit, address]);

  const handleSavePin = async () => {
    if (!locationId || lat == null || lng == null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
      if (!res.ok) {
        let d: { error?: string } = {};
        try { d = await res.json(); } catch { /* ignore */ }
        throw new Error(d?.error ?? 'Failed to save');
      }
      notifyLocationsMapUpdate();
      setDraft(null);
      router.refresh();
      toast.success('Location pin saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!showMap || !containerRef.current) return;

    let cancelled = false;
    const hint = addressHint;
    const initialCenter =
      savedLat != null && savedLng != null
        ? { lat: savedLat, lng: savedLng }
        : hint != null
          ? { lat: hint.lat, lng: hint.lng }
          : DEFAULT_CENTER;
    const initialZoom = hasCoords || hint != null ? DEFAULT_ZOOM : DEFAULT_ZOOM_NO_COORDS;

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

        const map = new google.maps.Map(containerRef.current, {
          center: initialCenter,
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

        // Tight view on this location only (no other pins on this map).
        if (savedLat != null && savedLng != null) {
          listenersRef.current.push(
            google.maps.event.addListenerOnce(map, 'idle', () => {
              try {
                map.setCenter({ lat: savedLat, lng: savedLng });
                map.setZoom(19);
                map.setTilt(0);
              } catch { /* ignore */ }
            })
          );
        } else if (hint != null) {
          listenersRef.current.push(
            google.maps.event.addListenerOnce(map, 'idle', () => {
              try {
                map.setCenter({ lat: hint.lat, lng: hint.lng });
                map.setZoom(19);
                map.setTilt(0);
              } catch { /* ignore */ }
            })
          );
        }

        const pinIcon = svgPin(LOCATION_DOT_COLOR, LOCATION_DOT_PX);
        const pinLat = draft?.lat ?? savedLat ?? hint?.lat ?? null;
        const pinLng = draft?.lng ?? savedLng ?? hint?.lng ?? null;
        const pinPos = pinLat != null && pinLng != null ? { lat: pinLat, lng: pinLng } : null;
        const marker = pinPos
          ? new google.maps.Marker({ map, position: pinPos, icon: pinIcon, draggable: canEdit, zIndex: 2 })
          : null;

        if (marker) {
          if (canEdit) {
            listenersRef.current.push(
              marker.addListener('dragend', () => {
                try {
                  const p = marker.getPosition();
                  if (p) setDraft({ lat: p.lat(), lng: p.lng() });
                } catch { /* ignore */ }
              })
            );
          }
          listenersRef.current.push(marker.addListener('click', () => { try { setShowCard(true); } catch { /* ignore */ } }));
        }

        // Click to place/move pin
        if (canEdit) {
          listenersRef.current.push(
            map.addListener('click', (e: google.maps.MapMouseEvent) => {
              try {
                const pos = e.latLng;
                if (!pos) return;
                const newLat = pos.lat();
                const newLng = pos.lng();
                if (!Number.isFinite(newLat) || !Number.isFinite(newLng)) return;
                setDraft({ lat: newLat, lng: newLng });
                if (marker) {
                  marker.setPosition({ lat: newLat, lng: newLng });
                  marker.setMap(map);
                } else {
                  const m = new google.maps.Marker({ map, position: { lat: newLat, lng: newLng }, icon: pinIcon, draggable: true, zIndex: 2 });
                  listenersRef.current.push(
                    m.addListener('dragend', () => {
                      try { const p = m.getPosition(); if (p) setDraft({ lat: p.lat(), lng: p.lng() }); } catch { /* ignore */ }
                    })
                  );
                  listenersRef.current.push(m.addListener('click', () => { try { setShowCard(true); } catch { /* ignore */ } }));
                  markerRef.current = m;
                }
              } catch { /* ignore click handler error */ }
            })
          );
        }

        mapRef.current = map;
        markerRef.current = marker;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Map failed to load');
      }
    })();

    return () => {
      cancelled = true;
      cleanupListeners();
      try { markerRef.current?.setMap(null); } catch { /* ignore */ }
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [showMap, canEdit, hasCoords, savedLat, savedLng, addressHint?.lat, addressHint?.lng]);

  useEffect(() => {
    try {
      if (!mapRef.current || !markerRef.current || lat == null || lng == null) return;
      markerRef.current.setPosition({ lat, lng });
    } catch { /* ignore */ }
  }, [lat, lng]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <IconMapPin className='h-5 w-5' />
          Map
        </CardTitle>
        <CardDescription>
          {showMap
            ? canEdit
              ? 'Click the map to place or move the pin. Drag to adjust. Save to update (syncs with main map).'
              : address
                ? `Location: ${address}`
                : 'Pin at coordinates'
            : 'Add latitude and longitude to display the map'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className='flex h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm px-4 text-center'>
            {error}
          </div>
        ) : showMap ? (
          <div className='space-y-2'>
            {canEdit && isDirty && (
              <Button size='sm' onClick={handleSavePin} disabled={saving}>
                {saving ? 'Saving…' : 'Save pin'}
              </Button>
            )}
            <div className='relative rounded-lg border overflow-hidden'>
              <div ref={containerRef} className='h-[280px] w-full bg-[#1a1a2e]' />
              {showCard && lat != null && lng != null && (
                <div className='absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg'>
                  <p className='text-sm text-muted-foreground mb-2'>
                    {address || `Pin ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
                  </p>
                  <div className='flex flex-wrap gap-2 items-center'>
                    <a href={googleEarthUrl(lat, lng)} target='_blank' rel='noopener noreferrer' className='text-sm text-primary hover:underline'>
                      Google Earth
                    </a>
                    <a href={regridUrl(lat, lng)} target='_blank' rel='noopener noreferrer' className='text-sm text-primary hover:underline'>
                      Regrid
                    </a>
                    <Button variant='ghost' size='sm' onClick={() => setShowCard(false)}>Close</Button>
                  </div>
                </div>
              )}
            </div>
            {lat != null && lng != null && (
              <div className='rounded-lg border bg-background p-3 shadow-sm'>
                <a href={googleEarthUrl(lat, lng)} target='_blank' rel='noopener noreferrer' className='text-sm text-primary hover:underline mr-4'>
                  Open in Google Earth
                </a>
                <a href={regridUrl(lat, lng)} target='_blank' rel='noopener noreferrer' className='text-sm text-primary hover:underline'>
                  Open in Regrid
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className='flex h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm'>
            No coordinates — edit the location and add latitude &amp; longitude
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LocationMapCard(props: Props) {
  return (
    <MapErrorBoundary>
      <LocationMapCardInner {...props} />
    </MapErrorBoundary>
  );
}
