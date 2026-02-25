import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Apple App Site Association (AASA) for Universal Links / "Open in App" on iOS.
 * Served at /.well-known/apple-app-site-association via next.config rewrite.
 * Set APPLE_TEAM_ID in env (10-character Apple Team ID) so appID is valid.
 * iOS app bundle: com.daysweeper.bins
 */
export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID || process.env.NEXT_PUBLIC_APPLE_TEAM_ID || '';
  const bundleId = 'com.daysweeper.bins';
  const appID = teamId ? `${teamId}.${bundleId}` : bundleId;

  const body = {
    applinks: {
      apps: [] as string[],
      details: [
        {
          appID,
          paths: ['*', '/dashboard', '/dashboard/*', '/dashboard/bins', '/dashboard/bins/*']
        }
      ]
    },
    webcredentials: {
      apps: teamId ? [appID] : []
    }
  };

  return NextResponse.json(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
