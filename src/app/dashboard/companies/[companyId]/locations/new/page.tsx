'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

export default function NewLocationPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const [addressRaw, setAddressRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressRaw: addressRaw.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to add location');
        return;
      }
      router.push(`/dashboard/companies/${companyId}`);
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
        <Link href={`/dashboard/companies/${companyId}`}>
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
            {error && (
              <p className='text-destructive text-sm'>{error}</p>
            )}
            <div className='flex gap-2'>
              <Button type='submit' disabled={loading}>
                {loading ? 'Adding…' : 'Add location'}
              </Button>
              <Link href={`/dashboard/companies/${companyId}`}>
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
