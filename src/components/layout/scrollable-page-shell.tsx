'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Main content scrolls inside Radix ScrollArea, not the window. Next.js does not reset
 * those viewports on client navigations, so we snap to top when the route changes.
 */
export function ScrollablePageShell({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const viewport = wrapRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );
    if (viewport instanceof HTMLElement) {
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
    }
  }, [pathname]);

  return (
    <div ref={wrapRef} className='min-h-0 min-w-0'>
      <ScrollArea className={className}>{children}</ScrollArea>
    </div>
  );
}
