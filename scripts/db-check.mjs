import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_XS8nux0bkeWB@ep-morning-dew-ah8xi2jg.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

await client.connect();

const { rows: [r] } = await client.query(`
  SELECT
    (SELECT COUNT(*) FROM "Company") AS companies_total,
    (SELECT COUNT(*) FROM "Company" WHERE hidden = true) AS companies_hidden,
    (SELECT COUNT(*) FROM "Company" WHERE phone IS NOT NULL AND phone != '') AS with_phone,
    (SELECT COUNT(*) FROM "Company" WHERE website IS NOT NULL AND website != '') AS with_website,
    (SELECT COUNT(*) FROM "Company" WHERE email IS NOT NULL AND email != '') AS with_email,
    (SELECT COUNT(*) FROM "Company" WHERE status IS NOT NULL AND status != '') AS with_status,
    (SELECT COUNT(*) FROM "Location") AS locations_total,
    (SELECT COUNT(*) FROM "Location" WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS with_coords,
    (SELECT COUNT(*) FROM "MapPin") AS map_pins_total,
    (SELECT COUNT(*) FROM "MapPin" WHERE hidden = true) AS map_pins_hidden
`);

const { rows: statuses } = await client.query(`
  SELECT status, COUNT(*)::int AS count
  FROM "Company"
  WHERE status IS NOT NULL AND status != ''
  GROUP BY status
  ORDER BY count DESC
`);

const { rows: locPhone } = await client.query(`
  SELECT COUNT(*)::int AS count FROM "Location" WHERE phone IS NOT NULL AND phone != ''
`);
const { rows: locName } = await client.query(`
  SELECT COUNT(*)::int AS count FROM "Location" WHERE "locationName" IS NOT NULL AND "locationName" != ''
`);

await client.end();

console.log('\n=== DAYSWEEPER DB SNAPSHOT ===');
console.log(`\nCompanies:   ${r.companies_total} total  |  ${r.companies_hidden} hidden  |  ${r.companies_total - r.companies_hidden} visible`);
console.log(`  phone:     ${r.with_phone}`);
console.log(`  website:   ${r.with_website}`);
console.log(`  email:     ${r.with_email}`);
console.log(`  status:    ${r.with_status}`);
console.log(`\nLocations:   ${r.locations_total} total`);
console.log(`  geocoded:  ${r.with_coords}`);
console.log(`  phone:     ${locPhone[0].count}`);
console.log(`  name:      ${locName[0].count}`);
console.log(`\nMapPins:     ${r.map_pins_total} total  |  ${r.map_pins_hidden} hidden`);
console.log('\nStatus breakdown:');
for (const s of statuses) console.log(`  "${s.status}": ${s.count}`);
console.log('');
