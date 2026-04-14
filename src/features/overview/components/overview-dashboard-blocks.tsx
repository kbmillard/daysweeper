'use client';

import { useThemeConfig } from '@/components/active-theme';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical, IconTrendingUp } from '@tabler/icons-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import type { OverviewKpiStats } from '@/lib/overview-kpi-stats';
import { cn } from '@/lib/utils';
import { OverviewKpiCard } from './overview-kpi-card';

const BLOCK_GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs';

const LOCAL_KEY = 'daysweeper-overview-block-order';

export const OVERVIEW_KPI_IDS = [
  'leads',
  'companies-suppliers',
  'companies-sellers',
  'locations-suppliers',
  'locations-geocoded',
  'locations-not-geocoded',
  'locations-sellers',
  'container-pins'
] as const;

export type OverviewKpiId = (typeof OVERVIEW_KPI_IDS)[number];

export const OVERVIEW_BLOCK_IDS_EXTRA = ['geocode', 'chart'] as const;

export type OverviewBlockId =
  | OverviewKpiId
  | (typeof OVERVIEW_BLOCK_IDS_EXTRA)[number];

const DOT = {
  supplierPurple: '#9333ea',
  sellerGrey: '#78716c'
} as const;

function studFrameStyle(theme: string): CSSProperties {
  const hues: Record<string, { ring: string; glow: string }> = {
    default: {
      ring: 'rgba(100, 116, 139, 0.4)',
      glow: 'rgba(148, 163, 184, 0.22)'
    },
    blue: {
      ring: 'rgba(37, 99, 235, 0.5)',
      glow: 'rgba(59, 130, 246, 0.28)'
    },
    green: {
      ring: 'rgba(22, 163, 74, 0.5)',
      glow: 'rgba(34, 197, 94, 0.26)'
    },
    amber: {
      ring: 'rgba(217, 119, 6, 0.55)',
      glow: 'rgba(245, 158, 11, 0.3)'
    },
    'default-scaled': {
      ring: 'rgba(100, 116, 139, 0.45)',
      glow: 'rgba(148, 163, 184, 0.24)'
    },
    'blue-scaled': {
      ring: 'rgba(37, 99, 235, 0.55)',
      glow: 'rgba(59, 130, 246, 0.3)'
    },
    'mono-scaled': {
      ring: 'rgba(82, 82, 91, 0.55)',
      glow: 'rgba(113, 113, 122, 0.22)'
    }
  };
  const h = hues[theme] ?? hues.default;
  return {
    boxShadow: `0 0 0 1px ${h.ring}, 0 10px 36px -10px ${h.glow}, 0 4px 16px -6px ${h.glow}`
  };
}

function defaultBlockIds(hasChart: boolean): OverviewBlockId[] {
  return [
    ...OVERVIEW_KPI_IDS,
    'geocode',
    ...(hasChart ? (['chart'] as const) : [])
  ];
}

function normalizeBlockOrder(
  saved: string[] | undefined,
  hasChart: boolean
): OverviewBlockId[] {
  const defaults = defaultBlockIds(hasChart);
  const allowed = new Set<string>(defaults);
  const seen = new Set<string>();
  const out: OverviewBlockId[] = [];
  if (saved) {
    for (const id of saved) {
      if (allowed.has(id) && !seen.has(id)) {
        out.push(id as OverviewBlockId);
        seen.add(id);
      }
    }
  }
  for (const id of defaults) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

function readLocalBlockOrder(hasChart: boolean): OverviewBlockId[] | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      const legacy = localStorage.getItem('daysweeper-overview-kpi-order');
      if (!legacy) return undefined;
      const parsed = JSON.parse(legacy) as unknown;
      if (!Array.isArray(parsed)) return undefined;
      const merged = [
        ...(parsed as string[]),
        'geocode',
        ...(hasChart ? (['chart'] as const) : [])
      ];
      return normalizeBlockOrder(merged, hasChart);
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return normalizeBlockOrder(parsed as string[], hasChart);
  } catch {
    return undefined;
  }
}

