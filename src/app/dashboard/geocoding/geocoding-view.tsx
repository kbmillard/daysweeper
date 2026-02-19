'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCallback, useEffect, useState } from 'react';
import { IconMapPin, IconRefresh } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

type Stats = { total: number; withGeocode: number; missing: number } | null;

export function GeocodingView() {
  const [stats, setStats] = useState<Stats>(null);
  const [baseUrl, setBaseUrl] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/locations/geocode-stats');
      if (res.ok) setStats(await res.json());
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    if (typeof window !== 'undefined') setBaseUrl(window.location.origin);
  }, [fetchStats]);

  const cmd = baseUrl
    ? `DAYSWEEPER_URL=${baseUrl} pnpm run geocode:apple`
    : 'DAYSWEEPER_URL=<your-app-url> pnpm run geocode:apple';

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total locations</CardTitle>
            <IconMapPin className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? '—'}</div>
            <p className="text-muted-foreground text-xs">All location records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Geocoded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.withGeocode ?? '—'}</div>
            <p className="text-muted-foreground text-xs">Have latitude & longitude</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing coords</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.missing ?? '—'}</div>
            <p className="text-muted-foreground text-xs">Have address, need geocode</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geocode with Apple (macOS)</CardTitle>
          <CardDescription>
            Run the Apple geocoding script on a Mac. It fetches locations missing lat/lng, geocodes
            them with CLGeocoder, and saves results back to this app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            From this project root on macOS (with this app running or deployed):
          </p>
          <pre className="bg-muted rounded-lg border p-4 font-mono text-sm">{cmd}</pre>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard?.writeText(cmd)}
            >
              Copy command
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchStats}>
              <IconRefresh className="mr-2 h-4 w-4" />
              Refresh stats
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
