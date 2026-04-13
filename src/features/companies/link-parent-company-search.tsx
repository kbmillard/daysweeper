'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type CompanyOption = { id: string; name: string };

/**
 * Search companies and set one as parent of `companyId` (PATCH parentCompanyDbId).
 */
export function LinkParentCompanySearch({
  companyId,
  basePath,
  childCompanyIdsKey
}: {
  companyId: string;
  basePath: 'dashboard' | 'map';
  /** Sorted joined child ids so effect deps stay stable when array ref churns */
  childCompanyIdsKey: string;
}) {
  const root = basePath === 'map' ? '/map' : '/dashboard';
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setOptions([]);
      setLoading(false);
      return;
    }
    const excludedChildIds = new Set(
      childCompanyIdsKey ? childCompanyIdsKey.split('|').filter(Boolean) : []
    );
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
          setOptions(
            list.filter(
              (c) => c.id !== companyId && !excludedChildIds.has(c.id)
            )
          );
        })
        .catch((e: unknown) => {
          if ((e as { name?: string })?.name === 'AbortError') return;
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
  }, [search, companyId, childCompanyIdsKey]);

  async function setAsParent(parentId: string, parentName: string) {
    setSubmittingId(parentId);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentCompanyId: parentId })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to set parent');
        return;
      }
      toast.success(`${parentName} set as parent company`);
      setSearch('');
      setOptions([]);
      router.refresh();
    } catch {
      toast.error('Failed to set parent');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className='space-y-2'>
      <Label htmlFor={`link-parent-${companyId}`}>Search all companies</Label>
      <Input
        id={`link-parent-${companyId}`}
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
            <li
              key={c.id}
              className='flex flex-wrap items-center justify-between gap-2'
            >
              <span className='font-medium'>{c.name}</span>
              <div className='flex items-center gap-2'>
                <Link href={`${root}/companies/${c.id}`}>
                  <Button type='button' variant='outline' size='sm'>
                    View
                  </Button>
                </Link>
                <Button
                  type='button'
                  size='sm'
                  disabled={submittingId !== null}
                  onClick={() => setAsParent(c.id, c.name)}
                >
                  {submittingId === c.id ? 'Setting…' : 'Set as parent'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {search.trim() && !loading && options.length === 0 && (
        <p className='text-muted-foreground text-sm'>
          No companies found. Try a different search.
        </p>
      )}
    </div>
  );
}