function TitleDot({ color }: { color: string }) {
  return (
    <span
      className='inline-block size-2.5 shrink-0 rounded-full ring-1 ring-border'
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function renderKpiCard(id: OverviewKpiId, s: OverviewKpiStats) {
  switch (id) {
    case 'leads':
      return (
        <OverviewKpiCard
          description='Different company leads in your database'
          value={s.totalCompanies}
          badgeText={`${s.companiesThisMonth} this month`}
          footerTop={
            <>
              {s.companiesThisMonth} leads added this month{' '}
              <IconTrendingUp className='inline size-4 align-text-bottom' />
            </>
          }
          footerMuted={
            <>
              Leads in your database · {s.totalLocations.toLocaleString()}{' '}
              location rows total
            </>
          }
        />
      );
    case 'companies-suppliers':
      return (
        <OverviewKpiCard
          description={
            <>
              <TitleDot color={DOT.supplierPurple} />
              Companies (suppliers)
            </>
          }
          value={s.countCompaniesNonSeller}
          badgeText='by CRM status'
          footerMuted='Non-seller companies with at least one location'
          statusRows={s.breakdownCompaniesNonSeller}
        />
      );
    case 'companies-sellers':
      return (
        <OverviewKpiCard
          description={
            <>
              <TitleDot color={DOT.sellerGrey} />
              Companies (sellers)
            </>
          }
          value={s.countCompaniesSeller}
          badgeText='by CRM status'
          footerMuted='Seller / vendor-research companies (grey map layer when geocoded)'
          statusRows={s.breakdownCompaniesSeller}
        />
      );
    case 'locations-suppliers':
      return (
        <OverviewKpiCard
          description={
            <>
              <TitleDot color={DOT.supplierPurple} />
              Locations (suppliers)
            </>
          }
          value={s.locationsNonSeller}
          badgeText={
            s.countCompaniesNonSeller > 0
              ? `${(s.locationsNonSeller / s.countCompaniesNonSeller).toFixed(1)} per company`
              : '—'
          }
          footerMuted='All location rows for supplier companies'
        />
      );
    case 'locations-geocoded':
      return (
        <OverviewKpiCard
          description='Company locations geocoded'
          value={s.locationsGeocoded}
          badgeText={
            s.totalLocations > 0
              ? `${((100 * s.locationsGeocoded) / s.totalLocations).toFixed(0)}% geocoded`
              : '—'
          }
          footerMuted={
            <span className='inline-flex flex-wrap items-center gap-x-1.5 gap-y-1'>
              <span className='inline-flex items-center gap-1'>
                Supplier (
                <span
                  className='inline-block size-2 shrink-0 rounded-full ring-1 ring-border'
                  style={{ backgroundColor: DOT.supplierPurple }}
                  aria-hidden
                />
                ) {s.mapSupplierPinsCount.toLocaleString()}
              </span>
              <span aria-hidden>+</span>
              <span className='inline-flex items-center gap-1'>
                Seller (
                <span
                  className='inline-block size-2 shrink-0 rounded-full ring-1 ring-border'
                  style={{ backgroundColor: DOT.sellerGrey }}
                  aria-hidden
                />
                ) {s.locationsSellerGeocoded.toLocaleString()}
              </span>
              <span aria-hidden>=</span>
              <span className='font-medium text-foreground'>
                {s.locationsGeocoded.toLocaleString()} locations
              </span>
            </span>
          }
        />
      );
    case 'locations-not-geocoded':
      return (
        <OverviewKpiCard
          description='Locations not geocoded'
          value={s.locationsNotGeocoded}
          badgeText='needs coordinates'
          footerMuted='Non-hidden companies · has address · missing lat/lng'
        />
      );
    case 'locations-sellers':
      return (
        <OverviewKpiCard
          description={
            <>
              <TitleDot color={DOT.sellerGrey} />
              Locations (sellers)
            </>
          }
          value={s.locationsSeller}
          badgeText={
            s.countCompaniesSeller > 0
              ? `${(s.locationsSeller / s.countCompaniesSeller).toFixed(1)} per company`
              : '—'
          }
          footerMuted='All location rows for seller (vendor research) companies'
        />
      );
    case 'container-pins':
      return (
        <OverviewKpiCard
          description='Container pins'
          value={s.containerPinsCount}
          badgeText='on map'
          footerTop={
            <>
              LastLeg canonical route (MapPin sync){' '}
              <IconTrendingUp className='inline size-4 align-text-bottom' />
            </>
          }
          footerMuted='Stops by visit outcome (matches map pin colors)'
          statusRows={s.breakdownContainerRoute}
        />
      );
    default:
      return null;
  }
}

function SortableStudShell({
  id,
  fullWidth,
  studStyle,
  children
}: {
  id: OverviewBlockId;
  fullWidth: boolean;
  studStyle: CSSProperties;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...studStyle }}
      className={cn(
        'relative rounded-2xl p-1.5',
        fullWidth && 'col-span-full',
        '[&_[data-slot=card-header]]:pr-14'
      )}
    >
      <button
        type='button'
        className='bg-background/90 text-muted-foreground hover:text-foreground absolute top-3 right-3 z-10 flex size-8 cursor-grab items-center justify-center rounded-md border border-border/70 shadow-sm backdrop-blur-sm active:cursor-grabbing'
        {...attributes}
        {...listeners}
      >
        <span className='sr-only'>Drag to reorder</span>
        <IconGripVertical className='size-4' aria-hidden />
      </button>
      {children}
    </div>
  );
}

