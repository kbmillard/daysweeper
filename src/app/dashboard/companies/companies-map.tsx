'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, GOOGLE_MAPS_ERROR_MESSAGE } from '@/lib/google-maps-loader';

const DEFAULT_CENTER = { lat: 39, lng: -98 };
const DEFAULT_ZOOM = 2;

export default function CompaniesMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    void loadGoogleMaps()
      .catch(() => {
        if (!cancelled) setError(GOOGLE_MAPS_ERROR_MESSAGE);
        return null;
      })
      .then((google) => {
        if (!google || cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        mapTypeControl: true,
        mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU }
      });
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      mapRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div ref={containerRef} className="h-[400px] w-full" />
    </div>
  );
}
