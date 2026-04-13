import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { IconTrendingUp } from '@tabler/icons-react';
import type { ReactNode } from 'react';

type Props = {
  description: string;
  value: number;
  badgeText?: string;
  footerTop?: ReactNode;
  footerMuted?: ReactNode;
  /** CRM company.status or Target.accountState rows */
  statusRows?: { label: string; count: number }[];
};

export function OverviewKpiCard({
  description,
  value,
  badgeText,
  footerTop,
  footerMuted,
  statusRows
}: Props) {
  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
          {value.toLocaleString()}
        </CardTitle>
        {badgeText != null && badgeText !== '' && (
          <CardAction>
            <Badge variant='outline'>
              <IconTrendingUp />
              {badgeText}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className='flex-col items-start gap-1.5 text-sm'>
        {footerTop != null && (
          <div className='line-clamp-2 flex flex-wrap gap-2 font-medium'>{footerTop}</div>
        )}
        {footerMuted != null && (
          <div className='text-muted-foreground'>{footerMuted}</div>
        )}
        {statusRows != null && statusRows.length > 0 && (
          <ul className='w-full space-y-0.5 border-t border-border/60 pt-2 text-muted-foreground text-[13px]'>
            {statusRows.map((row) => (
              <li key={row.label} className='flex justify-between gap-2 tabular-nums'>
                <span className='min-w-0 truncate' title={row.label}>
                  {row.label}
                </span>
                <span className='shrink-0 font-medium text-foreground'>{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardFooter>
    </Card>
  );
}
