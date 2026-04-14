'use client';

import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import type { CategorySeries } from './company-area-graph';

const CompanyAreaGraph = dynamic(
  () =>
    import('./company-area-graph').then((m) => ({
      default: m.CompanyAreaGraph
    })),
  {
    ssr: false,
    loading: () => (
      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>Account Growth - Last 6 Months</CardTitle>
          <CardDescription>Leads added by company status</CardDescription>
        </CardHeader>
        <CardContent className='flex h-[250px] items-center justify-center'>
          <p className='text-muted-foreground text-sm'>Loading chart…</p>
        </CardContent>
      </Card>
    )
  }
);

type Props = {
  data: Record<string, string | number>[];
  categories: CategorySeries[];
};

export function CompanyAreaGraphLazy({ data, categories }: Props) {
  return <CompanyAreaGraph data={data} categories={categories} />;
}
