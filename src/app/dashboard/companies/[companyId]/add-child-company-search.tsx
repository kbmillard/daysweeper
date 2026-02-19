'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type CompanyOption = { id: string; name: string };

export function AddChildCompanySearch({
  parentCompanyId,
  existingChildIds = []
}: {
  parentCompanyId: string;
  existingChildIds?: string[];
}) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const router = useRouter();

  const fetchOptions = useCallback(() => {
    if (!search.trim()) {
      setOptions([]);
      return;
    }
    setLoading(true);
    fetch(`/api/companies?search=${encodeURIComponent(search)}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        const list = (data.companies ?? []) as CompanyOption[];
        setOptions(
          list.filter(
            (c) => c.id !== parentCompanyId && !existingChildIds.includes(c.id)
          )
        );
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [search, parentCompanyId, existingChildIds]);

  useEffect(() => {
    const t = setTimeout(fetchOptions, 300);
    return () => clearTimeout(t);
  }, [fetchOptions]);

  async function addAsChild(companyId: string, companyName: string) {
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
      router.refresh();
    } catch {
      toast.error('Failed to add as child');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className='space-y-2'>
      <Label htmlFor='add-child-search'>Search all companies</Label>
      <Input
        id='add-child-search'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder='Type company name to search…'
        className='max-w-md'
      />
      {loading && (
        <p className='text-muted-foreground text-sm'>Searching…</p>
      )}
      {options.length > 0 && (
        <ul className='space-y-2 border rounded-md p-2 max-h-60 overflow-auto max-w-md'>
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
