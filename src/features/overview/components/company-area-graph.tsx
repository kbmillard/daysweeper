'use client';

import * as React from 'react';
import { IconTrendingUp } from '@tabler/icons-react';
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

// 4 colors for 4 company statuses
const STATUS_COLORS = [
  'hsl(var(--primary))',
  'hsl(220 70% 50%)',
  'hsl(160 60% 45%)',
  'hsl(30 80% 55%)'
];

export type CategorySeries = { key: string; label: string };

type CompanyAreaGraphProps = {
  data: Record<string, string | number>[];
  categories: CategorySeries[];
};

export function CompanyAreaGraph({ data, categories }: CompanyAreaGraphProps) {
  const chartConfig = React.useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    categories.forEach(({ key, label }, i) => {
      config[key] = {
        label,
        color: STATUS_COLORS[i % STATUS_COLORS.length]
      };
    });
    return config;
  }, [categories]);

  const totalThisMonth = React.useMemo(() => {
    const last = data[data.length - 1];
    if (!last) return 0;
    return categories.reduce((sum, { key }) => sum + (Number(last[key]) || 0), 0);
  }, [data, categories]);

  const totalLastMonth = React.useMemo(() => {
    const prev = data[data.length - 2];
    if (!prev) return 0;
    return categories.reduce((sum, { key }) => sum + (Number(prev[key]) || 0), 0);
  }, [data, categories]);

  const growthRate =
    totalLastMonth > 0
      ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100
      : 0;

  if (categories.length === 0) {
    return (
      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>Lead Status - Last 6 Months</CardTitle>
          <CardDescription>
            Leads added by company status
          </CardDescription>
        </CardHeader>
        <CardContent className='flex items-center justify-center h-[250px]'>
          <p className='text-muted-foreground'>No status data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Lead Status - Last 6 Months</CardTitle>
        <CardDescription>
          Leads added by company status (each line = one status)
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[250px] w-full'
        >
          <LineChart
            data={data}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='month'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator='dot' />}
            />
            {categories.map(({ key }, i) => (
              <Line
                key={key}
                type='monotone'
                dataKey={key}
                stroke={STATUS_COLORS[i % STATUS_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className='flex w-full items-start gap-2 text-sm'>
          <div className='grid gap-2'>
            <div className='flex items-center gap-2 leading-none font-medium'>
              {growthRate >= 0 ? 'Growing' : 'Declining'} by{' '}
              {Math.abs(growthRate).toFixed(1)}% this month{' '}
              <IconTrendingUp className='h-4 w-4' />
            </div>
            <div className='text-muted-foreground flex items-center gap-2 leading-none'>
              Last 6 months by company status
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
