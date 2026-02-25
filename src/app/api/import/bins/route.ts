export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import * as XLSX from 'xlsx';

type BinRow = {
  partNumber: string;
  description?: string | null;
  bin?: string | null;
  quantity?: number | null;
  changedAt?: Date | null;
  changedBy?: string | null;
};

export const runtime = 'nodejs';

// Bins are global: import applies to the shared list for all users. No org/user scoping.

function normalizeHeader(h: string): string {
  return String(h ?? '')
    .trim()
    .replace(/^"|"$/g, '');
}

function findColumnIndex(headers: string[], patterns: RegExp[]): number {
  for (const re of patterns) {
    const i = headers.findIndex((h) => re.test(normalizeHeader(h)));
    if (i >= 0) return i;
  }
  return -1;
}

function parseExcel(buffer: ArrayBuffer): BinRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  if (!firstSheet) return [];
  const data = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
    header: 1,
    defval: '',
    raw: false
  }) as string[][];
  if (data.length < 2) return [];
  const headers = data[0].map(normalizeHeader);
  const partNumIdx = findColumnIndex(headers, [
    /^part\s*#?$/i,
    /^part\s*number$/i,
    /^part\s*no\.?$/i,
    /^partnum$/i,
    /^sku$/i,
    /^part$/i,
    /^item\s*#?$/i,
    /^item$/i
  ]);
  if (partNumIdx === -1) {
    throw new Error(
      'Sheet must have a part number column (e.g. Part#, Part Number, SKU, Part No)'
    );
  }
  let descIdx = findColumnIndex(headers, [
    /part\s*description/i,
    /^part\s*description$/i,
    /^description$/i,
    /^desc$/i,
    /description/i
  ]);
  if (
    descIdx < 0 &&
    headers.length >= 4 &&
    partNumIdx >= 0 &&
    partNumIdx !== 2
  ) {
    descIdx = 2;
  }
  const binIdx = findColumnIndex(headers, [
    /^bin$/i,
    /^location$/i,
    /^warehouse$/i
  ]);
  const qtyIdx = findColumnIndex(headers, [
    /^quantity$/i,
    /^qty$/i,
    /^amount$/i,
    /^stock$/i
  ]);
  const dateChangedIdx = findColumnIndex(headers, [
    /^date\s*changed$/i,
    /^datechanged$/i,
    /^changed$/i,
    /^modified$/i,
    /^last\s*modified$/i
  ]);
  const userIdx = findColumnIndex(headers, [
    /^user$/i,
    /^changed\s*by$/i,
    /^changedby$/i,
    /^modified\s*by$/i,
    /^by$/i
  ]);

  const rows: BinRow[] = [];
  const toStr = (v: unknown): string | null =>
    v === undefined || v === null ? null : String(v).trim() || null;
  for (let i = 1; i < data.length; i++) {
    const row = data[i] ?? [];
    const partNumber = String(row[partNumIdx] ?? '').trim();
    if (!partNumber) continue;
    const quantity = qtyIdx >= 0 ? Number(row[qtyIdx]) || 0 : 0;
    let changedAt: Date | null = null;
    if (
      dateChangedIdx >= 0 &&
      row[dateChangedIdx] != null &&
      row[dateChangedIdx] !== ''
    ) {
      const v = row[dateChangedIdx] as unknown;
      if (v instanceof Date) changedAt = v;
      else if (typeof v === 'number') changedAt = new Date(v);
      else changedAt = new Date(String(v));
      if (Number.isNaN(changedAt.getTime())) changedAt = null;
    }
    rows.push({
      partNumber,
      description: descIdx >= 0 ? toStr(row[descIdx]) : null,
      bin: binIdx >= 0 ? toStr(row[binIdx]) : null,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      changedAt: changedAt ?? undefined,
      changedBy: userIdx >= 0 ? (toStr(row[userIdx]) ?? undefined) : undefined
    });
  }
  return rows;
}

