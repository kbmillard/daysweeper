const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .replace(/^"|"$/g, '')
    .toUpperCase();
}

function findColumnIndex(headers, patterns) {
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

function parseExcel(filePath) {
  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  // Use the first sheet (Part by Bin)
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  if (!firstSheet) {
    throw new Error('No sheets found in Excel file');
  }

  const data = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: '',
    raw: false
  });

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

  const rows = [];
  const toStr = (v) =>
    v === undefined || v === null ? null : String(v).trim() || null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i] ?? [];
    const partNumber = String(row[partNumIdx] ?? '').trim();

    if (!partNumber) continue;

    let quantity = 0;
    if (qtyIdx >= 0) {
      const qtyValue = row[qtyIdx];
      if (qtyValue !== undefined && qtyValue !== null && qtyValue !== '') {
        const parsed = Number(String(qtyValue).replace(/,/g, ''));
        quantity = Number.isFinite(parsed) ? parsed : 0;
      }
    }

    rows.push({
      partNumber,
      description: descIdx >= 0 ? toStr(row[descIdx]) : null,
      bin: binIdx >= 0 ? toStr(row[binIdx]) : null,
      quantity
    });
  }

  return rows;
}

// Convert to CSV format
function convertToCSV(rows) {
  const headers = ['BIN', 'PART NUMBER', 'PART DESCRIPTION', 'QTY'];
  const csvLines = [headers.join(',')];

  for (const row of rows) {
    const line = [
      row.bin || '',
      row.partNumber || '',
      row.description ? `"${row.description.replace(/"/g, '""')}"` : '',
      row.quantity || 0
    ].join(',');
    csvLines.push(line);
  }

  return csvLines.join('\n');
}

// Main execution
const excelFilePath =
  process.argv[2] || path.join(process.cwd(), 'Parts by Bin 251212.xls');
const outputCsvPath = path.join(process.cwd(), 'bins-import.csv');

console.log(`Reading Excel file: ${excelFilePath}`);
const rows = parseExcel(excelFilePath);
console.log(`Found ${rows.length} rows to convert`);

const csv = convertToCSV(rows);
fs.writeFileSync(outputCsvPath, csv, 'utf-8');

console.log(`\n✅ Successfully converted to CSV: ${outputCsvPath}`);
console.log(`📊 Total rows: ${rows.length}`);
console.log(`\nYou can now upload this CSV file through the web interface.`);
