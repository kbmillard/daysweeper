import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { BinsTable } from './bins-table';
import { BinsCsvDisplayTable } from './bins-csv-display-table';
import { BinsUploadButton } from './bins-upload-button';
import PageContainer from '@/components/layout/page-container';

const DEFAULT_CSV_HEADER = 'BIN,PART NUMBER,PART DESCRIPTION';

type CsvBinRow = {
  partNumber: string;
  description: string | null;
  bin: string | null;
  quantity: number;
  changedAt: string | null;
  changedBy: string | null;
};

function normalizeHeader(h: string): string {
  return String(h ?? '')
    .trim()
    .replace(/^"|"$/g, '')
    .toLowerCase();
}

function findCol(headers: string[], patterns: string[]): number {
  for (const p of patterns) {
    const i = headers.findIndex(
      (h) => h.includes(p) || h.replace(/\s/g, '') === p.replace(/\s/g, '')
    );
    if (i >= 0) return i;
  }
  return -1;
}

function parseBinsCsv(csvText: string): CsvBinRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const firstLine = lines[0];
  const delim =
    firstLine.includes('\t') && firstLine.split('\t').length > 1 ? '\t' : ',';
  const headers = firstLine.split(delim).map(normalizeHeader);
  const binIdx = findCol(headers, ['bin']);
  const partNumIdx = findCol(headers, [
    'partnumber',
    'part_number',
    'part number',
    'partnum',
    'sku'
  ]);
  let descIdx = findCol(headers, [
    'partdescription',
    'part description',
    'description',
    'desc'
  ]);
  if (descIdx < 0 && headers.length >= 3 && partNumIdx >= 0 && partNumIdx !== 2)
    descIdx = 2;
  const qtyIdx = findCol(headers, ['qty', 'quantity', 'amount', 'stock']);
  if (partNumIdx < 0 && binIdx < 0) return [];
  const parseNum = (v: string | undefined): number => {
    if (v === undefined || v === '') return 0;
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const trim = (v: string | undefined): string | null =>
    v === undefined || v === null
      ? null
      : String(v).trim().replace(/^"|"$/g, '') || null;
  const rows: CsvBinRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(delim)
      .map((v) => String(v).trim().replace(/^"|"$/g, ''));
    const partNumber = trim(values[partNumIdx >= 0 ? partNumIdx : 0]) ?? '';
    const bin = trim(values[binIdx >= 0 ? binIdx : 0]);
    if (!partNumber && !bin) continue;
    rows.push({
      partNumber,
      description: descIdx >= 0 ? trim(values[descIdx]) : null,
      bin,
      quantity: qtyIdx >= 0 ? parseNum(values[qtyIdx]) : 0,
      changedAt: null,
      changedBy: null
    });
  }
  return rows;
}

const BINS_LIMIT = 5000;

// Bins are global: same list for all users. No org or user scoping.
export default async function BinsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  const bins = await prisma.warehouseItem.findMany({
    orderBy: { updatedAt: 'desc' },
    take: BINS_LIMIT
  });

  const binsWithNumbers = bins.map((bin) => ({
    ...bin,
    price: bin.price ? Number(bin.price) : null
  }));

  let csvRows: CsvBinRow[] = [];
  try {
    const csvPath = join(process.cwd(), 'bins.csv');
    const raw = await readFile(csvPath, 'utf-8');
    csvRows = parseBinsCsv(raw);
  } catch {
    if (bins.length === 0) {
      csvRows = parseBinsCsv(`${DEFAULT_CSV_HEADER}\nA-01,PN-001,Widget A`);
    }
  }

  const displayFromCsv = binsWithNumbers.length === 0 && csvRows.length > 0;

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold tracking-tight'>Bins</h2>
          <BinsUploadButton />
        </div>
        {displayFromCsv ? (
          <BinsCsvDisplayTable rows={csvRows} />
        ) : (
          <BinsTable initialData={binsWithNumbers} />
        )}
      </div>
    </PageContainer>
  );
}
