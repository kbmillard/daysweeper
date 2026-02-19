'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

export default function NewCompanyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentId = searchParams.get('parentId') ?? undefined;

  const [parentName, setParentName] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parentId) return;
    fetch(`/api/companies/${parentId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data?.company?.name && setParentName(data.company.name))
      .catch(() => {});
  }, [parentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          parentCompanyId: parentId || undefined,
          website: website.trim() || undefined,
          phone: phone.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create company');
        return;
      }
      router.push(`/dashboard/companies/${data.company.id}`);
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
      pageDescription={parentId ? `Add a child company under ${parentName ?? 'parent'}` : 'Create a new company'}
    >
      <div className='space-y-6'>
        <div>
          <Link href={parentId ? `/dashboard/companies/${parentId}` : '/dashboard/companies'}>
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
              <div>
                <Label htmlFor='name'>Company name</Label>
                <Input
                  id='name'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='Company name'
                  required
                  className='mt-1'
                />
              </div>
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
              {error && (
                <p className='text-destructive text-sm'>{error}</p>
              )}
              <div className='flex gap-2'>
                <Button type='submit' disabled={loading}>
                  {loading ? 'Creating…' : parentId ? 'Add child company' : 'Create company'}
                </Button>
                <Link href={parentId ? `/dashboard/companies/${parentId}` : '/dashboard/companies'}>
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
