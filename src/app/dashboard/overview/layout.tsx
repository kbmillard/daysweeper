import { auth } from '@clerk/nextjs/server';
import PageContainer from '@/components/layout/page-container';
import { OverviewDashboardBlocks } from '@/features/overview/components/overview-dashboard-blocks';
import { PendingGeocodeOverviewSection } from '@/features/overview/components/pending-geocode-overview-section';
import { getOverviewKpiStats } from '@/lib/overview-kpi-stats';
import { prisma } from '@/lib/prisma';
import React from 'react';

function resolveOverviewBlockOrder(
  layout: Record<string, unknown> | undefined,
  hasChart: boolean
): string[] | undefined {
  if (!layout) return undefined;
  const block = layout.overviewBlockOrder;
  if (Array.isArray(block) && block.length > 0) {
    return block as string[];
  }
  const kpi = layout.overviewKpiOrder;
  if (Array.isArray(kpi) && kpi.length > 0) {
    return [
      ...(kpi as string[]),
      'geocode',
      ...(hasChart ? (['chart'] as const) : [])
    ];
  }
  return undefined;
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
  const [s, { userId }] = await Promise.all([getOverviewKpiStats(), auth()]);

  const hasChart = area_stats != null;
  let initialBlockOrder: string[] | undefined;
  if (userId) {
    const pref = await prisma.userPreference.findUnique({
      where: { userId },
      select: { layout: true }
    });
    const layout = pref?.layout as Record<string, unknown> | undefined;
    initialBlockOrder = resolveOverviewBlockOrder(layout, hasChart);
  }

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-center justify-between space-y-2'>
          <h2 className='text-2xl font-bold tracking-tight'>
            Hi, Welcome back 👋
          </h2>
        </div>

        <OverviewDashboardBlocks
          stats={s}
          initialBlockOrder={initialBlockOrder}
          persistToServer={Boolean(userId)}
          geocode={<PendingGeocodeOverviewSection />}
          chart={hasChart ? area_stats : null}
        />
      </div>
    </PageContainer>
  );
}
