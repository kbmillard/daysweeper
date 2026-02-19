// Set environment variable before requiring Prisma
process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_XS8nux0bkeWB@ep-morning-dew-ah8xi2jg-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');

const prisma = new PrismaClient();

async function importBins() {
  try {
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
      const bin = String(row[0] || '').trim();
      const partNumber = String(row[1] || '').trim();
      const description = String(row[2] || '').trim() || null;
      const quantity = Number(row[3]) || 0;

      if (partNumber) {
        rows.push({ bin: bin || null, partNumber, description, quantity });
      }
    }

    console.log(`Importing ${rows.length} valid rows...`);

    let imported = 0;
    const CHUNK = 100;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      console.log(`Processing chunk ${Math.floor(i / CHUNK) + 1}...`);

      const operations = chunk.map((r) => {
        const bin = r.bin || '';
        return prisma.warehouseItem.upsert({
          where: { bin_partNumber: { bin, partNumber: r.partNumber } },
          create: {
            bin: r.bin,
            partNumber: r.partNumber,
            description: r.description,
            quantity: r.quantity,
            changedAt: new Date(),
            changedBy: 'system-import'
          },
          update: {
            description: r.description,
            quantity: r.quantity,
            changedAt: new Date(),
            changedBy: 'system-import'
          }
        });
      });

      await prisma.$transaction(operations);
      imported += chunk.length;
      console.log(`Imported ${imported} rows so far...`);
    }

    console.log(`\n✅ Successfully imported ${imported} bins!`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

importBins();
