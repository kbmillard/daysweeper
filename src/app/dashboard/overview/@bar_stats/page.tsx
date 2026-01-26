'use client';

import { BarGraph } from '@/features/overview/components/bar-graph';
import { useOverview } from '@/lib/overview';

export default function BarStats() {
  const { data, isLoading } = useOverview('30d');

  if (isLoading) {
    return <div className="h-[250px] animate-pulse bg-muted rounded-lg" />;
  }

  return <BarGraph data={data?.charts?.byDay || []} />;
}
