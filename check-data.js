const { Client } = require('pg');

const connectionString =
  'postgresql://neondb_owner:npg_XS8nux0bkeWB@ep-morning-dew-ah8xi2jg-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkData() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Count total rows
    const countResult = await client.query(
      'SELECT COUNT(*) FROM "WarehouseItem"'
    );
    console.log(
      `Total rows in WarehouseItem table: ${countResult.rows[0].count}`
    );

    // Get first 5 rows
    const dataResult = await client.query(
      'SELECT * FROM "WarehouseItem" LIMIT 5'
    );
    console.log('\nFirst 5 rows:');
    console.log(JSON.stringify(dataResult.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkData();
