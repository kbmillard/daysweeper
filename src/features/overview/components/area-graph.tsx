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

const chartConfig = {
  visitors: {
    label: 'Visits'
  },
  visited: {
    label: 'Visited',
    color: 'var(--primary)'
  },
  noAnswer: {
    label: 'No Answer',
    color: 'hsl(var(--muted-foreground))'
  },
  wrongAddress: {
    label: 'Wrong Address',
    color: 'hsl(var(--destructive))'
  },
  followUp: {
    label: 'Follow Up',
    color: 'hsl(var(--warning))'
  }
} satisfies ChartConfig;

interface AreaGraphProps {
  data?: Array<{
    day: string | Date;
    visited: number;
    noAnswer: number;
    wrongAddress: number;
    followUp: number;
  }>;
}

export function AreaGraph({ data = [] }: AreaGraphProps) {
  const chartData = data.map((item) => ({
    day: typeof item.day === 'string' ? item.day : item.day.toISOString().split('T')[0],
    visited: item.visited || 0,
    noAnswer: item.noAnswer || 0,
    wrongAddress: item.wrongAddress || 0,
    followUp: item.followUp || 0
  }));
  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Visit Outcomes by Day</CardTitle>
        <CardDescription>
          Showing visit outcomes over time
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[250px] w-full'
        >
          <AreaChart
            data={chartData}
            margin={{
              left: 12,
              right: 12
            }}
          >
            <defs>
              <linearGradient id='fillVisited' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='var(--color-visited)' stopOpacity={1.0} />
                <stop offset='95%' stopColor='var(--color-visited)' stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id='fillNoAnswer' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='var(--color-noAnswer)' stopOpacity={0.8} />
                <stop offset='95%' stopColor='var(--color-noAnswer)' stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id='fillWrongAddress' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='var(--color-wrongAddress)' stopOpacity={0.8} />
                <stop offset='95%' stopColor='var(--color-wrongAddress)' stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id='fillFollowUp' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='var(--color-followUp)' stopOpacity={0.8} />
                <stop offset='95%' stopColor='var(--color-followUp)' stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='day'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator='dot' />}
            />
            <Area
              dataKey='visited'
              type='natural'
              fill='url(#fillVisited)'
              stroke='var(--color-visited)'
              stackId='a'
            />
            <Area
              dataKey='noAnswer'
              type='natural'
              fill='url(#fillNoAnswer)'
              stroke='var(--color-noAnswer)'
              stackId='a'
            />
            <Area
              dataKey='wrongAddress'
              type='natural'
              fill='url(#fillWrongAddress)'
              stroke='var(--color-wrongAddress)'
              stackId='a'
            />
            <Area
              dataKey='followUp'
              type='natural'
              fill='url(#fillFollowUp)'
              stroke='var(--color-followUp)'
              stackId='a'
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className='flex w-full items-start gap-2 text-sm'>
          <div className='grid gap-2'>
            <div className='flex items-center gap-2 leading-none font-medium'>
              Visit outcomes over time{' '}
              <IconTrendingUp className='h-4 w-4' />
            </div>
            <div className='text-muted-foreground flex items-center gap-2 leading-none'>
              Last 30 days
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
