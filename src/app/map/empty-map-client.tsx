'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertModal } from '@/components/modal/alert-modal';
import { subscribeToLocationsMapUpdate } from '@/lib/locations-map-update';
import { loadGoogleMaps, GOOGLE_MAPS_ERROR_MESSAGE } from '@/lib/google-maps-loader';
import { addStateLines } from '@/lib/add-state-lines';
import { googleEarthUrl } from '@/lib/google-earth-url';
import { regridUrl } from '@/lib/regrid-url';
import { IconSearch } from '@tabler/icons-react';

/** Company / location markers on the map (not red dots). */
const COMPANY_PIN_COLOR = '#9333ea';

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
}
function openLastLegApp(): void {
  try { setTimeout(() => { window.location.href = 'lastleg://'; }, 300); } catch { /* ignore */ }
}
// SVG data-URI pin — never flashes white on zoom (unlike SymbolPath.CIRCLE)
function svgPin(g: typeof google, color: string, size: number): google.maps.Icon {
  const d = size * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${size}" cy="${size}" r="${size - 1}" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new g.maps.Size(d, d),
    anchor: new g.maps.Point(size, size),
  };
}
// Hard-timeout fetch wrapper — never hangs map init
function fetchWithTimeout(url: string, ms = 5000, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { cache: 'no-store', signal: ctrl.signal, ...init })
    .finally(() => clearTimeout(t));
}

/** Merge MapPin dots with LastLeg route targets at the same coordinate (route wins for enrichment + targetId). */
function mergeRedPins(mapPins: RedPin[], routePins: RedPin[]): RedPin[] {
  const keyOf = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const byKey = new Map<string, RedPin>();
  for (const r of routePins) {
    byKey.set(keyOf(r.lat, r.lng), { ...r });
  }
  for (const m of mapPins) {
    const k = keyOf(m.lat, m.lng);
    const ex = byKey.get(k);
    if (!ex) {
      byKey.set(k, { ...m });
    } else {
      byKey.set(k, {
        ...ex,
        id: m.id ?? ex.id,
        source: m.source ?? ex.source,
      });
    }
  }
  return Array.from(byKey.values());
}

const DEFAULT_CENTER = { lat: 39, lng: -98 };
const DEFAULT_ZOOM = 4;
/** Press-and-hold on the map before a red pin is created (mouse + touch). */
const MAP_PIN_HOLD_MS = 450;
const MAP_PIN_HOLD_MOVE_PX = 12;

type GeoJSONFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: string; companyId: string; addressRaw: string };
};
type GeoJSONResponse = { type: 'FeatureCollection'; features: GeoJSONFeature[] };
type RedPin = {
  lng: number;
  lat: number;
  id?: string;
  source?: 'kml' | 'user';
  label?: string;
  addressRaw?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  summary?: string;
  alternativeNames?: string[];
  accountState?: string;
  targetId?: string;
};
type LocationPin = { locationId: string; companyId: string; addressRaw?: string; lat: number; lng: number };

type PinResearchChosen = {
  name: string;
  formattedAddress: string | null;
  phone: string | null;
  website: string | null;
  mapsUrl: string | null;
};

type PinResearchApiOk = {
  ok: true;
  cached: boolean;
  provider: string;
  llmProvider: string;
  chosen: PinResearchChosen | null;
  candidates: PinResearchChosen[];
  disambiguationNote: string | null;
};

