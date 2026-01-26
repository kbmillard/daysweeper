'use client';

import * as React from 'react';
import { IconTrendingUp } from '@tabler/icons-react';
import { Label, Pie, PieChart } from 'recharts';

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
  count: {
    label: 'Count'
  },
  ACCOUNT: {
    label: 'Account',
    color: 'hsl(var(--primary))'
  },
  NEW_UNCONTACTED: {
    label: 'New - Uncontacted',
    color: 'hsl(var(--muted-foreground))'
  },
  NEW_CONTACTED_NO_ANSWER: {
    label: 'New - No Answer',
    color: 'hsl(var(--warning))'
  }
} satisfies ChartConfig;

interface PieGraphProps {
  data?: Array<{
    state: string;
    count: number;
  }>;
}

export function PieGraph({ data = [] }: PieGraphProps) {
  const chartData = data.map((item, index) => ({
    state: item.state,
    count: item.count,
    fill: `var(--color-${item.state})`
  }));

  const totalCount = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.count, 0);
  }, [chartData]);

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Account State Distribution</CardTitle>
        <CardDescription>
          <span className='hidden @[540px]/card:block'>
            Distribution of targets by account state
          </span>
          <span className='@[540px]/card:hidden'>State distribution</span>
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='mx-auto aspect-square h-[250px]'
        >
          <PieChart>
            <defs>
              {chartData.map((item, index) => (
                <linearGradient
                  key={item.state}
                  id={`fill${item.state}`}
                  x1='0'
                  y1='0'
                  x2='0'
                  y2='1'
                >
                  <stop
                    offset='0%'
                    stopColor={`var(--color-${item.state})`}
                    stopOpacity={1 - index * 0.1}
                  />
                  <stop
                    offset='100%'
                    stopColor={`var(--color-${item.state})`}
                    stopOpacity={0.8 - index * 0.1}
                  />
                </linearGradient>
              ))}
            </defs>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData.map((item) => ({
                ...item,
                fill: `url(#fill${item.state})`
              }))}
              dataKey='count'
              nameKey='state'
              innerRadius={60}
              strokeWidth={2}
              stroke='var(--background)'
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor='middle'
                        dominantBaseline='middle'
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className='fill-foreground text-3xl font-bold'
                        >
                          {totalCount.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className='fill-muted-foreground text-sm'
                        >
                          Total Targets
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className='flex-col gap-2 text-sm'>
        {chartData.length > 0 && (
          <div className='flex items-center gap-2 leading-none font-medium'>
            {chartData[0].state.replace('_', ' ')} leads with{' '}
            {totalCount > 0 ? ((chartData[0].count / totalCount) * 100).toFixed(1) : 0}%{' '}
            <IconTrendingUp className='h-4 w-4' />
          </div>
        )}
        <div className='text-muted-foreground leading-none'>
          Current account state distribution
        </div>
      </CardFooter>
    </Card>
  );
}
