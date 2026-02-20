'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(segment: string): boolean {
  return UUID_REGEX.test(segment);
}

// This allows to add custom title as well
const routeMapping: Record<string, BreadcrumbItem[]> = {
  '/map': [{ title: 'Map', link: '/map' }],
  '/map/employee': [
    { title: 'Map', link: '/map' },
    { title: 'Employee', link: '/map/employee' }
  ],
  '/map/product': [
    { title: 'Map', link: '/map' },
    { title: 'Product', link: '/map/product' }
  ]
  // Add more custom mappings as needed
};

export function useBreadcrumbs() {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    // Check if we have a custom mapping for this exact path
    if (routeMapping[pathname]) {
      return routeMapping[pathname];
    }

    // If no exact match, fall back to generating breadcrumbs from the path
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      // Don't show raw UUIDs in breadcrumbs (e.g. location id on location detail pages)
      const title = isUuid(segment)
        ? index > 0 && segments[index - 1] === 'locations'
          ? 'Location'
          : 'Details'
        : segment.charAt(0).toUpperCase() + segment.slice(1);
      return {
        title,
        link: path
      };
    });
  }, [pathname]);

  return breadcrumbs;
}
