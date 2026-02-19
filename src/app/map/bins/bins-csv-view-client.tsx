'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BinsCsvDisplayTable,
  csvRowsToCsv,
  type CsvBinRow
} from './bins-csv-display-table';
import { BinsCsvSection } from './bins-csv-section';

type WarehouseItemForCsv = {
  id: string;
  partNumber: string;
  description: string | null;
  bin: string | null;
  quantity: number;
  changedAt: Date | null;
  changedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseCsvToRows(csvText: string): CsvBinRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  if (!header.includes('partnumber') && !header.includes('part_number'))
    return [];
  const rows: CsvBinRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(',')
      .map((v) => v.trim().replace(/^"|"$/g, ''));
    const partNumber = values[0]?.trim();
    if (!partNumber) continue;
    const parseNum = (v: string | undefined) => {
      if (v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    rows.push({
      partNumber,
      description: values[1] ?? null,
      bin: values[2] ?? null,
      quantity: parseNum(values[3]) ?? 0,
      changedAt: values[4]?.trim() || null,
      changedBy: values[5]?.trim() || null
    });
  }
  return rows;
}

export function BinsCsvViewClient({
  initialCsvRows,
  initialCsv,
  initialBins
}: {
  initialCsvRows: CsvBinRow[];
  initialCsv: string;
  initialBins: WarehouseItemForCsv[];
}) {
  const [rows, setRows] = useState(initialCsvRows);
  const [csv, setCsv] = useState(initialCsv);

  useEffect(() => {
    setRows(initialCsvRows);
    setCsv(initialCsv);
  }, [initialCsvRows, initialCsv]);

  const handleRowsChange = useCallback((newRows: CsvBinRow[]) => {
    setRows(newRows);
    setCsv(csvRowsToCsv(newRows));
  }, []);

  const handleCsvChange = useCallback((newCsv: string) => {
    setCsv(newCsv);
    const parsed = parseCsvToRows(newCsv);
    if (parsed.length > 0) setRows(parsed);
  }, []);

  return (
    <>
      <BinsCsvDisplayTable rows={rows} onRowsChange={handleRowsChange} />
      <BinsCsvSection
        initialBins={initialBins}
        defaultCsv={initialCsv}
        value={csv}
        onChange={handleCsvChange}
      />
    </>
  );
}
