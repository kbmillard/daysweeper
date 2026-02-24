'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconMapPin } from '@tabler/icons-react';
import { isValidMapboxCoordinate } from '@/lib/geocode-address';
import { loadGoogleMaps, GOOGLE_MAPS_ERROR_MESSAGE } from '@/lib/google-maps-loader';
import { googleEarthUrl } from '@/lib/google-earth-url';
import { notifyLocationsMapUpdate } from '@/lib/locations-map-update';
import { toast } from 'sonner';

const DEFAULT_ZOOM = 19;
const DEFAULT_CENTER = { lat: 39, lng: -98 };
const DEFAULT_ZOOM_NO_COORDS = 4;

type Props = {
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
  /** When set, map allows dropping/moving a pin and saving to this location (syncs with main map). */
  locationId?: string | null;
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

export default function LocationMapCard({ latitude, longitude, address, locationId }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const hasCoords = isValidMapboxCoordinate(latitude, longitude);
  const savedLat = latitude != null ? Number(latitude) : null;
  const savedLng = longitude != null ? Number(longitude) : null;
  const lat = draft?.lat ?? savedLat;
  const lng = draft?.lng ?? savedLng;
  const canEdit = Boolean(locationId);
  const showMap = canEdit || hasCoords;
  const isDirty = draft != null && (savedLat === null || savedLng === null || draft.lat !== savedLat || draft.lng !== savedLng);

  const handleSavePin = async () => {
    if (!locationId || lat == null || lng == null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });
      if (!res.ok) {
        const d = await res.json();
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
    const initialCenter = savedLat != null && savedLng != null ? { lat: savedLat, lng: savedLng } : DEFAULT_CENTER;
    const initialZoom = hasCoords ? DEFAULT_ZOOM : DEFAULT_ZOOM_NO_COORDS;

    void loadGoogleMaps()
      .catch(() => {
        if (!cancelled) setError(GOOGLE_MAPS_ERROR_MESSAGE);
        return null;
      })
      .then((google) => {
        if (!google || cancelled || !containerRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          mapTypeControl: true,
          mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU }
        });

        const pinPos = lat != null && lng != null ? { lat, lng } : null;
        const marker = pinPos
          ? new google.maps.Marker({
              map,
              position: pinPos,
              icon: createCircleMarker('#0ea5e9', 6),
              draggable: canEdit
            })
          : null;

        if (marker && canEdit) {
          marker.addListener('dragend', () => {
            const p = marker.getPosition();
            if (p) setDraft({ lat: p.lat(), lng: p.lng() });
          });
          marker.addListener('click', () => setShowCard(true));
        } else if (marker) {
          marker.addListener('click', () => setShowCard(true));
        }

        if (canEdit) {
          map.addListener('click', (e: google.maps.MapMouseEvent) => {
            const pos = e.latLng;
            if (!pos) return;
            const newLat = pos.lat();
            const newLng = pos.lng();
            setDraft({ lat: newLat, lng: newLng });
            if (marker) {
              marker.setPosition({ lat: newLat, lng: newLng });
              marker.setMap(map);
            } else {
              const m = new google.maps.Marker({
                map,
                position: { lat: newLat, lng: newLng },
                icon: createCircleMarker('#0ea5e9', 6),
                draggable: true
              });
              m.addListener('dragend', () => {
                const p = m.getPosition();
                if (p) setDraft({ lat: p.lat(), lng: p.lng() });
              });
              m.addListener('click', () => setShowCard(true));
              markerRef.current = m;
            }
          });
        }

        mapRef.current = map;
        markerRef.current = marker;
      });

    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [showMap, canEdit, hasCoords, savedLat, savedLng]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || lat == null || lng == null) return;
    markerRef.current.setPosition({ lat, lng });
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
          <div className='flex h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm'>
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
              <div ref={containerRef} className='h-[280px] w-full' />
              {showCard && lat != null && lng != null && (
                <div className='absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg'>
                  <p className='text-sm text-muted-foreground mb-2'>
                    {address || `Pin ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
                  </p>
                  <div className='flex flex-wrap gap-2 items-center'>
                    <a href={googleEarthUrl(lat, lng)} target='_blank' rel='noopener noreferrer' className='text-sm text-primary hover:underline'>
                      Google Earth
                    </a>
                    <Button variant='ghost' size='sm' onClick={() => setShowCard(false)}>Close</Button>
                  </div>
                </div>
              )}
            </div>
            {lat != null && lng != null && (
              <div className='rounded-lg border bg-background p-3 shadow-sm'>
                <a href={googleEarthUrl(lat, lng)} target='_blank' rel='noopener noreferrer' className='text-sm text-primary hover:underline'>
                  Open in Google Earth
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className='flex h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm'>
            No coordinates — edit the location and add latitude & longitude
          </div>
        )}
      </CardContent>
    </Card>
  );
}
