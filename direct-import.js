const { Client } = require('pg');
const XLSX = require('xlsx');
const fs = require('fs');

const connectionString =
  'postgresql://neondb_owner:npg_XS8nux0bkeWB@ep-morning-dew-ah8xi2jg-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function importBins() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database');

    console.log('Reading Excel file...');
    const buffer = fs.readFileSync('Parts by Bin 251212.xls');
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];

    const data = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: '',
      raw: false
    });

    console.log(`Found ${data.length - 1} rows to import`);

    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const bin = String(row[0] || '').trim() || '';
      const partNumber = String(row[1] || '').trim();
      const description = String(row[2] || '').trim() || null;
      const quantity = Number(row[3]) || 0;

      if (partNumber) {
        rows.push({ bin, partNumber, description, quantity });
      }
    }

    console.log(`Importing ${rows.length} valid rows...`);

    let imported = 0;
    const now = new Date().toISOString();

    for (const r of rows) {
      const query = `
        INSERT INTO "WarehouseItem" (id, "partNumber", description, bin, quantity, "changedAt", "changedBy", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (bin, "partNumber") 
        DO UPDATE SET 
          description = EXCLUDED.description,
          quantity = EXCLUDED.quantity,
          "changedAt" = EXCLUDED."changedAt",
          "changedBy" = EXCLUDED."changedBy",
          "updatedAt" = EXCLUDED."updatedAt"
      `;

      await client.query(query, [
        r.partNumber,
        r.description,
        r.bin || null,
        r.quantity,
        now,
        'system-import',
        now,
        now
      ]);

      imported++;
      if (imported % 50 === 0) {
        console.log(`Imported ${imported} rows so far...`);
      }
    }

    console.log(`\n✅ Successfully imported ${imported} bins!`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

importBins();
