'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type CompanyOption = { id: string; name: string };
type LocationOption = { id: string; addressRaw: string };

export function LinkExistingCompanyAsLocation({
  targetCompanyId
}: {
  targetCompanyId: string;
}) {
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const router = useRouter();

  const fetchCompanies = useCallback(() => {
    if (!search.trim()) {
      setCompanies([]);
      return;
    }
    setLoading(true);
    fetch(`/api/companies?search=${encodeURIComponent(search)}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        const list = (data.companies ?? []) as CompanyOption[];
        setCompanies(list.filter((c) => c.id !== targetCompanyId));
      })
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, [search, targetCompanyId]);

  useEffect(() => {
    const t = setTimeout(fetchCompanies, 300);
    return () => clearTimeout(t);
  }, [fetchCompanies]);

  function fetchLocations(companyId: string) {
    if (expandedId === companyId && locations.length >= 0) {
      setExpandedId(null);
      return;
    }
    setExpandedId(companyId);
    setLocations([]);
    setLocationsLoading(true);
    fetch(`/api/companies/${companyId}/locations`)
      .then((r) => r.json())
      .then((data) => setLocations(data.locations ?? []))
      .catch(() => setLocations([]))
      .finally(() => setLocationsLoading(false));
  }

  async function linkLocation(locationId: string, addressRaw: string) {
    setSubmittingId(locationId);
    try {
      const res = await fetch(`/api/companies/${targetCompanyId}/locations/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to link location');
        return;
      }
      toast.success(`Linked location: ${addressRaw || 'Address'}`);
      setExpandedId(null);
      setLocations([]);
      router.refresh();
    } catch {
      toast.error('Failed to link location');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className='space-y-2'>
      <Label htmlFor='link-location-search'>Search companies to link a location from</Label>
      <Input
        id='link-location-search'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder='Type company name…'
        className='max-w-md'
      />
      {loading && <p className='text-muted-foreground text-sm'>Searching…</p>}
      {companies.length > 0 && (
        <ul className='space-y-2 border rounded-md p-2 max-h-60 overflow-auto max-w-md'>
          {companies.map((c) => (
            <li key={c.id} className='flex flex-col gap-1'>
              <div className='flex items-center justify-between gap-2'>
                <span className='font-medium'>{c.name}</span>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={locationsLoading}
                  onClick={() => fetchLocations(c.id)}
                >
                  {expandedId === c.id ? 'Hide locations' : 'Choose location'}
                </Button>
              </div>
              {expandedId === c.id && (
                <div className='pl-2 border-l space-y-1'>
                  {locationsLoading && (
                    <p className='text-muted-foreground text-sm'>Loading…</p>
                  )}
                  {!locationsLoading && locations.length === 0 && (
                    <p className='text-muted-foreground text-sm'>
                      No locations for this company.
                    </p>
                  )}
                  {!locationsLoading &&
                    locations.map((loc) => (
                      <div
                        key={loc.id}
                        className='flex items-center justify-between gap-2 text-sm'
                      >
                        <span className='text-muted-foreground truncate flex-1'>
                          {loc.addressRaw || 'No address'}
                        </span>
                        <Button
                          type='button'
                          size='sm'
                          disabled={submittingId !== null}
                          onClick={() => linkLocation(loc.id, loc.addressRaw)}
                        >
                          {submittingId === loc.id ? 'Linking…' : 'Link here'}
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {search.trim() && !loading && companies.length === 0 && (
        <p className='text-muted-foreground text-sm'>
          No other companies found. Try a different search.
        </p>
      )}
    </div>
  );
}
