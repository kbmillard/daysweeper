'use client';

import { PieGraph } from '@/features/overview/components/pie-graph';
import { useOverview } from '@/lib/overview';

export default function Stats() {
  const { data, isLoading } = useOverview('30d');

  if (isLoading) {
    return <div className="h-[250px] animate-pulse bg-muted rounded-lg" />;
  }

  return <PieGraph data={data?.charts?.stateDistribution || []} />;
}
