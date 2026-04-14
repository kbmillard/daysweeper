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
import { cn } from '@/lib/utils';

type StatusRow = {
  label: string;
  count: number;
  /** When set, a colored dot is shown before the label (hex). */
  dotColor?: string;
};

type Props = {
  description: ReactNode;
  value: number;
  badgeText?: string;
  footerTop?: ReactNode;
  footerMuted?: ReactNode;
  /** CRM company.status or LastLeg route outcome rows */
  statusRows?: StatusRow[];
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
        <CardDescription className='flex flex-wrap items-center gap-x-2 gap-y-1'>
          {description}
        </CardDescription>
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
            {statusRows.map((row, i) => (
              <li
                key={`${row.label}-${i}`}
                className='flex justify-between gap-2 tabular-nums'
              >
                <span
                  className='flex min-w-0 items-center gap-2'
                  title={row.label}
                >
                  {row.dotColor != null && row.dotColor !== '' && (
                    <span
                      className={cn(
                        'inline-block size-2 shrink-0 rounded-full ring-1',
                        row.dotColor === '#fafafa'
                          ? 'ring-neutral-400'
                          : 'ring-border'
                      )}
                      style={{ backgroundColor: row.dotColor }}
                      aria-hidden
                    />
                  )}
                  <span className='truncate'>{row.label}</span>
                </span>
                <span className='shrink-0 font-medium text-foreground'>
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardFooter>
    </Card>
  );
}
