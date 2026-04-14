'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function MapError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- error boundary diagnostics
    console.error('[Map segment]', error);
  }, [error]);

  return (
    <div className='flex min-h-[50vh] w-full flex-1 flex-col items-center justify-center gap-4 p-8 text-center'>
      <p className='text-lg font-medium'>Something went wrong</p>
      <p className='text-muted-foreground max-w-md text-sm'>
        This page could not be loaded. The main map lives at{' '}
        <a href='/map' className='text-primary underline'>
          /map
        </a>
        ; other routes here use the same shell and may fail for a different
        reason (for example a missing database column if{' '}
        <code className='text-xs'>prisma migrate deploy</code> did not run on
        the production database). Check Vercel → this project → Logs for the
        request to this path; use digest below when contacting support.
      </p>
      {error.digest ? (
        <p className='text-muted-foreground font-mono text-xs'>
          Digest: {error.digest}
        </p>
      ) : null}
      {error.message ? (
        <p className='text-muted-foreground font-mono max-w-lg break-all text-xs'>
          {error.message}
        </p>
      ) : null}
      <Button variant='outline' size='sm' onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
