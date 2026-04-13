'use client';

import Link from 'next/link';
import { useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { IconArrowLeft } from '@tabler/icons-react';

export default function SellerImportPage() {
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    const raw = jsonText.trim();
    if (!raw) {
      toast.error('Paste JSON first');
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      toast.error('Invalid JSON');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/sellers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      setResult(JSON.stringify(data, null, 2));
      toast.success(`Imported ${(data as { upserted?: number }).upserted ?? 0} sellers · geocode batch done`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      scrollable
      pageTitle='Import sellers'
      pageDescription='Paste vendor JSON (SC-style with company/city/zip or GA-style with vendor_id). Geocoding runs automatically after import.'
    >
      <div className='mb-4'>
        <Link href='/map/sellers'>
          <Button variant='outline' size='sm'>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back to sellers
          </Button>
        </Link>
      </div>
      <Textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder='{ "vendors": [ ... ] }'
        className='min-h-[280px] font-mono text-sm'
      />
      <div className='mt-4 flex gap-2'>
        <Button type='button' onClick={() => void submit()} disabled={loading}>
          {loading ? 'Importing…' : 'Import & geocode'}
        </Button>
      </div>
      {result && (
        <pre className='mt-6 max-h-80 overflow-auto rounded-lg border bg-muted/40 p-4 text-xs'>{result}</pre>
      )}
    </PageContainer>
  );
}
