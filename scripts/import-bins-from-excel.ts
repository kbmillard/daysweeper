import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

type BinRow = {
  partNumber: string;
  description?: string | null;
  bin?: string | null;
  quantity?: number;
};

function normalizeHeader(h: string): string {
  return String(h ?? '')
    .trim()
    .replace(/^"|"$/g, '')
    .toUpperCase();
}

function findColumnIndex(headers: string[], patterns: string[]): number {
  for (const pattern of patterns) {
    const i = headers.findIndex(
      (h) =>
        normalizeHeader(h) === pattern ||
        normalizeHeader(h).replace(/\s/g, '') === pattern.replace(/\s/g, '')
    );
    if (i >= 0) return i;
  }
  return -1;
}

function parseExcel(filePath: string): BinRow[] {
  const buffer = readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  // Use the first sheet (Part by Bin)
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  if (!firstSheet) {
    throw new Error('No sheets found in Excel file');
  }

  const data = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
    header: 1,
    defval: '',
    raw: false
  }) as string[][];

  if (data.length < 2) {
    throw new Error(
      'Excel file must have at least a header row and one data row'
    );
  }

  const headers = data[0].map(normalizeHeader);

  // Find column indices
  const binIdx = findColumnIndex(headers, ['BIN']);
  const partNumIdx = findColumnIndex(headers, [
    'PART NUMBER',
    'PARTNUMBER',
    'PART#'
  ]);
  const descIdx = findColumnIndex(headers, [
    'PART DESCRIPTION',
    'PARTDESCRIPTION',
    'DESCRIPTION'
  ]);
  const qtyIdx = findColumnIndex(headers, ['QTY', 'QUANTITY']);

  if (partNumIdx === -1) {
    throw new Error('Could not find PART NUMBER column');
  }

  const rows: BinRow[] = [];
  const toStr = (v: unknown): string | null =>
    v === undefined || v === null ? null : String(v).trim() || null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i] ?? [];
    const partNumber = String(row[partNumIdx] ?? '').trim();

    if (!partNumber) continue;

    const quantity = qtyIdx >= 0 ? Number(row[qtyIdx]) || 0 : 0;

    rows.push({
      partNumber,
      description: descIdx >= 0 ? toStr(row[descIdx]) : null,
      bin: binIdx >= 0 ? toStr(row[binIdx]) : null,
      quantity: Number.isFinite(quantity) ? quantity : 0
    });
  }

  return rows;
}

async function importBins(filePath: string) {
  try {
    console.log(`Reading Excel file: ${filePath}`);
    const rows = parseExcel(filePath);
    console.log(`Found ${rows.length} rows to import`);

    let upserted = 0;
    const CHUNK = 250;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows
        .slice(i, i + CHUNK)
        .filter((r) => (r.partNumber || '').trim().length > 0);

      console.log(
        `Processing chunk ${Math.floor(i / CHUNK) + 1} (${slice.length} items)...`
      );

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
            changedAt: now,
            changedBy: 'system-import',
            createdAt: now,
            updatedAt: now
          },
          update: {
            description: r.description ?? null,
            bin: bin || null,
            quantity: r.quantity ?? 0,
            changedAt: now,
            changedBy: 'system-import',
            updatedAt: now
          }
        });
      });

      await prisma.$transaction(tx);
      upserted += slice.length;
      console.log(`Upserted ${upserted} items so far...`);
    }

    console.log(`\n✅ Successfully imported ${upserted} warehouse items`);
    return upserted;
  } catch (error) {
    console.error('❌ Error importing bins:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const excelFilePath =
  process.argv[2] || join(process.cwd(), 'Parts by Bin 251212.xls');

importBins(excelFilePath)
  .then((count) => {
    console.log(`\n🎉 Import complete! ${count} items imported.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Import failed:', error);
    process.exit(1);
  });
