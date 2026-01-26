'use client';

import { AreaGraph } from '@/features/overview/components/area-graph';
import { useOverview } from '@/lib/overview';

export default function AreaStats() {
  const { data, isLoading } = useOverview('30d');

  if (isLoading) {
    return <div className="h-[250px] animate-pulse bg-muted rounded-lg" />;
  }

  return <AreaGraph data={data?.charts?.byDay || []} />;
}
