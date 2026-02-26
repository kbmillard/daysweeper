'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { subscribeToLocationsMapUpdate } from '@/lib/locations-map-update';
import { loadGoogleMaps, GOOGLE_MAPS_ERROR_MESSAGE } from '@/lib/google-maps-loader';
import { googleEarthUrl } from '@/lib/google-earth-url';
import { IconSearch } from '@tabler/icons-react';

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
}

function openLastLegApp(): void {
  setTimeout(() => { window.location.href = 'lastleg://'; }, 300);
}

const DEFAULT_CENTER = { lat: 39, lng: -98 };
const DEFAULT_ZOOM = 2;

type GeoJSONFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: string; companyId: string; addressRaw: string };
};

type GeoJSONResponse = {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
};

type RedPin = { lng: number; lat: number; id?: string; source?: 'kml' | 'user' };
type LocationPin = { locationId: string; companyId: string; addressRaw?: string; lat: number; lng: number };

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

export default function EmptyMapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const locationMarkersRef = useRef<google.maps.Marker[]>([]);
  const dotMarkersRef = useRef<google.maps.Marker[]>([]);
  const unsubMapRef = useRef<(() => void) | null>(null);
  const refetchDotsRef = useRef<(() => Promise<void>) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<{ type: 'location'; data: LocationPin } | { type: 'dot'; data: RedPin } | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [addingToLastLeg, setAddingToLastLeg] = useState(false);

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
      const body = selectedPin.type === 'location'
        ? { locationId: selectedPin.data.locationId, companyId: selectedPin.data.companyId }
        : { latitude: selectedPin.data.lat, longitude: selectedPin.data.lng };

      const res = await fetch('/api/lastleg/add-to-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify(body)
      });

      let data: { error?: string } = {};
      try { data = await res.json(); } catch {
        data = { error: res.status === 401 ? 'Please sign in.' : `Server error (${res.status})` };
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed');

      setSelectedPin(null);
      if (isMobileDevice()) {
        toast.success('Added — opening LastLeg…');
        openLastLegApp();
      } else {
        toast.success('Added to LastLeg. Pull to refresh in the app.');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error(err instanceof Error ? err.message : 'Failed to add');
      }
    } finally {
      clearTimeout(hardTimeout);
      setAddingToLastLeg(false);
    }
  };

  const handleAddressGo = async () => {
    const q = addressSearch.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: q })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Could not find address');
      const lat = data?.latitude;
      const lng = data?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') throw new Error('Invalid result');
      const map = mapRef.current;
      if (map) {
        map.panTo({ lat, lng });
        map.setZoom(17);
      }
      toast.success('Zoomed to address');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleAddressAddPin = async () => {
    const q = addressSearch.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: q })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Could not find address');
      const lat = data?.latitude;
      const lng = data?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') throw new Error('Invalid result');
      const pinRes = await fetch('/api/map-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });
      const pinData = await pinRes.json();
      if (!pinRes.ok) throw new Error(pinData?.error ?? 'Failed to add pin');
      const pin = pinData?.pin as { id: string; lat: number; lng: number } | undefined;
      if (pin) {
        await refetchDotsRef.current?.();
        setSelectedPin({ type: 'dot', data: { lat: pin.lat, lng: pin.lng, id: pin.id, source: 'user' } });
        mapRef.current?.panTo({ lat: pin.lat, lng: pin.lng });
        mapRef.current?.setZoom(17);
        toast.success('Pin added');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSearching(false);
    }
  };

  const handleDeleteRedPin = async () => {
    if (!selectedPin || selectedPin.type !== 'dot') return;
    const { id, lat, lng } = selectedPin.data;
    try {
      if (id) {
        const res = await fetch(`/api/map-pins/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d?.error ?? 'Failed');
        }
      } else {
        const res = await fetch('/api/dots-pins/hide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: lat, longitude: lng })
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d?.error ?? 'Failed');
        }
      }
      toast.success('Pin removed');
      setSelectedPin(null);
      await refetchDotsRef.current?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    void (async () => {
      let geojson: GeoJSONResponse = { type: 'FeatureCollection', features: [] };
      let dotsPins: RedPin[] = [];
      try {
        const [locRes, dotsRes] = await Promise.all([
          fetch('/api/locations/map', { cache: 'no-store' }),
          fetch('/api/dots-pins', { cache: 'no-store' })
        ]);
        const locData = await locRes.json();
        const dotsData = await dotsRes.json();
        if (locData?.features) geojson = locData;
        if (Array.isArray(dotsData?.pins)) dotsPins = dotsData.pins;
      } catch {
        // keep empty
      }
      if (cancelled || !containerRef.current) return;

      let google: Awaited<ReturnType<typeof loadGoogleMaps>>;
      try {
        google = await loadGoogleMaps();
      } catch {
        if (!cancelled) setError(GOOGLE_MAPS_ERROR_MESSAGE);
        return;
      }
      if (cancelled || !containerRef.current) return;

      const map = new google.maps.Map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        mapTypeControl: true,
        mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU },
        styles: [
          // Make state boundary lines bright white and thick on satellite
          { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#ffffff' }, { weight: 2.5 }, { visibility: 'on' }] },
          { featureType: 'administrative.province', elementType: 'labels', stylers: [{ visibility: 'on' }] },
          { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#ffffff' }, { weight: 2 }, { visibility: 'on' }] }
        ]
      });

      const clearLocationMarkers = () => {
        locationMarkersRef.current.forEach((m) => m.setMap(null));
        locationMarkersRef.current = [];
      };
      const clearDotMarkers = () => {
        dotMarkersRef.current.forEach((m) => m.setMap(null));
        dotMarkersRef.current = [];
      };

      const addLocationMarkers = (features: GeoJSONFeature[]) => {
        clearLocationMarkers();
        features.forEach((f) => {
          const [lng, lat] = f.geometry.coordinates;
          const props = f.properties;
          const marker = new google.maps.Marker({
            map,
            position: { lat, lng },
            icon: createCircleMarker('#0ea5e9', 6),
            zIndex: 2
          });
          marker.addListener('click', () => {
            if (props?.id && props?.companyId) setSelectedPin({ type: 'location', data: { locationId: props.id, companyId: props.companyId, addressRaw: props.addressRaw, lat, lng } });
          });
          locationMarkersRef.current.push(marker);
        });
      };

      const addDotMarkers = (pins: RedPin[]) => {
        clearDotMarkers();
        pins.forEach((p) => {
          const marker = new google.maps.Marker({
            map,
            position: { lat: p.lat, lng: p.lng },
            icon: createCircleMarker('#dc2626', 5),
            zIndex: 1
          });
          marker.addListener('click', () => {
            setSelectedPin({ type: 'dot', data: { lng: p.lng, lat: p.lat, id: p.id, source: p.source } });
          });
          dotMarkersRef.current.push(marker);
        });
      };

      addLocationMarkers(geojson.features);
      addDotMarkers(dotsPins);

      refetchDotsRef.current = async () => {
        if (cancelled || !mapRef.current) return;
        try {
          const res = await fetch('/api/dots-pins', { cache: 'no-store' });
          const data = await res.json();
          if (Array.isArray(data?.pins)) addDotMarkers(data.pins);
        } catch {
          // ignore
        }
      };

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        if (cancelled) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        (async () => {
          try {
            const res = await fetch('/api/map-pins', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ latitude: lat, longitude: lng })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? 'Failed');
            const pin = data?.pin as { id: string; lat: number; lng: number } | undefined;
            if (pin) {
              await refetchDotsRef.current?.();
              setSelectedPin({ type: 'dot', data: { lng: pin.lng, lat: pin.lat, id: pin.id, source: 'user' } });
              toast.success('Pin added');
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to add pin');
          }
        })();
      });

      const total = geojson.features.length + dotsPins.length;
      if (total > 1) {
        const bounds = new google.maps.LatLngBounds();
        geojson.features.forEach((f) => bounds.extend({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }));
        dotsPins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      } else if (total === 1) {
        const c = geojson.features[0]
          ? { lat: geojson.features[0].geometry.coordinates[1], lng: geojson.features[0].geometry.coordinates[0] }
          : { lat: dotsPins[0]!.lat, lng: dotsPins[0]!.lng };
        map.setCenter(c);
        map.setZoom(8);
      }

      mapRef.current = map;

      unsubMapRef.current = subscribeToLocationsMapUpdate(async () => {
        if (cancelled) return;
        try {
          const res = await fetch('/api/locations/map', { cache: 'no-store' });
          const data = await res.json();
          if (data?.features != null && mapRef.current) addLocationMarkers(data.features);
        } catch {
          // ignore
        }
      });
    })();

    return () => {
      unsubMapRef.current?.();
      unsubMapRef.current = null;
      refetchDotsRef.current = null;
      cancelled = true;
      locationMarkersRef.current.forEach((m) => m.setMap(null));
      locationMarkersRef.current = [];
      dotMarkersRef.current.forEach((m) => m.setMap(null));
      dotMarkersRef.current = [];
      mapRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-[100vh] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 w-full">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background/95 shadow-sm backdrop-blur px-2">
            <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Search address..."
              value={addressSearch}
              onChange={(e) => setAddressSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddressGo()}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleAddressGo} disabled={searching || !addressSearch.trim()}>
              Go
            </Button>
            <Button size="sm" onClick={handleAddressAddPin} disabled={searching || !addressSearch.trim()}>
              Add pin
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">Or click the map to drop a red pin</p>
      </div>
      {selectedPin && (
        <div className="absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg">
          <p className="text-sm text-muted-foreground mb-2">
            {selectedPin.type === 'location' ? (selectedPin.data.addressRaw || 'Location') : `Dot ${selectedPin.data.lat.toFixed(5)}, ${selectedPin.data.lng.toFixed(5)}`}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={handleAddToLastLeg} disabled={addingToLastLeg}>
                {addingToLastLeg ? 'Adding…' : 'Add to LastLeg'}
              </Button>
            <a href={googleEarthUrl(selectedPin.data.lat, selectedPin.data.lng)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Google Earth</a>
            {selectedPin.type === 'location' && (
              <Link href={`/map/companies/${selectedPin.data.companyId}/locations/${selectedPin.data.locationId}`} className="text-sm text-primary hover:underline">Location page</Link>
            )}
            {selectedPin.type === 'dot' && (
              <Button variant="destructive" size="sm" onClick={handleDeleteRedPin}>Delete pin</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelectedPin(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
