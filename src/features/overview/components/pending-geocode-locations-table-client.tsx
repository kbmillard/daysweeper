'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

export type PendingGeocodeLocationRow = {
  id: string;
  externalId: string | null;
  addressRaw: string;
  city: string;
  state: string;
  country: string;
  companyId: string;
  companyName: string;
  companyHidden: boolean;
};

function contains(hay: string, needle: string) {
  if (!needle.trim()) return true;
  return hay.toLowerCase().includes(needle.trim().toLowerCase());
}

export function PendingGeocodeLocationsTableClient({
  rows
}: {
  rows: PendingGeocodeLocationRow[];
}) {
  const [companyQ, setCompanyQ] = useState('');
  const [cityQ, setCityQ] = useState('');
  const [stateQ, setStateQ] = useState<string>('__all__');
  const [countryQ, setCountryQ] = useState('');
  const [addressQ, setAddressQ] = useState('');
  const [locationIdQ, setLocationIdQ] = useState('');

  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.state.trim()) set.add(r.state.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const hasBlankState = useMemo(() => rows.some((r) => !r.state.trim()), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!contains(r.companyName, companyQ)) return false;
      if (!contains(r.city, cityQ)) return false;
      if (stateQ === '__none__') {
        if (r.state.trim()) return false;
      } else if (stateQ !== '__all__' && r.state.trim() !== stateQ) return false;
      if (!contains(r.country, countryQ)) return false;
      if (!contains(r.addressRaw, addressQ)) return false;
      if (locationIdQ.trim()) {
        const q = locationIdQ.trim().toLowerCase();
        const idMatch = r.id.toLowerCase().includes(q);
        const ext = (r.externalId ?? '').toLowerCase().includes(q);
        if (!idMatch && !ext) return false;
      }
      return true;
    });
  }, [
    rows,
    companyQ,
    cityQ,
    stateQ,
    countryQ,
    addressQ,
    locationIdQ
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Locations missing geocode</CardTitle>
        <CardDescription>
          Every location with an address on file and no latitude/longitude. Filter any column; state
          uses an exact match when selected. Company opens the company page; internal ID opens the
          location page.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='pg-filter-company'>Company</Label>
            <Input
              id='pg-filter-company'
              placeholder='Filter by name…'
              value={companyQ}
              onChange={(e) => setCompanyQ(e.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='pg-filter-city'>City</Label>
            <Input
              id='pg-filter-city'
              placeholder='Filter…'
              value={cityQ}
              onChange={(e) => setCityQ(e.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='pg-filter-state'>State</Label>
            <Select value={stateQ} onValueChange={setStateQ}>
              <SelectTrigger id='pg-filter-state'>
                <SelectValue placeholder='All states' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__all__'>All states</SelectItem>
                {hasBlankState ? (
                  <SelectItem value='__none__'>(No state in address)</SelectItem>
                ) : null}
                {stateOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='pg-filter-country'>Country</Label>
            <Input
              id='pg-filter-country'
              placeholder='Filter…'
              value={countryQ}
              onChange={(e) => setCountryQ(e.target.value)}
            />
          </div>
          <div className='space-y-1.5 sm:col-span-2 lg:col-span-2'>
            <Label htmlFor='pg-filter-address'>Address</Label>
            <Input
              id='pg-filter-address'
              placeholder='Contains…'
              value={addressQ}
              onChange={(e) => setAddressQ(e.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='pg-filter-locid'>Location id</Label>
            <Input
              id='pg-filter-locid'
              placeholder='Internal or external id…'
              value={locationIdQ}
              onChange={(e) => setLocationIdQ(e.target.value)}
            />
          </div>
        </div>

        <p className='text-muted-foreground text-sm'>
          Showing {filtered.length} of {rows.length} locations
        </p>

        {rows.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            No locations are missing coordinates (or none have a non-empty address).
          </p>
        ) : filtered.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No rows match the current filters.</p>
        ) : (
          <div className='max-h-[min(28rem,55vh)] overflow-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className='hidden sm:table-cell'>Country</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className='hidden lg:table-cell'>External id</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className='font-medium'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Link
                          href={`/dashboard/companies/${r.companyId}`}
                          className='text-primary hover:underline'
                        >
                          {r.companyName}
                        </Link>
                        {r.companyHidden ? (
                          <Badge variant='secondary' className='text-xs'>
                            hidden
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className='text-muted-foreground text-sm'>{r.city || '—'}</TableCell>
                    <TableCell className='text-muted-foreground text-sm'>{r.state || '—'}</TableCell>
                    <TableCell className='text-muted-foreground hidden text-sm sm:table-cell'>
                      {r.country || '—'}
                    </TableCell>
                    <TableCell className='max-w-[min(20rem,40vw)] text-muted-foreground text-sm'>
                      {r.addressRaw}
                    </TableCell>
                    <TableCell className='text-muted-foreground hidden font-mono text-xs lg:table-cell'>
                      {r.externalId ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/companies/${r.companyId}/locations/${r.id}`}
                        className='text-primary font-mono text-xs hover:underline'
                      >
                        {r.id.slice(0, 8)}…
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
