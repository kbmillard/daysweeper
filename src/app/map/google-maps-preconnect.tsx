'use client';

import { useEffect } from 'react';

/** Warm DNS/TLS for Maps script and tiles on any /map/* route. */
export function GoogleMapsPreconnect() {
  useEffect(() => {
    const ensure = (rel: string, href: string, crossOrigin?: boolean) => {
      if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
      const l = document.createElement('link');
      l.rel = rel;
      l.href = href;
      if (crossOrigin) l.crossOrigin = '';
      document.head.appendChild(l);
    };
    ensure('preconnect', 'https://maps.googleapis.com');
    ensure('preconnect', 'https://maps.gstatic.com', true);
    ensure('dns-prefetch', 'https://maps.googleapis.com');
  }, []);
  return null;
}
