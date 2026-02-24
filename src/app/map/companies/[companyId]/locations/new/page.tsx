'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import { parseDmsCoordinates } from '@/lib/geocode-address';
import { notifyLocationsMapUpdate } from '@/lib/locations-map-update';
import { toast } from 'sonner';

export default function NewLocationPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const [addressRaw, setAddressRaw] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: { addressRaw: string; latitude?: number; longitude?: number } = {
        addressRaw: addressRaw.trim()
      };
      if (latitude.trim()) {
        const lat = Number(latitude);
        if (!Number.isNaN(lat) && lat >= -90 && lat <= 90) body.latitude = lat;
      }
      if (longitude.trim()) {
        const lng = Number(longitude);
        if (!Number.isNaN(lng) && lng >= -180 && lng <= 180) body.longitude = lng;
      }
      const res = await fetch(`/api/companies/${companyId}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to add location');
        return;
      }
      if (body.latitude != null || body.longitude != null) notifyLocationsMapUpdate();
      router.push(`/map/companies/${companyId}/locations/${data.location.id}`);
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <Link href={`/map/companies/${companyId}`}>
          <Button variant='outline' size='sm'>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back to Company
          </Button>
        </Link>
      </div>

      <Card className='max-w-xl'>
        <CardHeader>
          <CardTitle>Add location</CardTitle>
          <CardDescription>Add a new address for this company.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <Label htmlFor='addressRaw'>Address</Label>
              <Input
                id='addressRaw'
                value={addressRaw}
                onChange={(e) => setAddressRaw(e.target.value)}
                placeholder='Street, city, state, postal code, country'
                required
                className='mt-1'
              />
            </div>
            <div>
              <Label htmlFor='coordinatesPaste'>Paste coordinates (Google Earth format)</Label>
              <Input
                id='coordinatesPaste'
                placeholder='e.g. 42°04′17.96″N 88°17′47.01″W'
                className='mt-1 font-mono'
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  const parsed = parseDmsCoordinates(pasted);
                  if (parsed) {
                    e.preventDefault();
                    setLatitude(parsed.lat.toFixed(6));
                    setLongitude(parsed.lng.toFixed(6));
                    toast.success('Coordinates pasted');
                  }
                }}
              />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <Label htmlFor='latitude'>Latitude</Label>
                <Input
                  id='latitude'
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    const parsed = parseDmsCoordinates(pasted);
                    if (parsed) {
                      e.preventDefault();
                      setLatitude(parsed.lat.toFixed(6));
                      setLongitude(parsed.lng.toFixed(6));
                      toast.success('Coordinates pasted from Google Earth');
                    }
                  }}
                  placeholder='e.g. 42.333239'
                  className='mt-1 font-mono'
                />
              </div>
              <div>
                <Label htmlFor='longitude'>Longitude</Label>
                <Input
                  id='longitude'
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder='e.g. -83.155683'
                  className='mt-1 font-mono'
                />
              </div>
            </div>
            {error && (
              <p className='text-destructive text-sm'>{error}</p>
            )}
            <div className='flex gap-2'>
              <Button type='submit' disabled={loading}>
                {loading ? 'Adding…' : 'Add location'}
              </Button>
              <Link href={`/map/companies/${companyId}`}>
                <Button type='button' variant='outline'>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
