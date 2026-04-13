'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CompanyNameSearchField } from '@/features/companies/company-name-search-field';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import { notifyLocationsMapUpdate } from '@/lib/locations-map-update';

const BASE = '/map';

export default function NewCompanyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentId = searchParams.get('parentId') ?? undefined;

  const [parentName, setParentName] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [addressRaw, setAddressRaw] = useState('');
  const [prefillLat, setPrefillLat] = useState<number | null>(null);
  const [prefillLng, setPrefillLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeLocationId, setRemoveLocationId] = useState<string | null>(null);
  const [removeFromCompanyId, setRemoveFromCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (!parentId) return;
    fetch(`/api/companies/${parentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.company?.name && setParentName(data.company.name))
      .catch(() => {});
  }, [parentId]);

  useEffect(() => {
    const addr = searchParams.get('address');
    if (addr) setAddressRaw(addr);
    const la = searchParams.get('lat');
    const ln = searchParams.get('lng');
    if (la != null && ln != null) {
      const lat = Number(la);
      const lng = Number(ln);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        setPrefillLat(lat);
        setPrefillLng(lng);
      }
    }
    const rl = searchParams.get('removeLocationId');
    const rc = searchParams.get('removeFromCompanyId');
    setRemoveLocationId(rl && rc ? rl : null);
    setRemoveFromCompanyId(rl && rc ? rc : null);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const trimmedAddr = addressRaw.trim();
      const body: Record<string, unknown> = {
        name: name.trim(),
        parentCompanyId: parentId || undefined,
        website: website.trim() || undefined,
        phone: phone.trim() || undefined
      };
      if (trimmedAddr) {
        body.addressRaw = trimmedAddr;
        if (prefillLat != null && prefillLng != null) {
          body.latitude = prefillLat;
          body.longitude = prefillLng;
        }
      }
      if (removeLocationId && removeFromCompanyId) {
        body.removeLocationId = removeLocationId;
        body.removeFromCompanyId = removeFromCompanyId;
      }

      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create company');
        return;
      }
      if (prefillLat != null && prefillLng != null) notifyLocationsMapUpdate();
      router.push(`${BASE}/companies/${data.company.id}`);
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer
      scrollable
      pageTitle={parentId ? 'Add child company' : 'New company'}
      pageDescription={
        parentId
          ? `Add a child company under ${parentName ?? 'parent'}`
          : 'Create a new company'
      }
    >
      <div className='space-y-6'>
        <div>
          <Link href={parentId ? `${BASE}/companies/${parentId}` : `${BASE}/companies`}>
            <Button variant='outline' size='sm'>
              <IconArrowLeft className='mr-2 h-4 w-4' />
              Back
            </Button>
          </Link>
        </div>

        <Card className='max-w-xl'>
          <CardHeader>
            <CardTitle>{parentId ? 'Add child company' : 'New company'}</CardTitle>
            <CardDescription>
              {parentId
                ? parentName
                  ? `Company will be linked as a child of ${parentName}.`
                  : 'Company will be linked to the selected parent.'
                : 'Create a new company record.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className='space-y-4'>
              <CompanyNameSearchField
                id='name'
                label='Company name'
                value={name}
                onChange={setName}
                placeholder='Company name'
                required
                basePath='map'
              />
              {parentId && (
                <div>
                  <Label htmlFor='addressRaw'>Address (from location)</Label>
                  <Textarea
                    id='addressRaw'
                    value={addressRaw}
                    onChange={(e) => setAddressRaw(e.target.value)}
                    placeholder='Street, city, state, postal code — edit if needed'
                    rows={3}
                    className='mt-1'
                  />
                  {prefillLat != null && prefillLng != null && (
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Coordinates {prefillLat.toFixed(6)}, {prefillLng.toFixed(6)} will be saved
                      with this address when you create the company.
                    </p>
                  )}
                </div>
              )}
              <div>
                <Label htmlFor='website'>Website</Label>
                <Input
                  id='website'
                  type='url'
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder='https://…'
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='phone'>Phone</Label>
                <Input
                  id='phone'
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder='Phone'
                  className='mt-1'
                />
              </div>
              {error && <p className='text-destructive text-sm'>{error}</p>}
              <div className='flex gap-2'>
                <Button type='submit' disabled={loading}>
                  {loading ? 'Creating…' : parentId ? 'Add child company' : 'Create company'}
                </Button>
                <Link href={parentId ? `${BASE}/companies/${parentId}` : `${BASE}/companies`}>
                  <Button type='button' variant='outline'>
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
