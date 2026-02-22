'use client';

import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { IconAlertCircle } from '@tabler/icons-react';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className='container flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8'>
      <Alert variant='destructive' className='max-w-xl'>
        <IconAlertCircle className='h-4 w-4' />
        <AlertTitle>Application error</AlertTitle>
        <AlertDescription className='mt-2 space-y-2'>
          <p className='font-mono text-sm'>{error.message}</p>
          {error.stack && (
            <pre className='max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs opacity-80'>
              {error.stack}
            </pre>
          )}
        </AlertDescription>
      </Alert>
      <Button onClick={reset} variant='outline'>
        Try again
      </Button>
    </div>
  );
}
