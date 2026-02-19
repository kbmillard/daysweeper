'use client';

import * as React from 'react';
import { IconTrendingUp } from '@tabler/icons-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

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

// Distinct colors for up to 5 categories (matches pie chart intent)
const CATEGORY_COLORS = [
  'hsl(var(--primary))',
  'hsl(220 70% 50%)',
  'hsl(160 60% 45%)',
  'hsl(30 80% 55%)',
  'hsl(280 65% 60%)'
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
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
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
          <CardTitle>Lead Growth - Last 6 Months</CardTitle>
          <CardDescription>
            Leads added by category (same categories as pie chart)
          </CardDescription>
        </CardHeader>
        <CardContent className='flex items-center justify-center h-[250px]'>
          <p className='text-muted-foreground'>No category data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Lead Growth - Last 6 Months</CardTitle>
        <CardDescription>
          Leads added by category (same categories as pie chart)
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[250px] w-full'
        >
          <AreaChart
            data={data}
            margin={{ left: 12, right: 12 }}
          >
            <defs>
              {categories.map(({ key }, i) => (
                <linearGradient
                  key={key}
                  id={`fillArea-${key}`}
                  x1='0'
                  y1='0'
                  x2='0'
                  y2='1'
                >
                  <stop
                    offset='5%'
                    stopColor={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                    stopOpacity={0.9}
                  />
                  <stop
                    offset='95%'
                    stopColor={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              ))}
            </defs>
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
              <Area
                key={key}
                dataKey={key}
                type='natural'
                fill={`url(#fillArea-${key})`}
                stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                stackId='a'
              />
            ))}
          </AreaChart>
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
              Last 6 months by category (matches pie chart)
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
