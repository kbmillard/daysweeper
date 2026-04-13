import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter
} from '@/components/ui/card';
import { PendingGeocodeOverviewSection } from '@/features/overview/components/pending-geocode-overview-section';
import { getRedPinsCount } from '@/lib/red-pins-count';
import { IconTrendingUp } from '@tabler/icons-react';
import React from 'react';
import { prisma } from '@/lib/prisma';

const hasLocation = { Location: { some: {} }, hidden: false };

async function getCompanyStats() {
  const [totalCompanies, totalLocations, companiesThisMonth, redPinsCount] = await Promise.all([
    prisma.company.count({ where: hasLocation }),
    prisma.location.count({ where: { Company: { hidden: false } } }),
    prisma.company.count({
      where: {
        ...hasLocation,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    }),
    getRedPinsCount()
  ]);

  return {
    totalCompanies,
    totalLocations,
    companiesThisMonth,
    redPinsCount
  };
}

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
  const stats = await getCompanyStats();

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-center justify-between space-y-2'>
          <h2 className='text-2xl font-bold tracking-tight'>
            Hi, Welcome back 👋
          </h2>
        </div>

        {/* KPI Widgets - Total Leads, Total Locations, Red Pins */}
        <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-3'>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {stats.totalCompanies.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <IconTrendingUp />
                  {stats.companiesThisMonth} leads this month
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {stats.companiesThisMonth} leads added this month{' '}
                <IconTrendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>
                Leads in your database
              </div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Total Locations</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {stats.totalLocations.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <IconTrendingUp />
                  {stats.totalCompanies > 0
                    ? (stats.totalLocations / stats.totalCompanies).toFixed(1)
                    : 0}{' '}
                  avg
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {stats.totalCompanies > 0
                  ? (stats.totalLocations / stats.totalCompanies).toFixed(1)
                  : 0}{' '}
                locations per lead <IconTrendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>
                All lead locations tracked
              </div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Red Pins</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {stats.redPinsCount.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <IconTrendingUp />
                  on map
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                KML + user pins <IconTrendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>
                Map overlay pins
              </div>
            </CardFooter>
          </Card>
        </div>

        <PendingGeocodeOverviewSection />

        {/* Account Growth line graph */}
        {area_stats != null && (
          <div className='grid grid-cols-1 gap-4'>
            {area_stats}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
