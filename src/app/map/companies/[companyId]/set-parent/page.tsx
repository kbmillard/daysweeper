'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

const BASE = '/map';

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
          setOptions(list.filter((c) => c.id !== companyId));
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
  }, [search, companyId]);

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
      router.push(`${BASE}/companies/${companyId}`);
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
          <Link href={`${BASE}/companies/${companyId}`}>
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
              Search all companies by name. Open a record to avoid duplicates, or set one as parent.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <Label htmlFor='search'>Company name</Label>
              <Input
                id='search'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Type company name to search…'
                className='mt-1'
                autoComplete='off'
              />
            </div>
            {loading && (
              <p className='text-muted-foreground text-sm'>Searching…</p>
            )}
            {search.trim() && !loading && options.length > 0 && (
              <>
                <p className='text-muted-foreground text-xs font-medium'>
                  Existing companies — open one to avoid linking the wrong entity
                </p>
                <ul className='max-h-60 space-y-2 overflow-auto rounded-md border p-2'>
                  {options.map((c) => (
                    <li
                      key={c.id}
                      className='flex flex-wrap items-center justify-between gap-2'
                    >
                      <Link
                        href={`${BASE}/companies/${c.id}`}
                        className='text-primary font-medium hover:underline'
                      >
                        {c.name}
                      </Link>
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
              </>
            )}
            {search.trim() && !loading && options.length === 0 && (
              <p className='text-muted-foreground text-sm'>
                No companies found. Try a different search.
              </p>
            )}
            <div className='border-t pt-2'>
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
