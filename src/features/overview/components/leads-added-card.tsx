'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

export function LeadsAddedCard({ total }: { total: number }) {
  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Leads Added - Last 3 Months</CardTitle>
        <CardDescription>Total leads added in the last 3 months</CardDescription>
      </CardHeader>
      <CardContent>
        <p className='text-3xl font-bold tabular-nums sm:text-4xl'>
          {total.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
