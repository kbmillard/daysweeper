'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

/**
 * Clears window/document scroll on client navigations. PageContainer scrollable pages
 * also reset their Radix viewport in ScrollablePageShell; this covers scrollable={false}
 * routes and any stray window offset.
 */
export function NavigationScrollReset() {
  const pathname = usePathname();

  React.useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}
