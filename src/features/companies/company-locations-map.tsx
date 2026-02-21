'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconMapPin } from '@tabler/icons-react';
import { isValidMapboxCoordinate } from '@/lib/geocode-address';

const MAPBOX_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';
const DEFAULT_ZOOM = 12;

type LocationWithCoords = {
  id?: string;
  addressRaw: string;
  latitude?: number | null | unknown;
  longitude?: number | null | unknown;
};

type Props = {
  locations: LocationWithCoords[];
  companyName?: string;
};

export default function CompanyLocationsMap({ locations, companyName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const markersRef = useRef<import('mapbox-gl').Marker[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pointsWithCoords = locations
    .map((loc) => {
      const lat = loc.latitude != null ? Number(loc.latitude) : null;
      const lng = loc.longitude != null ? Number(loc.longitude) : null;
      if (!isValidMapboxCoordinate(lat, lng)) return null;
      return { lat: lat!, lng: lng!, address: loc.addressRaw || 'Location' };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const hasAnyCoords = pointsWithCoords.length > 0;

  useEffect(() => {
    if (!hasAnyCoords || pointsWithCoords.length === 0) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token?.trim()) {
      setError('Mapbox token not configured (NEXT_PUBLIC_MAPBOX_TOKEN)');
      return;
    }
    if (!containerRef.current) return;

    let cancelled = false;
    void import('mapbox-gl').then((mapboxgl) => {
      if (cancelled || !containerRef.current) return;
      const mapbox = mapboxgl.default;
      mapbox.accessToken = token;

      const first = pointsWithCoords[0];
      const map = new mapbox.Map({
        container: containerRef.current,
        style: MAPBOX_STYLE,
        center: [first.lng, first.lat],
        zoom: pointsWithCoords.length === 1 ? 14 : DEFAULT_ZOOM
      });

      map.on('load', () => {
        if (cancelled) return;
        const markers: import('mapbox-gl').Marker[] = [];
        pointsWithCoords.forEach((p) => {
          const m = new mapbox.Marker({ color: '#0ea5e9' })
            .setLngLat([p.lng, p.lat])
            .addTo(map);
          markers.push(m);
        });
        markersRef.current = markers;

        if (pointsWithCoords.length > 1) {
          const bounds = new mapbox.LngLatBounds();
          pointsWithCoords.forEach((p) => bounds.extend([p.lng, p.lat]));
          map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
        }
        mapRef.current = map;
      });
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [hasAnyCoords, pointsWithCoords.length, JSON.stringify(pointsWithCoords.map((p) => [p.lat, p.lng]))]);

  return (
    <Card>
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
            : 'Add latitude and longitude to locations to display the map'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className='flex h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm'>
            {error}
          </div>
        ) : hasAnyCoords ? (
          <div className='rounded-lg border overflow-hidden'>
            <div ref={containerRef} className='h-[280px] w-full' />
          </div>
        ) : (
          <div className='flex h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm'>
            No locations with coordinates — add latitude & longitude to display the map
          </div>
        )}
      </CardContent>
    </Card>
  );
}
