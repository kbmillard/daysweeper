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

type ChartData = {
  category: string;
  count: number;
  fill: string;
};

const chartConfig = {
  count: {
    label: 'Companies'
  }
} satisfies ChartConfig;

export function CompanyPieGraph({ data }: { data: ChartData[] }) {
  const totalCompanies = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.count, 0);
  }, [data]);

  if (data.length === 0) {
    return (
      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>Companies by Category</CardTitle>
          <CardDescription>No category data available</CardDescription>
        </CardHeader>
        <CardContent className='flex items-center justify-center h-[250px]'>
          <p className='text-muted-foreground'>No companies with categories</p>
        </CardContent>
      </Card>
    );
  }

  // Generate gradient IDs for each category
  const chartDataWithGradients = data.map((item, index) => ({
    ...item,
    fill: `url(#fillCategory${index})`
  }));

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Companies by Category</CardTitle>
        <CardDescription>
          <span className='hidden @[540px]/card:block'>
            Distribution of companies by supply chain category
          </span>
          <span className='@[540px]/card:hidden'>Category distribution</span>
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='mx-auto aspect-square h-[250px]'
        >
          <PieChart>
            <defs>
              {data.map((item, index) => (
                <linearGradient
                  key={item.category}
                  id={`fillCategory${index}`}
                  x1='0'
                  y1='0'
                  x2='0'
                  y2='1'
                >
                  <stop
                    offset='0%'
                    stopColor='var(--primary)'
                    stopOpacity={1 - index * 0.15}
                  />
                  <stop
                    offset='100%'
                    stopColor='var(--primary)'
                    stopOpacity={0.8 - index * 0.15}
                  />
                </linearGradient>
              ))}
            </defs>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartDataWithGradients}
              dataKey='count'
              nameKey='category'
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
                          {totalCompanies.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className='fill-muted-foreground text-sm'
                        >
                          Total Companies
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
        {data.length > 0 && (
          <>
            <div className='flex items-center gap-2 leading-none font-medium'>
              {data[0].category} leads with{' '}
              {((data[0].count / totalCompanies) * 100).toFixed(1)}%{' '}
              <IconTrendingUp className='h-4 w-4' />
            </div>
            <div className='text-muted-foreground leading-none'>
              Top {data.length} categories shown
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
