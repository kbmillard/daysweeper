import type { AccountState } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getRedPinsCount } from '@/lib/red-pins-count';

/** Same filter as `/api/locations/map` — geocoded supplier locations (purple pins). */
export const mapSupplierPinsWhere = {
  latitude: { not: null },
  longitude: { not: null },
  Company: { hidden: false, isBuyer: false }
} as const;

export type StatusCountRow = { label: string; count: number };

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

function targetAccountStateBreakdown(
  rows: { accountState: AccountState | null; _count: { _all: number } }[]
): StatusCountRow[] {
  const label = (s: AccountState | null) =>
    s != null ? String(s).replaceAll('_', ' ') : 'No state';
  return rows
    .map((r) => ({ label: label(r.accountState), count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function getOverviewKpiStats() {
  const hasLocation = { Location: { some: {} }, hidden: false };
  const companiesNonSeller = { hidden: false, isBuyer: false, Location: { some: {} } } as const;
  const companiesSeller = { hidden: false, isBuyer: true, Location: { some: {} } } as const;

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
    totalLocations,
    containerPinsCount,
    groupTargetState
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
      where: { Company: { hidden: false, isBuyer: false } }
    }),
    prisma.location.count({
      where: { Company: { hidden: false, isBuyer: true } }
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
    prisma.location.count({ where: { Company: { hidden: false } } }),
    getRedPinsCount(),
    prisma.target
      .groupBy({
        by: ['accountState'],
        where: {
          latitude: { not: null },
          longitude: { not: null }
        },
        _count: { _all: true }
      })
      .catch((): { accountState: AccountState | null; _count: { _all: number } }[] => [])
  ]);

  return {
    totalCompanies,
    companiesThisMonth,
    totalLocations,
    mapSupplierPinsCount,
    countCompaniesNonSeller,
    countCompaniesSeller,
    breakdownCompaniesNonSeller: companyStatusBreakdown(groupNonSeller),
    breakdownCompaniesSeller: companyStatusBreakdown(groupSeller),
    locationsNonSeller,
    locationsSeller,
    locationsGeocoded,
    locationsNotGeocoded,
    containerPinsCount,
    breakdownContainerTargets: targetAccountStateBreakdown(groupTargetState)
  };
}
