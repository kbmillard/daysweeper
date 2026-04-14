import type { LatLng } from '@/lib/route-corridor';

/** One row for the route sheet “in corridor” list (targets + company + seller locations). */
export type CorridorLine = {
  kind: 'target' | 'location' | 'seller';
  label: string;
};

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
  /** Purple company pins inside the corridor (Location ids). */
  filteredLocationIds?: string[];
  rankedLocationIds?: string[];
  /** Grey seller pins inside the corridor (Location ids). */
  filteredSellerLocationIds?: string[];
  rankedSellerLocationIds?: string[];
  /** Ordered labels for the route popout (subset). */
  corridorLines?: CorridorLine[];
  updatedAt: string;
  /** Set by GET /api/route-planner from the Route row (not inside stored corridorPlanner JSON). */
  activeRouteId?: string;
  activeRouteName?: string;
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
    filteredLocationIds: [],
    rankedLocationIds: [],
    filteredSellerLocationIds: [],
    rankedSellerLocationIds: [],
    corridorLines: [],
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
  const filteredLocationIds = Array.isArray(o.filteredLocationIds)
    ? o.filteredLocationIds.filter((x): x is string => typeof x === 'string')
    : [];
  const rankedLocationIds = Array.isArray(o.rankedLocationIds)
    ? o.rankedLocationIds.filter((x): x is string => typeof x === 'string')
    : [];
  const filteredSellerLocationIds = Array.isArray(o.filteredSellerLocationIds)
    ? o.filteredSellerLocationIds.filter((x): x is string => typeof x === 'string')
    : [];
  const rankedSellerLocationIds = Array.isArray(o.rankedSellerLocationIds)
    ? o.rankedSellerLocationIds.filter((x): x is string => typeof x === 'string')
    : [];
  const corridorLines = Array.isArray(o.corridorLines)
    ? o.corridorLines
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const r = row as Record<string, unknown>;
          const kind =
            r.kind === 'location' || r.kind === 'target' || r.kind === 'seller' ? r.kind : null;
          const label = typeof r.label === 'string' ? r.label : '';
          if (!kind || !label.trim()) return null;
          return { kind, label: label.trim() } as CorridorLine;
        })
        .filter((x): x is CorridorLine => x != null)
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
    filteredLocationIds,
    rankedLocationIds,
    filteredSellerLocationIds,
    rankedSellerLocationIds,
    corridorLines,
    updatedAt
  };
}
