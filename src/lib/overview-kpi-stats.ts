import type { StopOutcome } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getRedPinsCount } from '@/lib/red-pins-count';

/** Same filter as `/api/locations/map` — geocoded supplier locations (purple pins). */
export const mapSupplierPinsWhere = {
  latitude: { not: null },
  longitude: { not: null },
  Company: { hidden: false, isSeller: false }
} as const;

const LASTLEG_SHARED_ROUTE = {
  assignedToUserId: 'shared',
  name: 'LastLeg Canonical Pins'
} as const;

export type StatusCountRow = { label: string; count: number };

/** Container pins row: label + count + dot color (hex) for dashboard KPI. */
export type ContainerRouteStatusRow = StatusCountRow & { dotColor: string };

function companyStatusBreakdown(
  rows: { status: string | null; _count: { _all: number } }[]
): StatusCountRow[] {
  return rows
    .map((r) => ({
      label: r.status?.trim() ? r.status.trim() : 'No status',
      count: r._count._all
    }))
    .sort((a, b) => b.count - a.count);
}

const OUTCOME_META: Record<
  string,
  { label: string; dotColor: string; sort: number }
> = {
  __NULL__: {
    label: 'New',
    dotColor: '#2563eb',
    sort: 0
  },
  NOT_INTERESTED: {
    label: 'Visited - Not Interested (pin deactivated)',
    dotColor: '#171717',
    sort: 1
  },
  REVISITING_INTERESTED: {
    label: 'Revisiting — interested',
    dotColor: '#eab308',
    sort: 2
  },
  DEAL_MADE: {
    label: 'Visited - Deal made',
    dotColor: '#22c55e',
    sort: 3
  },
  CONTAINERS_CLEARED: {
    label: 'Material removed (pin deactivated)',
    dotColor: '#fafafa',
    sort: 4
  },
  VISITED: {
    label: 'Visited',
    dotColor: '#0d9488',
    sort: 5
  },
  NO_ANSWER: {
    label: 'No answer',
    dotColor: '#64748b',
    sort: 6
  },
  WRONG_ADDRESS: {
    label: 'Wrong address',
    dotColor: '#64748b',
    sort: 7
  },
  FOLLOW_UP: {
    label: 'Follow up',
    dotColor: '#64748b',
    sort: 8
  }
};

function outcomeKey(o: StopOutcome | null): string {
  return o === null ? '__NULL__' : o;
}

function containerRouteBreakdown(
  rows: { outcome: StopOutcome | null; _count: { _all: number } }[]
): ContainerRouteStatusRow[] {
  return rows
    .map((r) => {
      const k = outcomeKey(r.outcome);
      const meta = OUTCOME_META[k] ?? {
        label: k === '__NULL__' ? 'New' : String(r.outcome).replaceAll('_', ' '),
        dotColor: '#64748b',
        sort: 50
      };
      return {
        label: meta.label,
        count: r._count._all,
        dotColor: meta.dotColor,
        _sort: meta.sort
      };
    })
    .sort((a, b) => a._sort - b._sort || b.count - a.count)
    .map(({ _sort: _, ...row }) => row);
}

export async function getOverviewKpiStats() {
  const hasLocation = { Location: { some: {} }, hidden: false };
  const companiesNonSeller = { hidden: false, isSeller: false, Location: { some: {} } } as const;
  const companiesSeller = { hidden: false, isSeller: true, Location: { some: {} } } as const;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    totalCompanies,
    companiesThisMonth,
    countCompaniesNonSeller,
    countCompaniesSeller,
    groupNonSeller,
    groupSeller,
    locationsNonSeller,
    locationsSeller,
    locationsGeocoded,
    locationsNotGeocoded,
    mapSupplierPinsCount,
    locationsSellerGeocoded,
    totalLocations,
    containerPinsCount,
    sharedRoute
  ] = await Promise.all([
    prisma.company.count({ where: hasLocation }),
    prisma.company.count({
      where: { ...hasLocation, createdAt: { gte: monthStart } }
    }),
    prisma.company.count({ where: companiesNonSeller }),
    prisma.company.count({ where: companiesSeller }),
    prisma.company.groupBy({
      by: ['status'],
      where: companiesNonSeller,
      _count: { _all: true }
    }),
    prisma.company.groupBy({
      by: ['status'],
      where: companiesSeller,
      _count: { _all: true }
    }),
    prisma.location.count({
      where: { Company: { hidden: false, isSeller: false } }
    }),
    prisma.location.count({
      where: { Company: { hidden: false, isSeller: true } }
    }),
    prisma.location.count({
      where: {
        Company: { hidden: false },
        latitude: { not: null },
        longitude: { not: null }
      }
    }),
    prisma.location.count({
      where: {
        Company: { hidden: false },
        addressRaw: { not: '' },
        OR: [{ latitude: null }, { longitude: null }]
      }
    }),
    prisma.location.count({ where: mapSupplierPinsWhere }),
    prisma.location.count({
      where: {
        Company: { hidden: false, isSeller: true },
        latitude: { not: null },
        longitude: { not: null }
      }
    }),
    prisma.location.count({ where: { Company: { hidden: false } } }),
    getRedPinsCount(),
    prisma.route.findFirst({
      where: LASTLEG_SHARED_ROUTE,
      select: { id: true },
      orderBy: { updatedAt: 'desc' }
    })
  ]);

  let breakdownContainerRoute: ContainerRouteStatusRow[] = [];
  if (sharedRoute) {
    const grouped = await prisma.routeStop
      .groupBy({
        by: ['outcome'],
        where: { routeId: sharedRoute.id },
        _count: { _all: true }
      })
      .catch((): { outcome: StopOutcome | null; _count: { _all: number } }[] => []);
    breakdownContainerRoute = containerRouteBreakdown(grouped);
  }

  return {
    totalCompanies,
    companiesThisMonth,
    totalLocations,
    mapSupplierPinsCount,
    locationsSellerGeocoded,
    countCompaniesNonSeller,
    countCompaniesSeller,
    breakdownCompaniesNonSeller: companyStatusBreakdown(groupNonSeller),
    breakdownCompaniesSeller: companyStatusBreakdown(groupSeller),
    locationsNonSeller,
    locationsSeller,
    locationsGeocoded,
    locationsNotGeocoded,
    containerPinsCount,
    breakdownContainerRoute
  };
}

export type OverviewKpiStats = Awaited<ReturnType<typeof getOverviewKpiStats>>;
