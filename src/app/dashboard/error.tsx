'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { IconAlertCircle } from '@tabler/icons-react';

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error('[Dashboard]', error); }, [error]);
  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center'>
      <IconAlertCircle className='h-10 w-10 text-destructive' />
      <div className='space-y-1'>
        <p className='text-base font-semibold'>Something went wrong</p>
        <p className='text-sm text-muted-foreground font-mono'>{error.message}</p>
      </div>
      <Button variant='outline' size='sm' onClick={reset}>Try again</Button>
    </div>
  );
}