type Props = {
  stats: OverviewKpiStats;
  initialBlockOrder?: string[] | undefined;
  persistToServer: boolean;
  geocode: ReactNode;
  chart: ReactNode | null;
};

export function OverviewDashboardBlocks({
  stats,
  initialBlockOrder,
  persistToServer,
  geocode,
  chart
}: Props) {
  const hasChart = chart != null;
  const { activeTheme } = useThemeConfig();
  const studGlow = useMemo(() => studFrameStyle(activeTheme), [activeTheme]);

  const [order, setOrder] = useState<OverviewBlockId[]>(() =>
    normalizeBlockOrder(initialBlockOrder, hasChart)
  );

  useEffect(() => {
    if (Array.isArray(initialBlockOrder) && initialBlockOrder.length > 0) {
      setOrder(normalizeBlockOrder(initialBlockOrder, hasChart));
      return;
    }
    const loc = readLocalBlockOrder(hasChart);
    if (loc) setOrder(loc);
  }, [initialBlockOrder, hasChart]);

  useEffect(() => {
    setOrder((prev) => normalizeBlockOrder(prev, hasChart));
  }, [hasChart]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const persist = useCallback(
    async (next: OverviewBlockId[]) => {
      if (persistToServer) {
        try {
          const res = await fetch('/api/user/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout: { overviewBlockOrder: next } })
          });
          if (!res.ok) throw new Error('save failed');
          return;
        } catch {
          /* local fallback */
        }
      }
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [persistToServer]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setOrder((items) => {
        const oldIndex = items.indexOf(active.id as OverviewBlockId);
        const newIndex = items.indexOf(over.id as OverviewBlockId);
        if (oldIndex < 0 || newIndex < 0) return items;
        const next = arrayMove(items, oldIndex, newIndex);
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  const renderBlock = useCallback(
    (id: OverviewBlockId) => {
      if (id === 'geocode') return geocode;
      if (id === 'chart') return chart;
      return renderKpiCard(id as OverviewKpiId, stats);
    },
    [geocode, chart, stats]
  );

  const isFullWidth = (id: OverviewBlockId) => id === 'geocode' || id === 'chart';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className={BLOCK_GRID_CLASS}>
          {order.map((id) => {
            const node = renderBlock(id);
            if (node == null) return null;
            return (
              <SortableStudShell
                key={id}
                id={id}
                fullWidth={isFullWidth(id)}
                studStyle={studGlow}
              >
                {node}
              </SortableStudShell>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
