const fs = require('fs');
const XLSX = require('xlsx');

async function importViaAPI() {
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
      const bin = String(row[0] || '').trim() || null;
      const partNumber = String(row[1] || '').trim();
      const description = String(row[2] || '').trim() || null;
      const quantity = Number(row[3]) || 0;

      if (partNumber) {
        rows.push({ bin, partNumber, description, quantity });
      }
    }

    console.log(`Importing ${rows.length} valid rows via API...`);

    const response = await fetch(
      'https://daysweeper.recyclicbravery.com/api/import/bins',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rows)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log(`\n✅ Successfully imported ${result.upserted} bins!`);
    console.log(result.message);
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

importViaAPI();
