'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

/** Stable empty list so pick-parent mode does not recreate deps every render (fetch loop). */
const EMPTY_CHILD_IDS: string[] = [];

type CompanyOption = { id: string; name: string };

type Base = { compact?: boolean };

type LinkExistingChildProps = Base & {
  mode?: 'linkExistingChild';
  parentCompanyId: string;
  existingChildIds?: string[];
};

type PickParentForNewChildProps = Base & {
  mode: 'pickParentForNewChild';
  currentCompanyId: string;
  basePath: 'dashboard' | 'map';
  locationPrefill?: {
    addressRaw?: string | null;
    latitude?: unknown;
    longitude?: unknown;
    /** After creating the child, delete this location from the source company */
    sourceLocationId?: string;
    sourceCompanyId?: string;
  };
};

export type AddChildCompanySearchProps = LinkExistingChildProps | PickParentForNewChildProps;

function buildNewChildCompanyUrl(
  basePath: 'dashboard' | 'map',
  parentId: string,
  locationPrefill?: PickParentForNewChildProps['locationPrefill']
) {
  const root = basePath === 'map' ? '/map' : '/dashboard';
  const params = new URLSearchParams();
  params.set('parentId', parentId);
  const addr = locationPrefill?.addressRaw?.trim();
  if (addr) {
    params.set('address', addr);
    const lat =
      locationPrefill?.latitude != null ? Number(locationPrefill.latitude) : NaN;
    const lng =
      locationPrefill?.longitude != null ? Number(locationPrefill.longitude) : NaN;
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      params.set('lat', String(lat));
      params.set('lng', String(lng));
    }
  }
  const sl = locationPrefill?.sourceLocationId?.trim();
  const sc = locationPrefill?.sourceCompanyId?.trim();
  if (sl && sc) {
    params.set('removeLocationId', sl);
    params.set('removeFromCompanyId', sc);
  }
  return `${root}/companies/new?${params.toString()}`;
}

function isPickParent(
  props: AddChildCompanySearchProps
): props is PickParentForNewChildProps {
  return props.mode === 'pickParentForNewChild';
}

export function AddChildCompanySearch(props: AddChildCompanySearchProps) {
  const uid = useId();
  const inputId = `${uid}-add-child-search`;
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const router = useRouter();

  const pickParent = isPickParent(props);
  const parentCompanyId = pickParent ? undefined : props.parentCompanyId;
  const existingChildIds = pickParent
    ? EMPTY_CHILD_IDS
    : (props.existingChildIds ?? EMPTY_CHILD_IDS);
  const currentCompanyId = pickParent ? props.currentCompanyId : undefined;
  const basePath = pickParent ? props.basePath : undefined;
  const locationPrefill = pickParent ? props.locationPrefill : undefined;
  const compact = props.compact ?? false;

  /** Value-stable key (parent often passes a new array ref for existingChildIds each render). */
  const excludedChildIdsKey = pickParent
    ? ''
    : [...existingChildIds].sort().join('|');

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setOptions([]);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/companies?search=${encodeURIComponent(q)}&limit=200`, {
        signal: ac.signal
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.error) {
            setOptions([]);
            return;
          }
          const list = (data.companies ?? []) as CompanyOption[];
          if (pickParent) {
            // Include all matches (e.g. same company as parent for a new child at this location).
            setOptions(list);
          } else if (parentCompanyId) {
            const excluded = new Set(
              excludedChildIdsKey ? excludedChildIdsKey.split('|') : []
            );
            setOptions(
              list.filter(
                (c) => c.id !== parentCompanyId && !excluded.has(c.id)
              )
            );
          } else {
            setOptions(list);
          }
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setOptions([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [
    search,
    pickParent,
    parentCompanyId,
    excludedChildIdsKey
  ]);

  async function addAsChild(companyId: string, companyName: string) {
    if (!parentCompanyId) return;
    setSubmittingId(companyId);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentCompanyId })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add as child');
        return;
      }
      toast.success(`${companyName} added as child company`);
      setSearch('');
      setOptions([]);
      router.refresh();
    } catch {
      toast.error('Failed to add as child');
    } finally {
      setSubmittingId(null);
    }
  }

  function goToNewChildForm(parentId: string) {
    if (!pickParent || !basePath) return;
    setSubmittingId(parentId);
    try {
      const url = buildNewChildCompanyUrl(basePath, parentId, locationPrefill);
      router.push(url);
      setSearch('');
      setOptions([]);
    } finally {
      setSubmittingId(null);
    }
  }

  const parentPickerCopy = {
    label: 'Search company to attach as parent company.',
    placeholder: 'Search company to attach as parent company.',
    action: 'Continue'
  } as const;

  if (compact) {
    return (
      <div className='relative w-full min-w-[200px] max-w-[min(100%,320px)]'>
        <Label htmlFor={inputId} className='sr-only'>
          {pickParent ? parentPickerCopy.label : 'Search company to attach as child'}
        </Label>
        <Input
          id={inputId}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            pickParent
              ? parentPickerCopy.placeholder
              : 'Search company to attach as child…'
          }
          className='h-8 text-xs'
          autoComplete='off'
        />
        {loading && (
          <p className='text-muted-foreground absolute left-0 top-full z-40 mt-1 text-xs'>
            Searching…
          </p>
        )}
        {options.length > 0 && (
          <ul
            className='bg-popover text-popover-foreground absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border p-1 text-xs shadow-md'
            role='listbox'
          >
            {options.map((c) => (
              <li
                key={c.id}
                className='flex items-center justify-between gap-2 rounded-sm px-2 py-1 hover:bg-accent'
              >
                <span className='min-w-0 flex-1 truncate font-medium'>{c.name}</span>
                <Button
                  type='button'
                  size='sm'
                  className='h-7 shrink-0 px-2 text-xs'
                  disabled={submittingId !== null}
                  onClick={() =>
                    pickParent ? goToNewChildForm(c.id) : addAsChild(c.id, c.name)
                  }
                >
                  {submittingId === c.id
                    ? '…'
                    : pickParent
                      ? parentPickerCopy.action
                      : 'Attach'}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {search.trim() && !loading && options.length === 0 && (
          <p className='text-muted-foreground absolute left-0 top-full z-40 mt-1 text-xs'>
            No matches
          </p>
        )}
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <Label htmlFor={inputId}>Search all companies</Label>
      <Input
        id={inputId}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder='Type company name to search…'
        className='max-w-md'
        autoComplete='off'
      />
      {loading && (
        <p className='text-muted-foreground text-sm'>Searching…</p>
      )}
      {options.length > 0 && (
        <ul className='max-h-60 max-w-md space-y-2 overflow-auto rounded-md border p-2'>
          {options.map((c) => (
            <li key={c.id} className='flex items-center justify-between gap-2'>
              <span className='font-medium'>{c.name}</span>
              <Button
                type='button'
                size='sm'
                disabled={submittingId !== null}
                onClick={() => addAsChild(c.id, c.name)}
              >
                {submittingId === c.id ? 'Adding…' : 'Add as child'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {search.trim() && !loading && options.length === 0 && (
        <p className='text-muted-foreground text-sm'>
          No other companies found. Try a different search.
        </p>
      )}
    </div>
  );
}
