'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import { subscribeToLocationsMapUpdate } from '@/lib/locations-map-update';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const MAPBOX_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';
const DEFAULT_CENTER: [number, number] = [-98, 39];
const DEFAULT_ZOOM = 2;
const MARKER_COLOR = '#0ea5e9';
const DOTS_MARKER_COLOR = '#dc2626';
const DOTS_DELETED_STORAGE_KEY = 'daysweeper-dots-deleted';

function dotKey(lng: number, lat: number): string {
  return `${Number(lng.toFixed(5))},${Number(lat.toFixed(5))}`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

type GeoJSONFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { id: string; companyId: string; addressRaw: string };
  }>;
};

export default function EmptyMapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const mapboxglRef = useRef<typeof import('mapbox-gl').default | null>(null);
  const markersRef = useRef<import('mapbox-gl').Marker[]>([]);
  const dotsMarkersRef = useRef<import('mapbox-gl').Marker[]>([]);
  const deletedDotsRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinCount, setPinCount] = useState<number | null>(null);
  const [deletedDotsCount, setDeletedDotsCount] = useState(0);

  const applyLocationsToMap = useCallback((geo: GeoJSONFeatureCollection) => {
    const map = mapRef.current;
    const mgl = mapboxglRef.current;
    if (!map || !mgl) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    geo.features.forEach((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const { id: locationId, companyId, addressRaw } = f.properties;
      const marker = new mgl.Marker({ color: MARKER_COLOR })
        .setLngLat([lng, lat])
        .addTo(map);
      marker.getElement().addEventListener('click', () => {
        new mgl.Popup()
          .setLngLat([lng, lat])
          .setHTML(
            `<div class="mapboxgl-popup-content-pin p-2 min-w-[200px]">
            <p class="text-sm font-medium text-gray-900 truncate" title="${escapeHtml(addressRaw)}">${escapeHtml(addressRaw || 'No address')}</p>
            <div class="mt-2 flex flex-col gap-1">
              <a href="/map/companies/${companyId}" class="text-xs text-blue-600 hover:underline">View company →</a>
              <button type="button" class="text-left text-xs text-blue-600 hover:underline add-to-lastleg-pin-btn" data-location-id="${escapeHtml(locationId)}" data-company-id="${escapeHtml(companyId)}">Add to LastLeg</button>
            </div>
          </div>`
          )
          .addTo(map);
      });
      marker.getElement().style.cursor = 'pointer';
      markersRef.current.push(marker);
    });
    setPinCount(geo.features.length);
  }, []);

  const fetchAndApplyLocations = useCallback(() => {
    const url = `/api/locations/map?t=${Date.now()}`;
    fetch(url, { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data: GeoJSONFeatureCollection | { error?: string }) => {
        if (!mapRef.current) return;
        const geo = data && typeof data === 'object' && 'type' in data && data.type === 'FeatureCollection' && 'features' in data && Array.isArray(data.features) ? data : null;
        if (geo) applyLocationsToMap(geo);
      })
      .catch(() => {});
  }, [applyLocationsToMap]);

  const updateLocationsOnMap = useCallback(() => {
    if (!mapRef.current) return;
    fetchAndApplyLocations();
  }, [fetchAndApplyLocations]);

  const fetchAndApplyDotsPins = useCallback(() => {
    const map = mapRef.current;
    const mgl = mapboxglRef.current;
    if (!map || !mgl) return;
    dotsMarkersRef.current.forEach((m) => m.remove());
    dotsMarkersRef.current = [];
    fetch('/dots-pins.json?t=' + Date.now(), { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { pins?: Array<{ lng: number; lat: number }> }) => {
        const m = mapRef.current;
        const gl = mapboxglRef.current;
        if (!m || !gl || !Array.isArray(data?.pins)) return;
        const deleted = deletedDotsRef.current;
        const pinsToShow = data.pins.filter(({ lng, lat }) => !deleted.has(dotKey(lng, lat)));
        pinsToShow.forEach(({ lng, lat }) => {
          const key = dotKey(lng, lat);
          const marker = new gl.Marker({ color: DOTS_MARKER_COLOR })
            .setLngLat([lng, lat])
            .addTo(m);
          marker.getElement().addEventListener('click', () => {
            new gl.Popup()
              .setLngLat([lng, lat])
              .setHTML(
                `<div class="p-2 min-w-[160px]">
                  <p class="text-xs text-gray-600 mb-2">Red dot (from Dots.kml)</p>
                  <button type="button" class="remove-dot-pin-btn text-xs text-red-600 hover:underline" data-dot-key="${escapeHtml(key)}">Remove from map</button>
                </div>`
              )
              .addTo(m);
          });
          marker.getElement().style.cursor = 'pointer';
          dotsMarkersRef.current.push(marker);
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DOTS_DELETED_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) {
          deletedDotsRef.current = new Set(arr);
          setDeletedDotsCount(arr.length);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleAddToLastLegClick = async (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('.add-to-lastleg-pin-btn');
      if (!btn) return;
      e.preventDefault();
      const locationId = btn.getAttribute('data-location-id');
      const companyId = btn.getAttribute('data-company-id');
      if (!locationId || !companyId) return;
      try {
        const res = await fetch('/api/lastleg/add-to-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId, companyId })
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data?.error ?? 'Could not add to LastLeg');
          return;
        }
        toast.success('Added to LastLeg route');
      } catch {
        toast.error('Could not add to LastLeg');
      }
    };

    const handleRemoveDotClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('.remove-dot-pin-btn');
      if (!btn) return;
      e.preventDefault();
      const key = btn.getAttribute('data-dot-key');
      if (!key) return;
      deletedDotsRef.current.add(key);
      try {
        localStorage.setItem(
          DOTS_DELETED_STORAGE_KEY,
          JSON.stringify(Array.from(deletedDotsRef.current))
        );
      } catch {
        // ignore
      }
      fetchAndApplyDotsPins();
      setDeletedDotsCount(deletedDotsRef.current.size);
      toast.success('Pin removed from map');
    };

    const onDocClick = (e: MouseEvent) => {
      handleAddToLastLegClick(e);
      handleRemoveDotClick(e);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [fetchAndApplyDotsPins]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token?.trim()) {
      setError('Mapbox token not configured (NEXT_PUBLIC_MAPBOX_TOKEN)');
      return;
    }
    if (!containerRef.current) return;

    let cancelled = false;
    void import('mapbox-gl').then((mapboxgl) => {
      if (cancelled || !containerRef.current) return;
      mapboxglRef.current = mapboxgl.default;
      mapboxgl.default.accessToken = token;
      const map = new mapboxgl.default.Map({
        container: containerRef.current,
        style: MAPBOX_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM
      });
      mapRef.current = map;

      map.on('load', () => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled || !mapRef.current) return;
          fetchAndApplyLocations();
          fetchAndApplyDotsPins();
        });
        pollIntervalRef.current = setInterval(() => {
          if (cancelled || !mapRef.current) return;
          fetchAndApplyLocations();
        }, 5000);
      });
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') updateLocationsOnMap();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const unsubscribe = subscribeToLocationsMapUpdate(updateLocationsOnMap);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      dotsMarkersRef.current.forEach((m) => m.remove());
      dotsMarkersRef.current = [];
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      mapboxglRef.current = null;
    };
  }, [updateLocationsOnMap, fetchAndApplyLocations, fetchAndApplyDotsPins]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {pinCount !== null && (
          <p className="text-sm text-muted-foreground">
            {pinCount === 0
              ? 'No locations with coordinates — add lat/long on a location page to see pins here'
              : `${pinCount} location${pinCount === 1 ? '' : 's'} on map`}
          </p>
        )}
        <div className="flex items-center gap-3 shrink-0">
          {deletedDotsCount > 0 && (
            <button
              type="button"
              onClick={() => {
                deletedDotsRef.current.clear();
                try {
                  localStorage.removeItem(DOTS_DELETED_STORAGE_KEY);
                } catch {}
                setDeletedDotsCount(0);
                fetchAndApplyDotsPins();
                toast.success('Red pins restored');
              }}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Restore red pins
            </button>
          )}
          <button
            type="button"
            onClick={updateLocationsOnMap}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Refresh locations
          </button>
        </div>
      </div>
      <div className="rounded-lg border overflow-hidden min-h-[calc(100vh-12rem)]">
        <div ref={containerRef} className="h-full min-h-[calc(100vh-12rem)] w-full" />
      </div>
    </div>
  );
}
