'use client';

import Link from 'next/link';
import { useState } from 'react';

import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { IconArrowLeft } from '@tabler/icons-react';

export default function CompaniesImportPage() {
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
      const res = await fetch('/api/crm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      setResult(JSON.stringify(data, null, 2));
      const d = data as {
        importKind?: string;
        upserted?: number;
        buyers?: { upserted?: number };
        crm?: { locationsCreated?: number };
      };
      if (d.importKind === 'buyers' || d.importKind === 'mixed') {
        const n = d.buyers?.upserted ?? d.upserted ?? 0;
        toast.success(
          d.importKind === 'mixed'
            ? `CRM + buyers import done (${n} buyer row(s) touched)`
            : `Imported ${n} buyer companies · geocode batch run`
        );
      } else {
        toast.success('CRM import done · geocode batch run');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      scrollable
      pageTitle='Import companies'
      pageDescription='CRM suppliers: { "suppliers": [...] } or JSON array. Buyers / vendor research: { "vendors": [...] } (same shapes as before). You can send both keys in one request. Geocoding runs automatically.'
    >
      <div className='mb-4'>
        <Link href='/map/companies'>
          <Button variant='outline' size='sm'>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back to companies
          </Button>
        </Link>
      </div>
      <Textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder='{ "suppliers": [ ... ] } and/or { "vendors": [ ... ] }'
        className='min-h-[280px] font-mono text-sm'
      />
      <div className='mt-4 flex gap-2'>
        <Button type='button' onClick={() => void submit()} disabled={loading}>
          {loading ? 'Importing…' : 'Import & geocode'}
        </Button>
      </div>
      {result ? (
        <pre className='bg-muted/40 mt-6 max-h-80 overflow-auto rounded-lg border p-4 text-xs'>
          {result}
        </pre>
      ) : null}
    </PageContainer>
  );
}
