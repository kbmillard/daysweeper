'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div
      data-slot='table-container'
      className='relative w-full overflow-x-auto rounded-3xl bg-card/85 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/45 dark:border-white/12 shadow-[0_4px_8px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.08),0_32px_64px_rgba(0,0,0,0.1),inset_0_2px_2px_rgba(255,255,255,0.85),inset_0_-1px_1px_rgba(0,0,0,0.02)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45),0_32px_80px_rgba(0,0,0,0.35),inset_0_2px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.15)]'
    >
      <table
        data-slot='table'
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot='table-header'
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot='table-body'
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot='table-row'
      className={cn(
        'hover:bg-black/[0.03] dark:hover:bg-white/[0.04] data-[state=selected]:bg-primary/10 border-b border-black/[0.06] dark:border-white/[0.08] transition-colors',
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot='table-head'
      className={cn(
        'text-muted-foreground/80 h-11 px-3 text-left align-middle text-[13px] font-medium uppercase tracking-wide whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot='table-cell'
      className={cn(
        'p-3 align-middle whitespace-nowrap text-[14px] [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot='table-caption'
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption
};
