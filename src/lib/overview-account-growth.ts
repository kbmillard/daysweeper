import type { Prisma } from '@prisma/client';
import { COMPANY_STATUSES, normalizeStatus } from '@/constants/company-status';
import { effectiveLocationCrmStatus } from '@/lib/location-crm-status';
import {
  CRM_STATUS_CHANGED_AT_METADATA_KEY,
  parseLocationMetadata
} from '@/lib/location-primary-sync-metadata';
import { prisma } from '@/lib/prisma';

export function safeKey(status: string) {
  return status.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

function initMonthRows(anchor: Date) {
  const monthMap = new Map<string, Record<string, string | number>>();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(anchor);
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const row: Record<string, string | number> = { month: monthName };
    COMPANY_STATUSES.forEach((status) => {
      row[safeKey(status)] = 0;
    });
    monthMap.set(monthKey, row);
  }
  return monthMap;
}

function monthKeyFromDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type AccountGrowthCategory = { key: string; label: string };

/**
 * Monthly counts for the Account Growth area chart: new companies (by creation month + status)
 * plus pipeline status saves on locations and HQ (via `crmStatusChangedAt` on Location or Company metadata).
 */
export async function buildAccountGrowthAreaData(options: {
  newCompanyWhere: Prisma.CompanyWhereInput;
  locationCompanyWhere?: Prisma.CompanyWhereInput;
}) {
  const anchor = new Date();
  const sixMonthsAgo = new Date(anchor);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthMap = initMonthRows(anchor);

  const companies = await prisma.company.findMany({
    where: {
      ...options.newCompanyWhere,
      createdAt: { gte: sixMonthsAgo },
      status: { not: null }
    },
    select: { createdAt: true, status: true }
  });

  companies.forEach((company) => {
    if (!company.status) return;
    const normalized = normalizeStatus(company.status);
    if (!normalized) return;
    const date = new Date(company.createdAt);
    const monthKey = monthKeyFromDate(date);
    const row = monthMap.get(monthKey);
    if (!row) return;
    const key = safeKey(normalized);
    if (key in row) row[key] = (row[key] as number) + 1;
  });

  const locationWhere: Prisma.LocationWhereInput = {
    updatedAt: { gte: sixMonthsAgo }
  };
  if (
    options.locationCompanyWhere &&
    Object.keys(options.locationCompanyWhere as object).length > 0
  ) {
    locationWhere.Company = { is: options.locationCompanyWhere };
  }

  const locations = await prisma.location.findMany({
    where: locationWhere,
    select: {
      id: true,
      metadata: true,
      Company: { select: { status: true, primaryLocationId: true, metadata: true } }
    }
  });

  for (const loc of locations) {
    const locMeta = parseLocationMetadata(loc.metadata);
    const rawLoc = locMeta[CRM_STATUS_CHANGED_AT_METADATA_KEY];
    const fromLocation =
      typeof rawLoc === 'string' && rawLoc.trim() ? new Date(rawLoc.trim()) : null;

    const companyMeta = parseLocationMetadata(loc.Company.metadata);
    const rawCo = companyMeta[CRM_STATUS_CHANGED_AT_METADATA_KEY];
    const fromCompany =
      typeof rawCo === 'string' && rawCo.trim() ? new Date(rawCo.trim()) : null;

    const isPrimary = Boolean(
      loc.Company.primaryLocationId && loc.id === loc.Company.primaryLocationId
    );

    let eventDate: Date | null = null;
    let statusLabel: string | null = null;

    if (isPrimary) {
      const locStamp =
        fromLocation && !Number.isNaN(fromLocation.getTime()) && fromLocation >= sixMonthsAgo
          ? fromLocation
          : null;
      const compStamp =
        fromCompany && !Number.isNaN(fromCompany.getTime()) && fromCompany >= sixMonthsAgo
          ? fromCompany
          : null;
      eventDate = locStamp ?? compStamp;
      if (eventDate) {
        statusLabel = normalizeStatus(loc.Company.status ?? null);
      }
    } else if (
      fromLocation &&
      !Number.isNaN(fromLocation.getTime()) &&
      fromLocation >= sixMonthsAgo
    ) {
      eventDate = fromLocation;
      statusLabel = normalizeStatus(
        effectiveLocationCrmStatus({
          locationId: loc.id,
          companyStatus: loc.Company.status,
          companyPrimaryLocationId: loc.Company.primaryLocationId,
          locationMetadata: loc.metadata
        })
      );
    }

    if (!eventDate || !statusLabel) continue;
    const monthKey = monthKeyFromDate(eventDate);
    const row = monthMap.get(monthKey);
    if (!row) continue;
    const key = safeKey(statusLabel);
    if (key in row) row[key] = (row[key] as number) + 1;
  }

  const chartData = Array.from(monthMap.values());
  const categories: AccountGrowthCategory[] = COMPANY_STATUSES.map((label) => ({
    key: safeKey(label),
    label
  }));

  return { chartData, categories };
}
