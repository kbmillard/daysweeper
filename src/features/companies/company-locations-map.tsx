'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconMapPin } from '@tabler/icons-react';
import { isValidMapboxCoordinate } from '@/lib/geocode-address';
import { loadGoogleMaps, GOOGLE_MAPS_ERROR_MESSAGE } from '@/lib/google-maps-loader';
import { googleEarthUrl } from '@/lib/google-earth-url';
import { subscribeToLocationsMapUpdate, notifyLocationsMapUpdate } from '@/lib/locations-map-update';
import { toast } from 'sonner';

const DEFAULT_ZOOM = 15;
const DEFAULT_CENTER = { lat: 39, lng: -98 };
const DEFAULT_ZOOM_NO_POINTS = 3;

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
  /** When set, map allows dropping a pin to add a new location for this company (syncs with main map). */
  companyId?: string | null;
};

function createCircleMarker(color: string, size: number): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: size,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 1
  };
}

type RedPin = { lat: number; lng: number };
type LocationPoint = { lat: number; lng: number; address: string; locationId?: string; companyId?: string };
type SelectedPin = { type: 'location'; data: LocationPoint } | { type: 'dot'; data: RedPin } | { type: 'draft'; data: { lat: number; lng: number } };

export default function CompanyLocationsMap({ locations, companyName, basePath = 'map', companyId }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const locationMarkersRef = useRef<google.maps.Marker[]>([]);
  const dotMarkersRef = useRef<google.maps.Marker[]>([]);
  const draftMarkerRef = useRef<google.maps.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null);
  const [draftPin, setDraftPin] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const canDropPin = Boolean(companyId);

  const handleAddLocationAtPin = async () => {
    if (!companyId || !draftPin) return;
    setSaving(true);
    try {
      const addressRaw = `Dropped pin (${draftPin.lat.toFixed(5)}, ${draftPin.lng.toFixed(5)})`;
      const res = await fetch(`/api/companies/${companyId}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressRaw,
          latitude: draftPin.lat,
          longitude: draftPin.lng
        })
      });
      if (!res.ok) {
        const d = await res.json();
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
    const unsub = subscribeToLocationsMapUpdate(() => router.refresh());
    return unsub;
  }, [router]);

  useEffect(() => {
    if (draftPin === null) {
      draftMarkerRef.current?.setMap(null);
      draftMarkerRef.current = null;
    }
  }, [draftPin]);

  const pointsWithCoords: LocationPoint[] = locations.flatMap((loc) => {
    const lat = loc.latitude != null ? Number(loc.latitude) : null;
    const lng = loc.longitude != null ? Number(loc.longitude) : null;
    if (!isValidMapboxCoordinate(lat, lng)) return [];
    return [{
      lat: lat as number,
      lng: lng as number,
      address: loc.addressRaw || 'Location',
      locationId: loc.id,
      companyId: loc.companyId
    }];
  });

  const hasAnyCoords = pointsWithCoords.length > 0;

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let dotsPins: RedPin[] = [];

    void (async () => {
      try {
        const res = await fetch('/api/dots-pins', { cache: 'no-store' });
        const data = await res.json();
        if (Array.isArray(data?.pins)) dotsPins = data.pins.map((p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng }));
      } catch {
        // keep empty
      }
      if (cancelled || !containerRef.current) return;

      const google = await loadGoogleMaps().catch(() => {
        if (!cancelled) setError(GOOGLE_MAPS_ERROR_MESSAGE);
        return null;
      });
      if (!google || cancelled || !containerRef.current) return;

      const total = pointsWithCoords.length + dotsPins.length;
      const [centerLat, centerLng] =
        pointsWithCoords.length > 0
          ? [pointsWithCoords[0].lat, pointsWithCoords[0].lng]
          : dotsPins.length > 0
            ? [dotsPins[0].lat, dotsPins[0].lng]
            : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
      const zoom =
        total === 0
          ? DEFAULT_ZOOM_NO_POINTS
          : total === 1
            ? 17
            : DEFAULT_ZOOM;

      const map = new google.maps.Map(containerRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        mapTypeControl: true,
        mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU }
      });

      const locationMarkers: google.maps.Marker[] = [];
      pointsWithCoords.forEach((p) => {
        const m = new google.maps.Marker({
          map,
          position: { lat: p.lat, lng: p.lng },
          icon: createCircleMarker('#0ea5e9', 6),
          zIndex: 2
        });
        m.addListener('click', () => {
          setSelectedPin({ type: 'location', data: p });
        });
        locationMarkers.push(m);
      });
      locationMarkersRef.current = locationMarkers;

      const dotMarkers: google.maps.Marker[] = [];
      dotsPins.forEach((p) => {
        const m = new google.maps.Marker({
          map,
          position: { lat: p.lat, lng: p.lng },
          icon: createCircleMarker('#dc2626', 5),
          zIndex: 1
        });
        m.addListener('click', () => {
          setSelectedPin({ type: 'dot', data: p });
        });
        dotMarkers.push(m);
      });
      dotMarkersRef.current = dotMarkers;

      if (total > 1) {
        const bounds = new google.maps.LatLngBounds();
        pointsWithCoords.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        dotsPins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
        const currentZoom = map.getZoom() ?? DEFAULT_ZOOM;
        if (currentZoom < DEFAULT_ZOOM) map.setZoom(DEFAULT_ZOOM);
      }

      if (canDropPin) {
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          const pos = e.latLng;
          if (!pos) return;
          const lat = pos.lat();
          const lng = pos.lng();
          draftMarkerRef.current?.setMap(null);
          draftMarkerRef.current = null;
          const m = new google.maps.Marker({
            map,
            position: { lat, lng },
            icon: createCircleMarker('#0ea5e9', 6),
            zIndex: 3
          });
          draftMarkerRef.current = m;
          setDraftPin({ lat, lng });
          setSelectedPin({ type: 'draft', data: { lat, lng } });
        });
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      draftMarkerRef.current?.setMap(null);
      draftMarkerRef.current = null;
      locationMarkersRef.current.forEach((m) => m.setMap(null));
      locationMarkersRef.current = [];
      dotMarkersRef.current.forEach((m) => m.setMap(null));
      dotMarkersRef.current = [];
      mapRef.current = null;
    };
  }, [hasAnyCoords, canDropPin, pointsWithCoords.length, JSON.stringify(pointsWithCoords.map((p) => [p.lat, p.lng]))]);

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
          <div className='flex min-h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm'>
            {error}
          </div>
        ) : (
          <div className='space-y-2'>
            <div className='relative rounded-lg border overflow-hidden min-h-[280px]'>
              <div ref={containerRef} className='h-[280px] w-full min-h-[280px]' />
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
                    <Button variant='ghost' size='sm' onClick={() => { setSelectedPin(null); if (selectedPin.type === 'draft') setDraftPin(null); }}>Close</Button>
                  </div>
                </div>
              )}
            </div>
            {pointsWithCoords.length > 0 && (
              <div className='rounded-lg border bg-background p-3 shadow-sm'>
                <a
                  href={googleEarthUrl(pointsWithCoords[0].lat, pointsWithCoords[0].lng)}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-sm text-primary hover:underline'
                >
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
