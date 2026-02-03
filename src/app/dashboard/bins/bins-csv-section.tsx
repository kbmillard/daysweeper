'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

type WarehouseItemForCsv = {
  id: string;
  partNumber: string;
  description: string | null;
  bin: string | null;
  quantity: number;
  price: number | null;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function escapeCsvValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function binsToCsv(bins: WarehouseItemForCsv[]): string {
  const header = 'partNumber,description,bin,quantity,price';
  const rows = bins.map(
    (b) =>
      [
        escapeCsvValue(b.partNumber),
        escapeCsvValue(b.description),
        escapeCsvValue(b.bin),
        escapeCsvValue(b.quantity),
        escapeCsvValue(b.price),
      ].join(',')
  );
  return [header, ...rows].join('\n');
}

export function BinsCsvSection({ initialBins }: { initialBins: WarehouseItemForCsv[] }) {
  const router = useRouter();
  const initialCsv = useMemo(() => binsToCsv(initialBins), [initialBins]);
  const [csv, setCsv] = useState(initialCsv);
  const [isApplying, setIsApplying] = useState(false);

  const handleDownload = () => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bins-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const handleApply = async () => {
    if (!csv.trim()) {
      toast.error('Paste or edit CSV content first');
      return;
    }
    setIsApplying(true);
    try {
      const res = await fetch('/api/import/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csv.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to import');
      }
      const data = await res.json();
      toast.success(`Applied CSV: ${data.upserted} items updated`);
      router.refresh();
      setCsv(csv);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to apply CSV');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bins CSV</CardTitle>
        <CardDescription>
          Edit the CSV below and click Apply to update warehouse items, or download the current data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          className="min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="partNumber,description,bin,quantity,price"
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            Download CSV
          </Button>
          <Button size="sm" onClick={handleApply} disabled={isApplying}>
            {isApplying ? 'Applying…' : 'Apply CSV'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
