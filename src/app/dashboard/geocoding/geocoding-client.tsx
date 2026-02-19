'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, MapPin, AlertCircle, CheckCircle } from 'lucide-react';

type LocationNeedingGeocode = {
  id: string;
  companyId: string;
  addressRaw: string;
};

type GeocodingClientProps = {
  locationsNeedingGeocode: LocationNeedingGeocode[];
  totalLocations: number;
  geocodedLocations: number;
};

export default function GeocodingClient({
  locationsNeedingGeocode: initialLocations,
  totalLocations: initialTotal,
  geocodedLocations: initialGeocoded
}: GeocodingClientProps) {
  const [loading, setLoading] = useState(false);
  const [locationsNeedingGeocode, setLocationsNeedingGeocode] =
    useState(initialLocations);
  const [totalLocations, setTotalLocations] = useState(initialTotal);
  const [geocodedLocations, setGeocodedLocations] = useState(initialGeocoded);

  const handleBulkGeocode = async () => {
    if (locationsNeedingGeocode.length === 0) {
      toast.info('All locations are already geocoded');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/geocode/bulk', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Bulk geocoding failed');
      }

      const result = await response.json();

      toast.success(`Successfully geocoded ${result.success} locations!`);

      if (result.failed > 0) {
        toast.warning(`${result.failed} locations failed to geocode`);
      }

      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to geocode locations'
      );
    } finally {
      setLoading(false);
    }
  };

  const percentageGeocoded =
    totalLocations > 0
      ? Math.round((geocodedLocations / totalLocations) * 100)
      : 0;

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Locations
            </CardTitle>
            <MapPin className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalLocations}</div>
            <p className='text-muted-foreground text-xs'>
              All company locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Geocoded</CardTitle>
            <CheckCircle className='h-4 w-4 text-green-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{geocodedLocations}</div>
            <p className='text-muted-foreground text-xs'>
              {percentageGeocoded}% complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Need Geocoding
            </CardTitle>
            <AlertCircle className='h-4 w-4 text-orange-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {locationsNeedingGeocode.length}
            </div>
            <p className='text-muted-foreground text-xs'>Missing coordinates</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Geocoding</CardTitle>
          <CardDescription>
            Geocode all locations that are missing latitude/longitude
            coordinates using Google Maps API
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium'>
                {locationsNeedingGeocode.length} locations need geocoding
              </p>
              <p className='text-muted-foreground text-sm'>
                This will use Google Maps API to get accurate coordinates
              </p>
            </div>
            <Button
              onClick={handleBulkGeocode}
              disabled={loading || locationsNeedingGeocode.length === 0}
            >
              {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {loading ? 'Geocoding...' : 'Start Bulk Geocoding'}
            </Button>
          </div>

          {locationsNeedingGeocode.length > 0 && (
            <div className='rounded-lg border p-4'>
              <h4 className='mb-2 text-sm font-semibold'>
                Locations to Geocode:
              </h4>
              <div className='max-h-60 space-y-1 overflow-y-auto'>
                {locationsNeedingGeocode.slice(0, 20).map((loc) => (
                  <div key={loc.id} className='text-muted-foreground text-sm'>
                    • {loc.addressRaw || 'No address'}
                  </div>
                ))}
                {locationsNeedingGeocode.length > 20 && (
                  <div className='text-muted-foreground text-sm italic'>
                    ... and {locationsNeedingGeocode.length - 20} more
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
