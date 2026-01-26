'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

export const description = 'An interactive bar chart';

const chartConfig = {
  views: {
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

interface BarGraphProps {
  data?: Array<{
    day: string | Date;
    visited: number;
    noAnswer: number;
    wrongAddress: number;
    followUp: number;
  }>;
}

export function BarGraph({ data = [] }: BarGraphProps) {
  const chartData = data.map((item) => ({
    date: typeof item.day === 'string' ? item.day : item.day.toISOString().split('T')[0],
    visited: item.visited || 0,
    noAnswer: item.noAnswer || 0,
    wrongAddress: item.wrongAddress || 0,
    followUp: item.followUp || 0
  }));

  const [activeChart, setActiveChart] =
    React.useState<keyof typeof chartConfig>('visited');

  const total = React.useMemo(
    () => ({
      visited: chartData.reduce((acc, curr) => acc + curr.visited, 0),
      noAnswer: chartData.reduce((acc, curr) => acc + curr.noAnswer, 0),
      wrongAddress: chartData.reduce((acc, curr) => acc + curr.wrongAddress, 0),
      followUp: chartData.reduce((acc, curr) => acc + curr.followUp, 0)
    }),
    [chartData]
  );

  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);


  if (!isClient) {
    return null;
  }

  return (
    <Card className='@container/card !pt-3'>
      <CardHeader className='flex flex-col items-stretch space-y-0 border-b !p-0 sm:flex-row'>
        <div className='flex flex-1 flex-col justify-center gap-1 px-6 !py-0'>
          <CardTitle>Visit Outcomes by Day</CardTitle>
          <CardDescription>
            <span className='hidden @[540px]/card:block'>
              Visit outcomes over time
            </span>
            <span className='@[540px]/card:hidden'>Visit outcomes</span>
          </CardDescription>
        </div>
        <div className='flex'>
          {['visited', 'noAnswer', 'wrongAddress', 'followUp'].map((key) => {
            const chart = key as keyof typeof chartConfig;
            if (!chart || total[key as keyof typeof total] === 0) return null;
            return (
              <button
                key={chart}
                data-active={activeChart === chart}
                className='data-[active=true]:bg-primary/5 hover:bg-primary/5 relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left transition-colors duration-200 even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6'
                onClick={() => setActiveChart(chart)}
              >
                <span className='text-muted-foreground text-xs'>
                  {chartConfig[chart].label}
                </span>
                <span className='text-lg leading-none font-bold sm:text-3xl'>
                  {total[key as keyof typeof total]?.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[250px] w-full'
        >
          <BarChart
            data={chartData}
            margin={{
              left: 12,
              right: 12
            }}
          >
            <defs>
              <linearGradient id='fillBar' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='0%'
                  stopColor='var(--primary)'
                  stopOpacity={0.8}
                />
                <stop
                  offset='100%'
                  stopColor='var(--primary)'
                  stopOpacity={0.2}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='date'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });
              }}
            />
            <ChartTooltip
              cursor={{ fill: 'var(--primary)', opacity: 0.1 }}
              content={
                <ChartTooltipContent
                  className='w-[150px]'
                  nameKey='views'
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });
                  }}
                />
              }
            />
            <Bar
              dataKey={activeChart}
              fill='url(#fillBar)'
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
