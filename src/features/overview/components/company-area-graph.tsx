'use client';

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

type ChartData = {
  month: string;
  withCategory: number;
  withSegment: number;
};

const chartConfig = {
  companies: {
    label: 'Companies'
  },
  withCategory: {
    label: 'With Category',
    color: 'var(--primary)'
  },
  withSegment: {
    label: 'With Segment',
    color: 'var(--primary)'
  }
} satisfies ChartConfig;

export function CompanyAreaGraph({ data }: { data: ChartData[] }) {
  const totalThisMonth = data[data.length - 1]?.withCategory + data[data.length - 1]?.withSegment || 0;
  const totalLastMonth = data[data.length - 2]?.withCategory + data[data.length - 2]?.withSegment || 0;
  const growthRate = totalLastMonth > 0
    ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100
    : 0;

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Company Growth - Last 6 Months</CardTitle>
        <CardDescription>
          Companies added with category and segment data
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[250px] w-full'
        >
          <AreaChart
            data={data}
            margin={{
              left: 12,
              right: 12
            }}
          >
            <defs>
              <linearGradient id='fillCategory' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='5%'
                  stopColor='var(--color-withCategory)'
                  stopOpacity={1.0}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-withCategory)'
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id='fillSegment' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='5%'
                  stopColor='var(--color-withSegment)'
                  stopOpacity={0.8}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-withSegment)'
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='month'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator='dot' />}
            />
            <Area
              dataKey='withSegment'
              type='natural'
              fill='url(#fillSegment)'
              stroke='var(--color-withSegment)'
              stackId='a'
            />
            <Area
              dataKey='withCategory'
              type='natural'
              fill='url(#fillCategory)'
              stroke='var(--color-withCategory)'
              stackId='a'
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className='flex w-full items-start gap-2 text-sm'>
          <div className='grid gap-2'>
            <div className='flex items-center gap-2 leading-none font-medium'>
              {growthRate >= 0 ? 'Growing' : 'Declining'} by {Math.abs(growthRate).toFixed(1)}% this month{' '}
              <IconTrendingUp className='h-4 w-4' />
            </div>
            <div className='text-muted-foreground flex items-center gap-2 leading-none'>
              Last 6 months of company additions
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
