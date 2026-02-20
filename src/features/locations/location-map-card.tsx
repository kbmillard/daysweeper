'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconMapPin } from '@tabler/icons-react';
import { isValidMapboxCoordinate } from '@/lib/geocode-address';

const MAPBOX_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';
const DEFAULT_ZOOM = 14;

type Props = {
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
};

export default function LocationMapCard({ latitude, longitude, address }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const markerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasCoords = isValidMapboxCoordinate(latitude, longitude);
  const lat = latitude != null ? Number(latitude) : null;
  const lng = longitude != null ? Number(longitude) : null;

  useEffect(() => {
    if (!hasCoords || lat == null || lng == null) return;

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

      const map = new mapbox.Map({
        container: containerRef.current,
        style: MAPBOX_STYLE,
        center: [lng, lat],
        zoom: DEFAULT_ZOOM
      });

      const marker = new mapbox.Marker({ color: '#0ea5e9' })
        .setLngLat([lng, lat])
        .addTo(map);

      mapRef.current = map;
      markerRef.current = marker;
    });

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [hasCoords, lat, lng]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <IconMapPin className='h-5 w-5' />
          Map
        </CardTitle>
        <CardDescription>
          {hasCoords
            ? address
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
        ) : hasCoords ? (
          <div className='rounded-lg border overflow-hidden'>
            <div ref={containerRef} className='h-[280px] w-full' />
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
