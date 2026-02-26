'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, background: '#0f0f0f', color: '#fff', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Something went wrong</p>
          <p style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'monospace', marginBottom: '1.5rem' }}>{error?.message ?? 'Unknown error'}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: '1px solid #444', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
