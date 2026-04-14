'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IconMapRoute, IconX } from '@tabler/icons-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { RoutePlannerState } from '@/lib/route-planner-types';
import { tryParseLatLng } from '@/lib/mapkit-geocode-client';
import { resolveRouteWaypoint } from '@/lib/route-geocode-client';
import {
  MapPinLayersControl,
  type MapPinLayers
} from '@/components/map/map-pin-layers-control';
import {
  buildLastLegPlannedRouteUrl,
  safeOpenLastLegPlannedRoute
} from '@/lib/lastleg-url';

type Props = {
  onApplied: (state: RoutePlannerState) => void;
  onCleared: () => void;
  /** Keeps the map polyline + pin dimming in sync when this sheet loads server state (e.g. corridor applied on LastLeg iOS). */
  onServerPlannerState?: (state: RoutePlannerState | null) => void;
  pinLayers?: MapPinLayers;
  onPinLayersChange?: (next: MapPinLayers) => void;
};

type RouteRow = {
  id: string;
  name: string;
  updatedAt: string;
  _count: { stops: number };
};

const DEFAULT_LAYERS: MapPinLayers = {
  containers: true,
  companies: true,
  sellers: true
};

/** Corridor hit count for layers that are turned on (matches map emphasis). */
function corridorVisibleCount(state: RoutePlannerState | null, layers: MapPinLayers | undefined): number {
  if (!state?.active) return 0;
  const L = layers ?? DEFAULT_LAYERS;
  let n = 0;
  if (L.containers) n += state.filteredTargetIds.length;
  if (L.companies) n += state.filteredLocationIds?.length ?? 0;
  if (L.sellers) n += state.filteredSellerLocationIds?.length ?? 0;
  return n;
}

