'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

type CompanyOption = { id: string; name: string };

export default function SetParentPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const [companyName, setCompanyName] = useState('');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/companies/${companyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.company?.name && setCompanyName(data.company.name))
      .catch(() => {});
  }, [companyId]);

  const fetchOptions = useCallback(() => {
    if (!search.trim()) {
      setOptions([]);
      return;
    }
    setLoading(true);
    fetch(`/api/companies?search=${encodeURIComponent(search)}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        const list = data.companies ?? [];
        setOptions(list.filter((c: CompanyOption) => c.id !== companyId));
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [search, companyId]);

  useEffect(() => {
    const t = setTimeout(fetchOptions, 300);
    return () => clearTimeout(t);
  }, [fetchOptions]);

  async function setParent(parentId: string | null) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentCompanyId: parentId })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to update parent');
        return;
      }
      router.push(`/dashboard/companies/${companyId}`);
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer
      scrollable
      pageTitle='Set parent company'
      pageDescription={companyName ? `Link "${companyName}" to a parent company` : 'Choose a parent company'}
    >
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
            <CardTitle>Set parent company</CardTitle>
            <CardDescription>
              Search for an existing company to set as the parent. This company will appear as a child of the selected parent.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <Label htmlFor='search'>Search companies</Label>
              <Input
                id='search'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Type company name…'
                className='mt-1'
              />
            </div>
            {loading && <p className='text-muted-foreground text-sm'>Searching…</p>}
            {options.length > 0 && (
              <ul className='space-y-2 border rounded-md p-2 max-h-60 overflow-auto'>
                {options.map((c) => (
                  <li key={c.id} className='flex items-center justify-between gap-2'>
                    <span className='font-medium'>{c.name}</span>
                    <Button
                      type='button'
                      size='sm'
                      disabled={submitting}
                      onClick={() => setParent(c.id)}
                    >
                      Set as parent
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {search.trim() && !loading && options.length === 0 && (
              <p className='text-muted-foreground text-sm'>No companies found. Try a different search.</p>
            )}
            <div className='pt-2 border-t'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={submitting}
                onClick={() => setParent(null)}
              >
                Clear parent (standalone company)
              </Button>
            </div>
            {error && <p className='text-destructive text-sm'>{error}</p>}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