function parseCSV(csvText: string): BinRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const delim =
    firstLine.includes('\t') && firstLine.split('\t').length > 1 ? '\t' : ',';
  const headers = firstLine.split(delim).map(normalizeHeader);
  const partNumberIdx = findColumnIndex(headers, [
    /part.?number|partnum|part#|sku/i
  ]);
  let descriptionIdx = findColumnIndex(headers, [
    /part\s*description/i,
    /^part\s*description$/i,
    /^description$/i,
    /^desc$/i,
    /description/i
  ]);
  if (
    descriptionIdx < 0 &&
    headers.length >= 4 &&
    partNumberIdx >= 0 &&
    partNumberIdx !== 2
  ) {
    descriptionIdx = 2;
  }
  const binIdx = headers.findIndex((h) =>
    /bin|location|warehouse/i.test(normalizeHeader(h))
  );
  const quantityIdx = headers.findIndex((h) =>
    /quantity|qty|amount|stock/i.test(normalizeHeader(h))
  );
  const dateChangedIdx = findColumnIndex(headers, [
    /date.?changed|datechanged|changed|modified/i
  ]);
  const userIdx = findColumnIndex(headers, [
    /^user$/i,
    /changed.?by|changedby|modified.?by/i
  ]);

  if (partNumberIdx === -1) {
    throw new Error(
      'CSV must have a part number column (partNumber, partnum, part#, or sku)'
    );
  }

  const rows: BinRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(delim)
      .map((v) => v.trim().replace(/^"|"$/g, ''));
    if (values[partNumberIdx]?.trim()) {
      let changedAt: Date | null = null;
      if (dateChangedIdx >= 0 && values[dateChangedIdx]) {
        changedAt = new Date(values[dateChangedIdx]);
        if (Number.isNaN(changedAt.getTime())) changedAt = null;
      }
      const descriptionVal =
        descriptionIdx >= 0 ? values[descriptionIdx]?.trim() || null : null;
      rows.push({
        partNumber: values[partNumberIdx].trim(),
        description: descriptionVal,
        bin: binIdx >= 0 ? values[binIdx] || null : null,
        quantity:
          quantityIdx >= 0 ? parseInt(values[quantityIdx] || '0', 10) || 0 : 0,
        changedAt: changedAt ?? undefined,
        changedBy: userIdx >= 0 ? values[userIdx] || null : undefined
      });
    }
  }
  return rows;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let rows: BinRow[] = [];

    if (
      contentType.includes('multipart/form-data') ||
      contentType.includes('text/csv') ||
      contentType.includes('application/vnd.ms-excel') ||
      contentType.includes(
        'application/vnd.openxmlformats-officedocument.spreadsheetml'
      )
    ) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer();
        rows = parseExcel(buffer);
      } else {
        const csvText = await file.text();
        rows = parseCSV(csvText);
      }
    } else {
      const body = await req.json().catch(() => null);
      if (body?.csv && typeof body.csv === 'string') {
        rows = parseCSV(body.csv);
      } else {
        rows = Array.isArray(body)
          ? body
          : Array.isArray(body?.items)
            ? body.items
            : [];
      }
    }

    if (!rows.length) {
      return NextResponse.json(
        { error: 'Provide CSV file or JSON array of items' },
        { status: 400 }
      );
    }

    let upserted = 0;
    const CHUNK = 250;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows
        .slice(i, i + CHUNK)
        .filter((r) => (r.partNumber || '').trim().length > 0);

      const tx = slice.map((r) => {
        const partNumber = String(r.partNumber).trim();
        const bin = (r.bin ?? '').trim() || '';
        const now = new Date();

        return prisma.warehouseItem.upsert({
          where: { bin_partNumber: { bin, partNumber } },
          create: {
            partNumber,
            description: r.description ?? null,
            bin: bin || null,
            quantity: r.quantity ?? 0,
            changedAt: r.changedAt ?? now,
            changedBy: r.changedBy ?? userId,
            createdAt: now,
            updatedAt: now
          },
          update: {
            description: r.description ?? null,
            ...(r.bin !== undefined && { bin: (r.bin ?? '').trim() || null }),
            ...(r.quantity !== undefined &&
              typeof r.quantity === 'number' && { quantity: r.quantity }),
            changedAt: r.changedAt ?? now,
            changedBy: r.changedBy ?? userId,
            updatedAt: now
          }
        });
      });

      await prisma.$transaction(tx);
      upserted += slice.length;
    }

    return NextResponse.json({
      ok: true,
      upserted,
      message: `Successfully imported ${upserted} warehouse items`
    });
  } catch (error: unknown) {
    console.error('Error importing bins:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to import bins'
      },
      { status: 500 }
    );
  }
}
