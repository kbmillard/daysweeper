'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function MapError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[MapPage]', error); }, [error]);
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center bg-[#1a1a2e]">
      <div className="flex flex-col items-center gap-4 text-white/70 text-sm text-center px-6">
        <p className="text-base font-medium text-white">Map failed to load</p>
        <p className="text-white/50 font-mono text-xs">{error.message}</p>
        <Button variant="outline" size="sm" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
