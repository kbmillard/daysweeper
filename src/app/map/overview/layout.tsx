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
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import React from 'react';
import { prisma } from '@/lib/prisma';
import DashboardMapClient from './dashboard-map-client';

async function getCompanyStats() {
  const [
    totalCompanies,
    totalLocations,
    companiesThisMonth,
    companiesLastMonth,
    companiesWithParent,
    companiesWithChildren
  ] = await Promise.all([
    prisma.company.count(),
    prisma.location.count(),
    prisma.company.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    }),
    prisma.company.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
          lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    }),
    prisma.company.count({
      where: {
        parentCompanyDbId: {
          not: null
        }
      }
    }),
    prisma.company.count({
      where: {
        other_Company: {
          some: {}
        }
      }
    })
  ]);

  const monthOverMonthChange =
    companiesLastMonth > 0
      ? ((companiesThisMonth - companiesLastMonth) / companiesLastMonth) * 100
      : 0;

  return {
    totalCompanies,
    totalLocations,
    companiesThisMonth,
    companiesLastMonth,
    monthOverMonthChange,
    companiesWithParent,
    companiesWithChildren
  };
}

export default async function OverViewLayout({
  sales,
  pie_stats,
  bar_stats,
  area_stats,
  children
}: {
  sales: React.ReactNode;
  pie_stats: React.ReactNode;
  bar_stats: React.ReactNode;
  area_stats: React.ReactNode;
  children: React.ReactNode;
}) {
  const stats = await getCompanyStats();

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <div className='flex items-center justify-between space-y-2'>
          <h2 className='text-2xl font-bold tracking-tight'>
            Hi, Welcome back 👋
          </h2>
        </div>

        {/* Map Section */}
        <div className='w-full'>{children}</div>

        <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4'>
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
              <CardDescription>Leads with Parent</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {stats.companiesWithParent.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <IconTrendingUp />
                  {stats.totalCompanies > 0
                    ? (
                        (stats.companiesWithParent / stats.totalCompanies) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {stats.totalCompanies > 0
                  ? (
                      (stats.companiesWithParent / stats.totalCompanies) *
                      100
                    ).toFixed(1)
                  : 0}
                % have parent leads <IconTrendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>
                Hierarchical lead structure
              </div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Month-over-Month Growth</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {stats.monthOverMonthChange >= 0 ? '+' : ''}
                {stats.monthOverMonthChange.toFixed(1)}%
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  {stats.monthOverMonthChange >= 0 ? (
                    <IconTrendingUp />
                  ) : (
                    <IconTrendingDown />
                  )}
                  {stats.monthOverMonthChange >= 0 ? '+' : ''}
                  {stats.monthOverMonthChange.toFixed(1)}%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {stats.monthOverMonthChange >= 0 ? 'Growing' : 'Declining'} this
                period{' '}
                {stats.monthOverMonthChange >= 0 ? (
                  <IconTrendingUp className='size-4' />
                ) : (
                  <IconTrendingDown className='size-4' />
                )}
              </div>
              <div className='text-muted-foreground'>
                Compared to last month
              </div>
            </CardFooter>
          </Card>
        </div>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
          <div className='col-span-full'>{area_stats}</div>
          <div className='col-span-4'>{bar_stats}</div>
          <div className='col-span-4 md:col-span-3'>
            {/* sales arallel routes */}
            {sales}
          </div>
          <div className='col-span-4 md:col-span-3'>{pie_stats}</div>
        </div>
      </div>
    </PageContainer>
  );
}
