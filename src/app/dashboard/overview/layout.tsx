import PageContainer from '@/components/layout/page-container';
import { OverviewKpiCard } from '@/features/overview/components/overview-kpi-card';
import { PendingGeocodeOverviewSection } from '@/features/overview/components/pending-geocode-overview-section';
import { getOverviewKpiStats } from '@/lib/overview-kpi-stats';
import { IconTrendingUp } from '@tabler/icons-react';
import React from 'react';

const kpiGridClass =
  '*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4';

export default async function OverViewLayout({
  area_stats,
  children
}: {
  sales?: React.ReactNode;
  pie_stats?: React.ReactNode;
  bar_stats?: React.ReactNode;
  area_stats?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const s = await getOverviewKpiStats();

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-center justify-between space-y-2'>
          <h2 className='text-2xl font-bold tracking-tight'>
            Hi, Welcome back 👋
          </h2>
        </div>

        <div className={kpiGridClass}>
          <OverviewKpiCard
            description='Total Leads'
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
                Leads in your database · {s.totalLocations.toLocaleString()} location rows total
              </>
            }
          />

          <OverviewKpiCard
            description='Companies (suppliers)'
            value={s.countCompaniesNonSeller}
            badgeText='by CRM status'
            footerMuted='Non-seller companies with at least one location'
            statusRows={s.breakdownCompaniesNonSeller}
          />

          <OverviewKpiCard
            description='Companies (sellers)'
            value={s.countCompaniesSeller}
            badgeText='by CRM status'
            footerMuted='Seller / vendor-research companies (grey map layer when geocoded)'
            statusRows={s.breakdownCompaniesSeller}
          />

          <OverviewKpiCard
            description='Locations (suppliers)'
            value={s.locationsNonSeller}
            badgeText={
              s.countCompaniesNonSeller > 0
                ? `${(s.locationsNonSeller / s.countCompaniesNonSeller).toFixed(1)} per company`
                : '—'
            }
            footerMuted='All location rows for supplier companies'
          />

          <OverviewKpiCard
            description='Locations (sellers)'
            value={s.locationsSeller}
            badgeText={
              s.countCompaniesSeller > 0
                ? `${(s.locationsSeller / s.countCompaniesSeller).toFixed(1)} per company`
                : '—'
            }
            footerMuted='All location rows for seller (vendor research) companies'
          />

          <OverviewKpiCard
            description='Container pins'
            value={s.containerPinsCount}
            badgeText='on map'
            footerTop={
              <>
                MapPin sync (KML + drops){' '}
                <IconTrendingUp className='inline size-4 align-text-bottom' />
              </>
            }
            footerMuted='Geocoded targets by account state (route overlay)'
            statusRows={s.breakdownContainerTargets}
          />

          <OverviewKpiCard
            description='Locations geocoded'
            value={s.locationsGeocoded}
            badgeText={
              s.totalLocations > 0
                ? `${((100 * s.locationsGeocoded) / s.totalLocations).toFixed(0)}% geocoded`
                : '—'
            }
            footerMuted={
              <>
                Lat/lng set ·{' '}
                <span className='inline-flex items-center gap-1'>
                  <span
                    className='inline-block size-2 shrink-0 rounded-full bg-[#9333ea] ring-1 ring-border'
                    aria-hidden
                  />
                  {s.mapSupplierPinsCount.toLocaleString()} purple supplier pins on map
                </span>
              </>
            }
          />

          <OverviewKpiCard
            description='Locations not geocoded'
            value={s.locationsNotGeocoded}
            badgeText='needs coordinates'
            footerMuted='Non-hidden companies · has address · missing lat/lng'
          />
        </div>

        <PendingGeocodeOverviewSection />

        {area_stats != null && (
          <div className='grid grid-cols-1 gap-4'>
            {area_stats}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