function googleDirectionsUrl(vertices: { lat: number; lng: number }[]): string | null {
  if (vertices.length < 2) return null;
  const origin = `${vertices[0].lat},${vertices[0].lng}`;
  const dest = `${vertices[vertices.length - 1].lat},${vertices[vertices.length - 1].lng}`;
  const params = new URLSearchParams({
    api: '1',
    travelmode: 'driving',
    origin,
    destination: dest
  });
  if (vertices.length > 2) {
    const mid = vertices.slice(1, -1).map((v) => `${v.lat},${v.lng}`).join('|');
    params.set('waypoints', mid);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function appleMapsUrl(vertices: { lat: number; lng: number }[]): string | null {
  if (vertices.length < 2) return null;
  const start = `${vertices[0].lat},${vertices[0].lng}`;
  const end = `${vertices[vertices.length - 1].lat},${vertices[vertices.length - 1].lng}`;
  return `https://maps.apple.com/?saddr=${encodeURIComponent(start)}&daddr=${encodeURIComponent(end)}&dirflg=d`;
}

export function RoutePlannerSheet({
  onApplied,
  onCleared,
  onServerPlannerState,
  pinLayers,
  onPinLayersChange
}: Props) {
  const [open, setOpen] = useState(false);
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [vias, setVias] = useState<string[]>([]);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [loading, setLoading] = useState(false);
  const [activeSummary, setActiveSummary] = useState<RoutePlannerState | null>(null);
  const [routeName, setRouteName] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [routes, setRoutes] = useState<RouteRow[]>([]);

  const loadRoutes = useCallback(async () => {
    try {
      const res = await fetch('/api/routes', { credentials: 'include' });
      const j = (await res.json()) as { routes?: RouteRow[] };
      if (Array.isArray(j.routes)) setRoutes(j.routes);
    } catch {
      /* ignore */
    }
  }, []);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch('/api/route-planner', { credentials: 'include' });
      const data = (await res.json()) as RoutePlannerState;
      if (typeof data.activeRouteId === 'string' && data.activeRouteId) {
        setSelectedRouteId(data.activeRouteId);
      }
      if (typeof data.activeRouteName === 'string') {
        setRouteName(data.activeRouteName);
      }
      if (data.active) {
        setActiveSummary(data);
        setStartAddress(data.startAddress);
        setEndAddress(data.endAddress);
        setVias([...data.intermediateAddresses]);
        setRadiusMiles(data.radiusMiles);
        onServerPlannerState?.(data);
      } else {
        setActiveSummary(null);
        onServerPlannerState?.(null);
      }
    } catch {
      /* ignore */
    }
  }, [onServerPlannerState]);

  useEffect(() => {
    if (!open) return;
    void loadState();
    void loadRoutes();
  }, [open, loadState, loadRoutes]);

  const onPickRoute = async (routeId: string) => {
    setSelectedRouteId(routeId);
    try {
      const res = await fetch('/api/route-planner/active-route', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'Could not switch route');
      }
      await loadState();
      toast.success('Switched active route — corridor loaded for this route.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not switch route');
    }
  };

  const addVia = () => setVias((v) => [...v, '']);
  const removeVia = (i: number) => setVias((v) => v.filter((_, j) => j !== i));
  const setVia = (i: number, val: string) =>
    setVias((v) => v.map((x, j) => (j === i ? val : x)));

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not available');
      return;
    }

    const read = (enableHighAccuracy: boolean) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy,
          timeout: enableHighAccuracy ? 30_000 : 35_000,
          maximumAge: enableHighAccuracy ? 0 : 600_000
        });
      });

    const readWatch = () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        let settled = false;
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            if (settled) return;
            settled = true;
            try {
              navigator.geolocation.clearWatch(id);
            } catch {
              /* ignore */
            }
            resolve(pos);
          },
          (err) => {
            if (settled) return;
            settled = true;
            try {
              navigator.geolocation.clearWatch(id);
            } catch {
              /* ignore */
            }
            reject(err);
          },
          { enableHighAccuracy: false, maximumAge: 600_000 }
        );
        setTimeout(() => {
          if (settled) return;
          settled = true;
          try {
            navigator.geolocation.clearWatch(id);
          } catch {
            /* ignore */
          }
          reject(Object.assign(new Error('timeout'), { code: 3 }));
        }, 50_000);
      });

    const applyPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      setStartAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      toast.success('Start set to your location');
    };

    void (async () => {
      try {
        applyPosition(await read(true));
      } catch {
        try {
          applyPosition(await read(false));
        } catch {
          try {
            applyPosition(await readWatch());
          } catch (e) {
            const code =
              typeof e === 'object' && e !== null && 'code' in e
                ? (e as GeolocationPositionError).code
                : undefined;
            const hint =
              code === 1
                ? 'Permission was denied.'
                : code === 3
                  ? 'Timed out — try again or enter lat, lng manually.'
                  : 'Location unavailable in this browser.';
            toast.error('Could not read your location', { description: hint });
          }
        }
      }
    })();
  };

  const apply = async () => {
    if (!startAddress.trim() || !endAddress.trim()) {
      toast.error('Enter start and end');
      return;
    }
    setLoading(true);
    try {
      const resolvePoint = async (addr: string) => {
        const direct = tryParseLatLng(addr);
        if (direct) return direct;
        return resolveRouteWaypoint(addr);
      };

      const vertices: { lat: number; lng: number }[] = [];
      const vertexLabels: string[] = [];

      vertices.push(await resolvePoint(startAddress.trim()));
      vertexLabels.push('Start');

      const viaStrings = vias.map((s) => s.trim()).filter(Boolean);
      let viaOrdinal = 0;
      for (const via of viaStrings) {
        vertices.push(await resolvePoint(via));
        viaOrdinal += 1;
        vertexLabels.push(`Stop ${viaOrdinal}`);
      }

      vertices.push(await resolvePoint(endAddress.trim()));
      vertexLabels.push('End');

      const res = await fetch('/api/route-planner/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAddress: startAddress.trim(),
          endAddress: endAddress.trim(),
          intermediateAddresses: viaStrings,
          radiusMiles,
          vertices,
          vertexLabels,
          routeName: routeName.trim() || undefined
        })
      });
      const data = (await res.json()) as RoutePlannerState & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      setActiveSummary(data);
      if (typeof data.activeRouteName === 'string') setRouteName(data.activeRouteName);
      if (typeof data.activeRouteId === 'string') setSelectedRouteId(data.activeRouteId);
      onApplied(data);
      const vis = corridorVisibleCount(data, pinLayers);
      const L = pinLayers ?? DEFAULT_LAYERS;
      const parts: string[] = [];
      if (L.containers) parts.push(`${data.filteredTargetIds.length} route targets`);
      if (L.companies) parts.push(`${data.filteredLocationIds?.length ?? 0} company pins`);
      if (L.sellers) parts.push(`${data.filteredSellerLocationIds?.length ?? 0} seller pins`);
      toast.success(
        vis > 0 ? `${vis} in corridor (${parts.join(' · ')})` : 'Corridor applied (no pins in range for visible layers)'
      );
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Apply failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const clearPlanner = async () => {
    try {
      const res = await fetch('/api/route-planner', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Clear failed');
      setActiveSummary(null);
      setStartAddress('');
      setEndAddress('');
      setVias([]);
      setRadiusMiles(25);
      onCleared();
      toast.success('Route corridor cleared');
      setOpen(false);
    } catch {
      toast.error('Could not clear planner');
    }
  };

  const sendRouteToLastLeg = async () => {
    const routeId = selectedRouteId.trim();
    if (!routeId) {
      toast.error('Choose a route in “LastLeg route” first.');
      return;
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const deepLink = buildLastLegPlannedRouteUrl({ routeId, baseUrl });
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent ?? '' : '';
    const isMobile =
      /iPhone|iPad|iPod|Android/i.test(ua) || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0);

    if (isMobile) {
      safeOpenLastLegPlannedRoute(routeId, baseUrl);
      toast.message('LastLeg', {
        description:
          'Opening the app with this route id. In LastLeg, fetch the route and add it to planned routes (see LASTLEG_URL_SCHEME.md).'
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(deepLink);
      toast.success('LastLeg link copied', {
        description:
          'Paste on iPhone (Notes/Messages) and tap to open, or build URL handling in LastLeg for planned-route.'
      });
    } catch {
      toast.message('Open from iPhone', {
        description: `LastLeg should register lastleg://planned-route — route id ${routeId}.`
      });
    }
  };

  const gUrl = activeSummary?.active ? googleDirectionsUrl(activeSummary.vertices) : null;
  const aUrl = activeSummary?.active ? appleMapsUrl(activeSummary.vertices) : null;
  const badgeCount = corridorVisibleCount(activeSummary, pinLayers);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type='button'
          className='ios-glass flex h-10 items-center gap-2 rounded-2xl px-3 text-[14px] font-semibold text-foreground shadow-sm'
          title='Route corridor planner (same as LastLeg route tab)'
        >
          <IconMapRoute className='h-[18px] w-[18px] shrink-0 text-pink-500' />
          <span className='hidden sm:inline'>Route</span>
          {activeSummary?.active && (
            <span className='rounded-full bg-pink-500/20 px-2 py-0.5 text-[11px] text-pink-200'>
              {badgeCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side='right'
        className='flex w-full flex-col gap-0 overflow-y-auto border-l border-white/10 bg-[#1a1a2e] p-0 text-white sm:max-w-md'
      >
        <SheetHeader className='border-b border-white/10 px-4 py-4 text-left'>
          <SheetTitle className='flex items-center gap-2 text-lg text-white'>
            <IconMapRoute className='h-5 w-5 text-pink-400' />
            Route corridor
          </SheetTitle>
          <p className='text-left text-[13px] font-normal text-white/60'>
            Waypoints use <span className='text-white/80'>Apple MapKit</span> when available, then{' '}
            <span className='text-white/80'>Google Geocoder</span> (same key as the map). You can always
            paste <span className='text-white/80'>lat, lng</span>. Corridor is saved on the route below and
            syncs to LastLeg with your account.
          </p>
        </SheetHeader>

        <div className='flex flex-1 flex-col gap-4 px-4 py-4'>
          <div className='space-y-2'>
            <Label className='text-white/80'>LastLeg route</Label>
            <Select
              value={selectedRouteId || undefined}
              onValueChange={(v) => void onPickRoute(v)}
            >
              <SelectTrigger className='h-10 w-full max-w-full border-white/15 bg-white/5 text-white'>
                <SelectValue placeholder='Select route…' />
              </SelectTrigger>
              <SelectContent>
                {routes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r._count.stops} stops)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-[12px] text-white/45'>
              Choosing a route loads its saved corridor (if any). Apply below updates this route for the
              LastLeg app after refresh.
            </p>
          </div>

          <div className='space-y-2'>
            <Label className='text-white/80'>Route name</Label>
            <Input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder='Name shown in Daysweeper + LastLeg'
              className='border-white/15 bg-white/5 text-white placeholder:text-white/35'
            />
          </div>

          {pinLayers && onPinLayersChange && (
            <div className='rounded-xl border border-white/10 bg-white/5 px-3 py-3'>
              <p className='mb-2 text-[12px] font-medium uppercase tracking-wide text-white/50'>
                Map pin layers
              </p>
              <MapPinLayersControl variant='dark' value={pinLayers} onChange={onPinLayersChange} />
            </div>
          )}
          {activeSummary?.active && (
            <div className='rounded-xl border border-pink-500/30 bg-pink-500/10 px-3 py-2 text-[13px] text-pink-100'>
              Active: {activeSummary.filteredTargetIds.length} route targets ·{' '}
              {activeSummary.filteredLocationIds?.length ?? 0} company locations ·{' '}
              {activeSummary.filteredSellerLocationIds?.length ?? 0} seller locations ·{' '}
              {activeSummary.radiusMiles} mi radius
            </div>
          )}

          {activeSummary?.active && (activeSummary.corridorLines?.length ?? 0) > 0 && (
            <div className='rounded-xl border border-white/10 bg-white/5 px-3 py-2'>
              <p className='mb-2 text-[12px] font-medium uppercase tracking-wide text-white/50'>
                In corridor (along route)
              </p>
              <ol className='max-h-48 list-decimal space-y-1 overflow-y-auto pl-4 text-[13px] text-white/85'>
                {(activeSummary.corridorLines ?? []).map((line, i) => (
                  <li key={`${line.kind}-${i}`}>
                    <span className='text-white/50'>
                      {line.kind === 'target'
                        ? 'Route · '
                        : line.kind === 'seller'
                          ? 'Seller · '
                          : 'Company · '}
                    </span>
                    {line.label}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label className='text-white/80'>Start</Label>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-8 text-emerald-400 hover:text-emerald-300'
                onClick={useMyLocation}
              >
                My location
              </Button>
            </div>
            <Input
              value={startAddress}
              onChange={(e) => setStartAddress(e.target.value)}
              placeholder='Address or lat, lng'
              className='border-white/15 bg-white/5 text-white placeholder:text-white/35'
            />
          </div>

          {vias.map((via, i) => (
            <div key={i} className='flex gap-2'>
              <div className='min-w-0 flex-1 space-y-2'>
                <Label className='text-white/80'>Stop {i + 1}</Label>
                <Input
                  value={via}
                  onChange={(e) => setVia(i, e.target.value)}
                  placeholder='Stop address or lat, lng'
                  className='border-white/15 bg-white/5 text-white placeholder:text-white/35'
                />
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='mt-8 shrink-0 text-white/50 hover:text-white'
                onClick={() => removeVia(i)}
              >
                <IconX className='h-5 w-5' />
              </Button>
            </div>
          ))}

          <Button
            type='button'
            variant='outline'
            className='border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
            onClick={addVia}
          >
            + Add stop
          </Button>

          <div className='space-y-2'>
            <Label className='text-white/80'>End</Label>
            <Input
              value={endAddress}
              onChange={(e) => setEndAddress(e.target.value)}
              placeholder='Address or lat, lng'
              className='border-white/15 bg-white/5 text-white placeholder:text-white/35'
            />
          </div>

          <div className='space-y-3'>
            <div className='flex justify-between text-[13px] text-white/70'>
              <span>Corridor radius</span>
              <span className='font-semibold text-pink-400'>{radiusMiles} mi</span>
            </div>
            <Slider
              value={[radiusMiles]}
              min={5}
              max={100}
              step={5}
              onValueChange={(v) => setRadiusMiles(v[0] ?? 25)}
              className='py-1'
            />
          </div>

          <div className='flex flex-col gap-2 pt-2'>
            <Button
              type='button'
              disabled={loading || !startAddress.trim() || !endAddress.trim()}
              className='bg-gradient-to-r from-pink-500 to-pink-700 font-semibold text-white'
              onClick={() => void apply()}
            >
              {loading ? 'Applying…' : 'Apply route filter'}
            </Button>
            <Button
              type='button'
              variant='outline'
              className='border-sky-500/40 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20'
              disabled={!selectedRouteId.trim()}
              onClick={() => void sendRouteToLastLeg()}
            >
              Send route to LastLeg
            </Button>
            <Button
              type='button'
              variant='ghost'
              className='text-white/60 hover:text-white'
              onClick={() => void clearPlanner()}
            >
              Clear corridor
            </Button>
          </div>

          {activeSummary?.active && activeSummary.vertices.length >= 2 && (
            <div className='flex flex-wrap gap-2 border-t border-white/10 pt-4'>
              {gUrl && (
                <a
                  href={gUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='ios-bubble ios-bubble-secondary inline-flex h-9 items-center rounded-full px-4 text-[13px]'
                >
                  Google Maps (drive)
                </a>
              )}
              {aUrl && (
                <a
                  href={aUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='ios-bubble ios-bubble-secondary inline-flex h-9 items-center rounded-full px-4 text-[13px]'
                >
                  Apple Maps (drive)
                </a>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
