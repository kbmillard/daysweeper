import type { LatLng } from '@/lib/route-corridor';

/** Stored on `Route.corridorPlanner` and returned by GET/POST `/api/route-planner`. */
export type RoutePlannerState = {
  active: boolean;
  startAddress: string;
  endAddress: string;
  intermediateAddresses: string[];
  radiusMiles: number;
  vertices: LatLng[];
  vertexLabels: string[];
  filteredTargetIds: string[];
  rankedTargetIds: string[];
  updatedAt: string;
};

export function emptyRoutePlannerResponse(): RoutePlannerState {
  return {
    active: false,
    startAddress: '',
    endAddress: '',
    intermediateAddresses: [],
    radiusMiles: 25,
    vertices: [],
    vertexLabels: [],
    filteredTargetIds: [],
    rankedTargetIds: [],
    updatedAt: new Date(0).toISOString()
  };
}

export function parseStoredPlanner(raw: unknown): RoutePlannerState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.active !== true) return null;
  const startAddress = typeof o.startAddress === 'string' ? o.startAddress : '';
  const endAddress = typeof o.endAddress === 'string' ? o.endAddress : '';
  const intermediateAddresses = Array.isArray(o.intermediateAddresses)
    ? o.intermediateAddresses.filter((x): x is string => typeof x === 'string')
    : [];
  const radiusMiles =
    typeof o.radiusMiles === 'number' && Number.isFinite(o.radiusMiles) ? o.radiusMiles : 25;
  const vertices = Array.isArray(o.vertices)
    ? o.vertices
        .map((v) => {
          if (!v || typeof v !== 'object') return null;
          const p = v as Record<string, unknown>;
          const lat = Number(p.lat);
          const lng = Number(p.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { lat, lng };
        })
        .filter((x): x is LatLng => x != null)
    : [];
  const vertexLabels = Array.isArray(o.vertexLabels)
    ? o.vertexLabels.filter((x): x is string => typeof x === 'string')
    : [];
  const filteredTargetIds = Array.isArray(o.filteredTargetIds)
    ? o.filteredTargetIds.filter((x): x is string => typeof x === 'string')
    : [];
  const rankedTargetIds = Array.isArray(o.rankedTargetIds)
    ? o.rankedTargetIds.filter((x): x is string => typeof x === 'string')
    : [];
  const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString();
  return {
    active: true,
    startAddress,
    endAddress,
    intermediateAddresses,
    radiusMiles,
    vertices,
    vertexLabels,
    filteredTargetIds,
    rankedTargetIds,
    updatedAt
  };
}