export default function EmptyMapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const locationMarkersRef = useRef<google.maps.Marker[]>([]);
  const dotMarkersRef = useRef<google.maps.Marker[]>([]);
  const unsubMapRef = useRef<(() => void) | null>(null);
  const refetchDotsRef = useRef<(() => Promise<void>) | null>(null);
  const selectedMarkerRef = useRef<google.maps.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedPin, setSelectedPin] = useState<{ type: 'location'; data: LocationPin } | { type: 'dot'; data: RedPin } | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [addingToLastLeg, setAddingToLastLeg] = useState(false);
  /** When true, "Add to LastLeg" is dimmed/disabled until user clicks Reactivate. Red dots start locked (already on map route). */
  const [addToLastLegLocked, setAddToLastLegLocked] = useState(false);
  const [deleteDotConfirmOpen, setDeleteDotConfirmOpen] = useState(false);
  const [deletingRedDot, setDeletingRedDot] = useState(false);
  const [placeResearchHint, setPlaceResearchHint] = useState('');
  const [placeResearchLoading, setPlaceResearchLoading] = useState(false);
  const [placeResearchResult, setPlaceResearchResult] = useState<PinResearchApiOk | null>(null);
  const [mapType, setMapType] = useState<'satellite' | 'roadmap'>('satellite');

  const toggleMapType = () => {
    const newType = mapType === 'satellite' ? 'roadmap' : 'satellite';
    setMapType(newType);
    if (mapRef.current) {
      mapRef.current.setMapTypeId(newType === 'satellite' ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP);
    }
  };
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [pinStatus, setPinStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPin) {
      setPlaceResearchResult(null);
      setPlaceResearchHint('');
      return;
    }
    setPlaceResearchResult(null);
    if (selectedPin.type === 'location') {
      setPlaceResearchHint(selectedPin.data.addressRaw?.trim() ?? '');
    } else {
      setPlaceResearchHint('');
    }
  }, [selectedPin]);

  useEffect(() => {
    if (!selectedPin) return;
    setAddToLastLegLocked(selectedPin.type === 'dot');
  }, [selectedPin]);

  // Sync local pin status from accountState when pin changes
  useEffect(() => {
    if (selectedPin?.type === 'dot') {
      setPinStatus(selectedPin.data.accountState ?? null);
    } else {
      setPinStatus(null);
    }
  }, [selectedPin]);

  const handleSetPrimary = async (name: string) => {
    if (!selectedPin || selectedPin.type !== 'dot' || !selectedPin.data.targetId || settingPrimary) return;
    setSettingPrimary(true);
    try {
      const res = await fetch(`/api/targets/${selectedPin.data.targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ primary_name: name }),
      });
      if (!res.ok) throw new Error('Failed');
      // Update the selected pin's label
      setSelectedPin((prev) =>
        prev?.type === 'dot' ? { ...prev, data: { ...prev.data, label: name } } : prev
      );
      toast.success(`Primary name set to "${name}"`);
    } catch {
      toast.error('Failed to set primary name');
    } finally {
      setSettingPrimary(false);
    }
  };

  const handleSetStatus = async (newState: string) => {
    if (!selectedPin || selectedPin.type !== 'dot' || !selectedPin.data.targetId) return;
    const prev = pinStatus;
    setPinStatus(newState);
    try {
      const res = await fetch(`/api/targets/${selectedPin.data.targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ account_state: newState }),
      });
      if (!res.ok) throw new Error('Failed');
      setSelectedPin((p) =>
        p?.type === 'dot' ? { ...p, data: { ...p.data, accountState: newState } } : p
      );
      toast.success('Status updated');
    } catch {
      setPinStatus(prev);
      toast.error('Failed to update status');
    }
  };

  const handleResearchPlace = async () => {
    if (!selectedPin || placeResearchLoading) return;
    const lat = selectedPin.data.lat;
    const lng = selectedPin.data.lng;
    setPlaceResearchLoading(true);
    try {
      const res = await fetch('/api/pin-place-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          hint: placeResearchHint.trim(),
        }),
      });
      const data = (await res.json()) as PinResearchApiOk | { ok?: false; error?: string };
      if (!res.ok || !data || (data as PinResearchApiOk).ok !== true) {
        const err = (data as { error?: string })?.error ?? `Request failed (${res.status})`;
        throw new Error(err);
      }
      setPlaceResearchResult(data as PinResearchApiOk);
      toast.success((data as PinResearchApiOk).cached ? 'Loaded cached result' : 'Place research complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setPlaceResearchLoading(false);
    }
  };

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', signal: controller.signal, body: JSON.stringify(body)
      });
      let data: { error?: string } = {};
      try { data = await res.json(); } catch {
        data = { error: res.status === 401 ? 'Please sign in.' : `Server error (${res.status})` };
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setAddToLastLegLocked(true);
      if (isMobileDevice()) { toast.success('Added — opening LastLeg…'); openLastLegApp(); }
      else toast.success('Added to LastLeg. Pull to refresh in the app.');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast.error(err instanceof Error ? err.message : 'Failed to add');
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
      const res = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: q }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Could not find address');
      const { latitude: lat, longitude: lng } = data;
      if (typeof lat !== 'number' || typeof lng !== 'number') throw new Error('Invalid result');
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(17);
      toast.success('Zoomed to address');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally { setSearching(false); }
  };

  const handleAddressAddPin = async () => {
    const q = addressSearch.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: q }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Could not find address');
      const { latitude: lat, longitude: lng } = data;
      if (typeof lat !== 'number' || typeof lng !== 'number') throw new Error('Invalid result');
      const pinRes = await fetch('/api/map-pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: lat, longitude: lng }) });
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
    } finally { setSearching(false); }
  };

  const handleDeleteRedPin = async () => {
    if (!selectedPin || selectedPin.type !== 'dot') return;
    const { id, lat, lng } = selectedPin.data;
    setDeletingRedDot(true);
    // Immediately remove the marker from the map for instant visual feedback
    if (selectedMarkerRef.current) {
      try { selectedMarkerRef.current.setMap(null); } catch { /* ignore */ }
      dotMarkersRef.current = dotMarkersRef.current.filter((m) => m !== selectedMarkerRef.current);
      selectedMarkerRef.current = null;
    }
    setSelectedPin(null);
    setDeleteDotConfirmOpen(false);
    try {
      const res = await fetch('/api/map-pins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : { latitude: lat, longitude: lng })
      });
      if (!res.ok) {
        let d: { error?: string } = {};
        try {
          d = await res.json();
        } catch {
          /* ignore */
        }
        throw new Error(d?.error ?? 'Failed');
      }
      const data = (await res.json().catch(() => ({}))) as {
        deletedMapPins?: number;
        by?: string;
      };
      if (!id && data.by === 'coordinates' && data.deletedMapPins === 0) {
        toast.warning('No matching pin in the database (map refreshed).');
      } else {
        toast.success('Pin removed');
      }
      await refetchDotsRef.current?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
      await refetchDotsRef.current?.();
    } finally {
      setDeletingRedDot(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const effectCleanups: Array<() => void> = [];

    void (async () => {
      try {
        let g: typeof google;
        try {
          g = await loadGoogleMaps();
        } catch {
          setError(GOOGLE_MAPS_ERROR_MESSAGE);
          return;
        }
        if (cancelled || !containerRef.current) return;

        const map = new g.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeId: g.maps.MapTypeId.SATELLITE,
          mapTypeControl: true,
          mapTypeControlOptions: { style: g.maps.MapTypeControlStyle.DROPDOWN_MENU },
          backgroundColor: '#1a1a2e',
          gestureHandling: 'greedy',
          tilt: 0,
          heading: 0,
          rotateControl: false,
        });

        // State lines — non-blocking, non-fatal
        void addStateLines(map);

        const clearLocationMarkers = () => {
          locationMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
          locationMarkersRef.current = [];
        };
        const clearDotMarkers = () => {
          dotMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
          dotMarkersRef.current = [];
        };

        const addLocationMarkers = (features: GeoJSONFeature[]) => {
          clearLocationMarkers();
          features.forEach((f) => {
            try {
              const [lng, lat] = f.geometry.coordinates;
              const props = f.properties;
              const marker = new g.maps.Marker({ map, position: { lat, lng }, icon: svgPin(g, COMPANY_PIN_COLOR, 6), zIndex: 2 });
              marker.addListener('click', () => {
                if (props?.id && props?.companyId) setSelectedPin({ type: 'location', data: { locationId: props.id, companyId: props.companyId, addressRaw: props.addressRaw, lat, lng } });
              });
              locationMarkersRef.current.push(marker);
            } catch { /* skip bad feature */ }
          });
        };

        const addDotMarkers = (pins: RedPin[]) => {
          clearDotMarkers();
          pins.forEach((p) => {
            try {
              const marker = new g.maps.Marker({ map, position: { lat: p.lat, lng: p.lng }, icon: svgPin(g, '#dc2626', 5), zIndex: 1 });
              marker.addListener('click', () => {
                selectedMarkerRef.current = marker;
                setSelectedPin({
                  type: 'dot',
                  data: {
                    lng: p.lng,
                    lat: p.lat,
                    id: p.id,
                    source: p.source,
                    label: p.label,
                    addressRaw: p.addressRaw,
                    phone: p.phone,
                    email: p.email,
                    website: p.website,
                    industry: p.industry,
                    summary: p.summary,
                    alternativeNames: p.alternativeNames,
                    accountState: p.accountState,
                    targetId: p.targetId,
                  }
                });
              });
              dotMarkersRef.current.push(marker);
            } catch { /* skip bad pin */ }
          });
        };

        const boundsState: { locations: GeoJSONFeature[]; dots: RedPin[] } = { locations: [], dots: [] };

        const refitViewport = () => {
          if (cancelled || !mapRef.current) return;
          const features = boundsState.locations;
          const pins = boundsState.dots;
          const total = features.length + pins.length;
          if (total < 1) return;
          try {
            if (total > 1) {
              const bounds = new g.maps.LatLngBounds();
              features.forEach((f) => bounds.extend({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }));
              pins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
              map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
            } else if (features[0]) {
              const c = { lat: features[0].geometry.coordinates[1], lng: features[0].geometry.coordinates[0] };
              map.setCenter(c);
              map.setZoom(8);
            } else if (pins[0]) {
              map.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
              map.setZoom(8);
            }
          } catch { /* ignore bounds error */ }
        };

        refetchDotsRef.current = async () => {
          if (cancelled || !mapRef.current) return;
          try {
            const [dotsRes, routeRes] = await Promise.all([
              fetchWithTimeout('/api/dots-pins', 8000),
              fetchWithTimeout('/api/targets/dots', 8000, { credentials: 'include' }),
            ]);
            const dotsData = (await dotsRes.json().catch(() => ({}))) as { pins?: RedPin[] };
            const routeData = (await routeRes.json().catch(() => ({}))) as { pins?: RedPin[] };
            const mapPins = Array.isArray(dotsData.pins) ? dotsData.pins : [];
            const routePins = Array.isArray(routeData.pins) ? routeData.pins : [];
            const merged = mergeRedPins(mapPins, routePins);
            boundsState.dots = merged;
            addDotMarkers(merged);
            refitViewport();
          } catch { /* ignore */ }
        };

        /** Fast static pin coords (CDN); replaced when /api/dots-pins returns. */
        let dotsApiSettled = false;
        void (async () => {
          if (dotsApiSettled || cancelled) return;
          try {
            const r = await fetch('/dots-pins.json', { cache: 'force-cache' });
            if (!r.ok || cancelled || dotsApiSettled) return;
            const j = (await r.json()) as { pins?: unknown };
            if (!Array.isArray(j?.pins)) return;
            const pins: RedPin[] = [];
            for (const raw of j.pins) {
              const o = raw as { lng?: unknown; lat?: unknown; source?: RedPin['source'] };
              const lat = typeof o.lat === 'number' ? o.lat : Number(o.lat);
              const lng = typeof o.lng === 'number' ? o.lng : Number(o.lng);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
              pins.push({
                lng,
                lat,
                source: o.source === 'user' ? 'user' : 'kml',
              });
            }
            if (pins.length === 0 || cancelled || dotsApiSettled) return;
            boundsState.dots = pins;
            addDotMarkers(pins);
            refitViewport();
          } catch { /* ignore */ }
        })();

        void (async () => {
          try {
            const [dotsRes, routeRes] = await Promise.all([
              fetchWithTimeout('/api/dots-pins', 8000),
              fetchWithTimeout('/api/targets/dots', 8000, { credentials: 'include' }),
            ]);
            const dotsData = (await dotsRes.json().catch(() => ({}))) as { pins?: RedPin[] };
            const routeData = (await routeRes.json().catch(() => ({}))) as { pins?: RedPin[] };
            dotsApiSettled = true;
            if (cancelled) return;
            const mapPins = Array.isArray(dotsData.pins) ? dotsData.pins : [];
            const routePins = Array.isArray(routeData.pins) ? routeData.pins : [];
            const merged = mergeRedPins(mapPins, routePins);
            boundsState.dots = merged;
            addDotMarkers(merged);
            refitViewport();
          } catch {
            dotsApiSettled = true;
          }
        })();

        void (async () => {
          try {
            const res = await fetchWithTimeout('/api/locations/map', 8000);
            const data = (await res.json().catch(() => ({}))) as GeoJSONResponse | { features?: GeoJSONFeature[] };
            if (cancelled || !Array.isArray(data?.features)) return;
            boundsState.locations = data.features;
            addLocationMarkers(data.features);
            refitViewport();
          } catch { /* ignore */ }
        })();

        if (cancelled) return;

        // Drop pin only after press-and-hold (pointer events on map div + projection overlay)
        let projection: google.maps.MapCanvasProjection | null = null;
        const overlay = new g.maps.OverlayView();
        overlay.onAdd = () => {};
        overlay.draw = () => {
          projection = overlay.getProjection() ?? null;
        };
        overlay.onRemove = () => {
          projection = null;
        };
        overlay.setMap(map);

        const mapListenerHandles: google.maps.MapsEventListener[] = [];

        let holdTimer: ReturnType<typeof setTimeout> | null = null;
        let holdAnchor: { lat: number; lng: number; clientX: number; clientY: number } | null = null;
        let holdPointerId: number | null = null;

        const cancelPinHold = () => {
          if (holdTimer != null) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }
          holdAnchor = null;
          holdPointerId = null;
          window.removeEventListener('pointerup', onWindowPointerEnd, true);
          window.removeEventListener('pointercancel', onWindowPointerEnd, true);
        };

        const onWindowPointerEnd = () => {
          cancelPinHold();
        };

        const postUserMapPin = async (lat: number, lng: number) => {
          if (cancelled) return;
          try {
            const res = await fetch('/api/map-pins', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ latitude: lat, longitude: lng }),
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
        };

        const armPinHold = (lat: number, lng: number, clientX: number, clientY: number, pointerId: number) => {
          cancelPinHold();
          holdAnchor = { lat, lng, clientX, clientY };
          holdPointerId = pointerId;
          window.addEventListener('pointerup', onWindowPointerEnd, true);
          window.addEventListener('pointercancel', onWindowPointerEnd, true);
          holdTimer = setTimeout(() => {
            holdTimer = null;
            holdAnchor = null;
            holdPointerId = null;
            window.removeEventListener('pointerup', onWindowPointerEnd, true);
            window.removeEventListener('pointercancel', onWindowPointerEnd, true);
            void postUserMapPin(lat, lng);
          }, MAP_PIN_HOLD_MS);
        };

        const mapDiv = map.getDiv();
        const onPointerDown = (ev: PointerEvent) => {
          if (cancelled) return;
          if (!ev.isPrimary) return;
          if (ev.pointerType === 'mouse' && ev.button !== 0) return;
          if (!projection) return;
          const rect = mapDiv.getBoundingClientRect();
          const x = ev.clientX - rect.left;
          const y = ev.clientY - rect.top;
          const latLng = projection.fromContainerPixelToLatLng(new g.maps.Point(x, y));
          if (!latLng) return;
          armPinHold(latLng.lat(), latLng.lng(), ev.clientX, ev.clientY, ev.pointerId);
        };

        const onPointerMove = (ev: PointerEvent) => {
          if (holdTimer == null || holdAnchor == null || holdPointerId == null) return;
          if (ev.pointerId !== holdPointerId) return;
          const dx = ev.clientX - holdAnchor.clientX;
          const dy = ev.clientY - holdAnchor.clientY;
          if (dx * dx + dy * dy > MAP_PIN_HOLD_MOVE_PX * MAP_PIN_HOLD_MOVE_PX) {
            cancelPinHold();
          }
        };

        mapDiv.addEventListener('pointerdown', onPointerDown);
        mapDiv.addEventListener('pointermove', onPointerMove);

        mapListenerHandles.push(
          map.addListener('dragstart', () => {
            cancelPinHold();
          })
        );

        effectCleanups.push(() => {
          cancelPinHold();
          mapDiv.removeEventListener('pointerdown', onPointerDown);
          mapDiv.removeEventListener('pointermove', onPointerMove);
          try {
            overlay.setMap(null);
          } catch {
            /* ignore */
          }
          mapListenerHandles.forEach((h) => {
            try {
              g.maps.event.removeListener(h);
            } catch {
              /* ignore */
            }
          });
          mapListenerHandles.length = 0;
        });

        mapRef.current = map;
        setReady(true);

        unsubMapRef.current = subscribeToLocationsMapUpdate(async () => {
          if (cancelled) return;
          try {
            const res = await fetchWithTimeout('/api/locations/map', 8000);
            const data = await res.json();
            if (data?.features != null && mapRef.current) {
              boundsState.locations = data.features as GeoJSONFeature[];
              addLocationMarkers(boundsState.locations);
              refitViewport();
            }
          } catch { /* ignore */ }
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Map failed to load');
      }
    })();

    return () => {
      cancelled = true;
      effectCleanups.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      effectCleanups.length = 0;
      unsubMapRef.current?.();
      unsubMapRef.current = null;
      refetchDotsRef.current = null;
      locationMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
      locationMarkersRef.current = [];
      dotMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch { /* ignore */ } });
      dotMarkersRef.current = [];
      mapRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#1a1a2e] text-white text-sm rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 w-full">
      <AlertModal
        isOpen={deleteDotConfirmOpen}
        onClose={() => setDeleteDotConfirmOpen(false)}
        onConfirm={() => void handleDeleteRedPin()}
        loading={deletingRedDot}
        description="This map pin will be removed from the database."
      />
      {/* Dark background shown until map tiles load — eliminates white flash */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full bg-[#1a1a2e]" />

      {/* Loading overlay — fades out once map is ready */}
      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1a1a2e] pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-white/60 text-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            Loading map…
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-sm sm:max-w-md">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="ios-glass flex items-center gap-2.5 rounded-2xl px-4 py-2 min-w-0">
            <IconSearch className="h-[18px] w-[18px] shrink-0 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search address..."
              value={addressSearch}
              onChange={(e) => setAddressSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddressGo()}
              className="w-full min-w-[140px] bg-transparent border-none outline-none text-[15px] placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAddressGo}
              disabled={searching || !addressSearch.trim()}
              className="ios-bubble ios-bubble-secondary h-10 px-4 rounded-full text-[14px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go
            </button>
            <button
              type="button"
              onClick={handleAddressAddPin}
              disabled={searching || !addressSearch.trim()}
              className="ios-bubble ios-bubble-primary h-10 px-4 rounded-full text-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add pin
            </button>
          </div>
        </div>
        <p className="text-white/70 text-[13px] drop-shadow-sm pl-1">Or press and hold the map to drop a red pin</p>
      </div>

      {/* Map type toggle */}
      <div className="absolute top-4 right-4 z-10">
        <button
          type="button"
          onClick={toggleMapType}
          className="ios-glass h-10 px-4 rounded-2xl text-[14px] font-medium flex items-center gap-2 hover:bg-white/90 dark:hover:bg-white/20 transition-colors"
        >
          {mapType === 'satellite' ? 'Map' : 'Satellite'}
        </button>
      </div>

      {selectedPin && (
        <div className="absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-md ios-card ios-animate-in p-5">
          {/* Pin title */}
          <p className="text-[15px] font-semibold text-foreground/90 mb-1 leading-snug">
            {selectedPin.type === 'location'
              ? (selectedPin.data.addressRaw || 'Location')
              : (selectedPin.data.label || `Dot ${selectedPin.data.lat.toFixed(5)}, ${selectedPin.data.lng.toFixed(5)}`)}
          </p>

          {/* Additional pin details */}
          {selectedPin.type === 'dot' && (selectedPin.data.addressRaw || selectedPin.data.phone || selectedPin.data.email || selectedPin.data.website || selectedPin.data.industry || selectedPin.data.summary) && (
            <div className="mb-4 space-y-1 text-[14px]">
              {selectedPin.data.addressRaw && (
                <p className="text-muted-foreground/80">{selectedPin.data.addressRaw}</p>
              )}
              {selectedPin.data.industry && (
                <p className="text-muted-foreground/70 text-[13px] italic">{selectedPin.data.industry}</p>
              )}
              {selectedPin.data.phone && (
                <p>
                  <a href={`tel:${selectedPin.data.phone.replace(/\s/g, '')}`} className="ios-link">
                    {selectedPin.data.phone}
                  </a>
                </p>
              )}
              {selectedPin.data.email && (
                <p>
                  <a href={`mailto:${selectedPin.data.email}`} className="ios-link">
                    {selectedPin.data.email}
                  </a>
                </p>
              )}
              {selectedPin.data.website && (
                <p>
                  <a href={selectedPin.data.website} target="_blank" rel="noopener noreferrer" className="ios-link break-all">
                    {selectedPin.data.website}
                  </a>
                </p>
              )}
              {selectedPin.data.summary && (
                <p className="text-muted-foreground/80">{selectedPin.data.summary}</p>
              )}
            </div>
          )}

          {/* Other company names onsite */}
          {selectedPin.type === 'dot' && selectedPin.data.alternativeNames && selectedPin.data.alternativeNames.length > 0 && (
            <div className="mb-4">
              <p className="ios-section-label mb-2">Other names onsite</p>
              <div className="flex flex-wrap gap-2">
                {selectedPin.data.alternativeNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => void handleSetPrimary(name)}
                    disabled={settingPrimary}
                    title="Set as primary name"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-[13px] text-foreground/80 transition-colors disabled:opacity-50"
                  >
                    <span>{name}</span>
                    <span className="text-[11px] text-muted-foreground/60">↑ set primary</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pin status */}
          {selectedPin.type === 'dot' && selectedPin.data.targetId && (
            <div className="mb-4">
              <p className="ios-section-label mb-2">Pin status</p>
              <div className="flex gap-2 flex-wrap">
                {([
                  { state: 'NEW_UNCONTACTED', label: 'Active', color: 'bg-gray-500/20 text-gray-300' },
                  { state: 'NEW_CONTACTED_NO_ANSWER', label: 'No Answer', color: 'bg-red-500/20 text-red-300' },
                  { state: 'ACCOUNT', label: 'Visited', color: 'bg-blue-500/20 text-blue-300' },
                ] as const).map(({ state, label, color }) => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => void handleSetStatus(state)}
                    className={`rounded-full px-3 py-1 text-[13px] font-medium transition-all ${color} ${
                      pinStatus === state ? 'ring-2 ring-white/50 scale-105' : 'opacity-60 hover:opacity-90'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary action buttons */}
          <div className="flex flex-wrap gap-2.5 items-center mb-4">
            <button
              type="button"
              onClick={handleAddToLastLeg}
              disabled={addingToLastLeg || addToLastLegLocked}
              className="ios-bubble ios-bubble-primary h-9 px-4 rounded-full text-[14px] font-semibold tracking-tight"
            >
              {addingToLastLeg ? 'Adding…' : 'Add to LastLeg'}
            </button>
            <button
              type="button"
              onClick={() => setAddToLastLegLocked(false)}
              className="ios-bubble ios-bubble-secondary h-9 px-4 rounded-full text-[14px]"
            >
              Reactivate pin
            </button>
            {selectedPin.type === 'dot' && (
              <button
                type="button"
                onClick={() => setDeleteDotConfirmOpen(true)}
                className="ios-bubble ios-bubble-destructive h-9 px-4 rounded-full text-[14px]"
              >
                Delete pin
              </button>
            )}
          </div>

          {/* Secondary buttons */}
          <div className="flex flex-wrap gap-2.5 items-center mb-4">
            <a
              href={googleEarthUrl(selectedPin.data.lat, selectedPin.data.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="ios-bubble ios-bubble-secondary h-9 px-4 rounded-full text-[14px] inline-flex items-center justify-center"
            >
              Google Earth
            </a>
            <a
              href={regridUrl(selectedPin.data.lat, selectedPin.data.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="ios-bubble ios-bubble-secondary h-9 px-4 rounded-full text-[14px] inline-flex items-center justify-center"
            >
              Regrid
            </a>
            {selectedPin.type === 'location' && (
              <Link
                href={`/map/companies/${selectedPin.data.companyId}/locations/${selectedPin.data.locationId}`}
                className="ios-bubble ios-bubble-secondary h-9 px-4 rounded-full text-[14px] inline-flex items-center justify-center"
              >
                Location page
              </Link>
            )}
            <button
              type="button"
              onClick={() => setSelectedPin(null)}
              className="ios-bubble ios-bubble-ghost h-9 px-4 rounded-full text-[14px]"
            >
              Close
            </button>
          </div>

          {/* Research section divider */}
          <div className="ios-divider mb-4" />

          {/* Research section */}
          <div className="space-y-3">
            <p className="ios-section-label">Research nearby place (Google Places + AI)</p>
            <input
              type="text"
              placeholder="Optional hint: business name or address"
              value={placeResearchHint}
              onChange={(e) => setPlaceResearchHint(e.target.value)}
              className="ios-input w-full text-[15px]"
            />
            <button
              type="button"
              onClick={() => void handleResearchPlace()}
              disabled={placeResearchLoading}
              className="ios-bubble ios-bubble-secondary h-9 px-4 rounded-full text-[14px]"
            >
              {placeResearchLoading ? 'Researching…' : 'Research place'}
            </button>

            {/* Research results */}
            {placeResearchResult && (
              <div className="ios-glass rounded-2xl p-4 text-[14px] space-y-2">
                <p className="ios-section-label normal-case">
                  {(placeResearchResult.cached ? 'Cached · ' : '') + placeResearchResult.provider}
                  {placeResearchResult.llmProvider !== 'none' ? ` · LLM: ${placeResearchResult.llmProvider}` : ''}
                </p>
                {placeResearchResult.chosen ? (
                  <>
                    <p className="font-semibold text-[16px] text-foreground">{placeResearchResult.chosen.name}</p>
                    {placeResearchResult.chosen.formattedAddress && (
                      <p className="text-muted-foreground/80">{placeResearchResult.chosen.formattedAddress}</p>
                    )}
                    {placeResearchResult.chosen.phone && (
                      <p>
                        <a href={`tel:${placeResearchResult.chosen.phone.replace(/\s/g, '')}`} className="ios-link">
                          {placeResearchResult.chosen.phone}
                        </a>
                      </p>
                    )}
                    <div className="flex gap-4 pt-1">
                      {placeResearchResult.chosen.website && (
                        <a href={placeResearchResult.chosen.website} target="_blank" rel="noopener noreferrer" className="ios-link">
                          Website
                        </a>
                      )}
                      {placeResearchResult.chosen.mapsUrl && (
                        <a href={placeResearchResult.chosen.mapsUrl} target="_blank" rel="noopener noreferrer" className="ios-link">
                          Open in Google Maps
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground/80">No place found within search radius.</p>
                )}
                {placeResearchResult.disambiguationNote && (
                  <p className="text-[13px] text-muted-foreground/70 italic pt-1">{placeResearchResult.disambiguationNote}</p>
                )}
                {placeResearchResult.candidates.length > 1 && (
                  <details className="text-[13px] pt-2">
                    <summary className="cursor-pointer text-muted-foreground/70 hover:text-muted-foreground">
                      Other candidates ({placeResearchResult.candidates.length})
                    </summary>
                    <ul className="mt-2 space-y-1.5 pl-1">
                      {placeResearchResult.candidates.map((c, i) => (
                        <li key={i} className="text-muted-foreground/80">
                          {c.name}{c.formattedAddress ? ` — ${c.formattedAddress}` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
